/**
 * Physics-backed geometric obstacles, with repeatable layouts for every mode.
 * Positions are fractions of the 2D arena, not screen pixels.
 * No obstacle is spawned in the launch lane or on top of a Hanzi block.
 */
export type ObstacleKind = 'brick' | 'triangle' | 'bar' | 'diamond' | 'hex';
export type ObstacleMode = 'classic' | 'practice' | 'adventure';
export type ObstacleEffect = 'frost' | 'magnet' | 'burst';
export interface ObstacleSpec {
  effect?: ObstacleEffect;
  id: string;
  kind: ObstacleKind;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  restitution: number;
}
export interface ObstaclePoint { x: number; y: number; }
type ObstacleSeed = readonly [
  ObstacleKind, number, number, number, number, number,
];

const CHAPTERS: readonly ObstacleSeed[][] = [
  // Onboarding: two unobtrusive rounded rectangular deflectors.
  [['brick', -0.26, -0.12, 66, 22, 0],
   ['brick', 0.26, -0.12, 66, 22, 0]],
  // Angle mastery: triangular reflectors and a central horizontal rail.
  [['triangle', -0.27, -0.12, 58, 50, -15],
   ['triangle', 0.27, -0.12, 58, 50, 15],
   ['bar', 0, -0.23, 106, 17, 0]],
  // Combo stage: compact diamond and hex bumpers flank a short rail.
  [['diamond', -0.27, -0.10, 51, 54, 0],
   ['hex', 0.27, -0.10, 54, 50, 0],
   ['bar', 0, -0.20, 106, 17, 0]],
  // Boss stage: two slanted guards and a central hexagonal blocker.
  [['bar', -0.28, -0.15, 98, 18, -25],
   ['bar', 0.28, -0.15, 98, 18, 25],
   ['hex', 0, -0.13, 64, 56, 0],
   ['diamond', 0, -0.025, 43, 42, 0]],
];
const CLASSIC: readonly ObstacleSeed[] = [
  ['brick', -0.27, -0.12, 68, 22, 0],
  ['triangle', 0.27, -0.12, 56, 52, 15],
  ['bar', 0, -0.21, 100, 16, 0],
];
// Practice has an unobstructed centre so two old pucks can collide.
const PRACTICE: readonly ObstacleSeed[] = [
  ['brick', -0.34, -0.14, 49, 18, 0],
  ['brick', 0.34, -0.14, 49, 18, 0],
];

export function getObstaclesForMode(
  mode: ObstacleMode, stage = 1,
): ObstacleSpec[] {
  const chapter = Math.max(1, Math.min(4, Math.floor(stage)));
  const seeds = mode === 'practice' ? PRACTICE
    : mode === 'classic' ? CLASSIC : CHAPTERS[chapter - 1];
  return seeds.map(([kind, x, y, width, height, angle], index) => ({
    id: mode + '-' + chapter + '-' + index,
    kind, x, y, width, height, angle,
    effect: mode === 'adventure' && chapter === 3
      ? (index === 0 ? 'frost' : index === 1 ? 'magnet' : undefined)
      : mode === 'adventure' && chapter === 4 && index === 2
        ? 'burst' : undefined,
    restitution: kind === 'triangle' ? 0.96
      : kind === 'bar' ? 0.82
        : kind === 'hex' ? 0.72 : kind === 'diamond' ? 0.86 : 0.52,
  }));
}

/** Counter-clockwise convex vertices, max six points for Box2D. */
export function getObstacleVertices(spec: ObstacleSpec): ObstaclePoint[] {
  const w = spec.width / 2, h = spec.height / 2;
  switch (spec.kind) {
    case 'triangle': return [
      { x: -w, y: -h }, { x: w, y: -h }, { x: 0, y: h },
    ];
    case 'diamond': return [
      { x: w, y: 0 }, { x: 0, y: h },
      { x: -w, y: 0 }, { x: 0, y: -h },
    ];
    case 'hex': return [
      { x: w, y: 0 }, { x: w / 2, y: h },
      { x: -w / 2, y: h }, { x: -w, y: 0 },
      { x: -w / 2, y: -h }, { x: w / 2, y: -h },
    ];
    default: return [
      { x: -w, y: -h }, { x: w, y: -h },
      { x: w, y: h }, { x: -w, y: h },
    ];
  }
}

/** Approximate first contact between a puck centre and the expanded convex
 * silhouette of an obstacle. Rotated shapes use the same local vertices as
 * their Box2D collider; the polygon is expanded by the puck radius.
 * Corners are conservatively square rather than circular, so this is a
 * *guide* only and never replaces physics collision detection.
 */
export interface AimObstacleContact extends ObstaclePoint {
  readonly id: string;
  readonly kind: ObstacleKind;
  readonly effect?: ObstacleEffect;
}
export interface ObstacleClippedGuide {
  readonly path: ObstaclePoint[];
  readonly contact: AimObstacleContact | null;
}
function edgeEntryTime(
  from: ObstaclePoint,
  to: ObstaclePoint,
  vertices: ReadonlyArray<ObstaclePoint>,
  padding: number,
): number | null {
  let enter = 0;
  let exit = 1;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const size = Math.hypot(ex, ey);
    if (size < 0.000001) return null;
    // CCW polygon: edge outward normal points right.
    const nx = ey / size;
    const ny = -ex / size;
    const limit = nx * (a.x - from.x) + ny * (a.y - from.y) + padding;
    const motion = nx * dx + ny * dy;
    if (Math.abs(motion) < 0.000001) {
      if (limit < -0.000001) return null;
      continue;
    }
    const t = limit / motion;
    if (motion < 0) enter = Math.max(enter, t);
    else exit = Math.min(exit, t);
    if (enter > exit + 0.000001) return null;
  }
  return enter >= 0 && enter <= 1 ? enter : null;
}

/** Clip a wall-reflection hint at the first possible geometric obstruction. */
export function clipGuideAtObstacles(
  path: ReadonlyArray<ObstaclePoint>,
  specs: ReadonlyArray<ObstacleSpec>,
  arenaWidth: number,
  arenaHeight: number,
  arenaCenterY: number,
  puckRadius: number,
): ObstacleClippedGuide {
  const safePath = path.map(p => ({ x: p.x, y: p.y }));
  if (path.length < 2 || !Number.isFinite(puckRadius) || puckRadius < 0 ||
      !Number.isFinite(arenaWidth) || !Number.isFinite(arenaHeight) ||
      !Number.isFinite(arenaCenterY)) {
    return { path: safePath, contact: null };
  }
  const expanded = specs.map(spec => {
    const theta = spec.angle * Math.PI / 180;
    const cos = Math.cos(theta), sin = Math.sin(theta);
    const x = spec.x * arenaWidth;
    const y = arenaCenterY + spec.y * arenaHeight;
    return {
      spec, vertices: getObstacleVertices(spec).map(point => ({
        x: x + point.x * cos - point.y * sin,
        y: y + point.x * sin + point.y * cos,
      })),
    };
  });
  for (let index = 1; index < path.length; index++) {
    const a = path[index - 1];
    const b = path[index];
    let first: { spec: ObstacleSpec; t: number } | null = null;
    for (const item of expanded) {
      const t = edgeEntryTime(a, b, item.vertices, puckRadius);
      if (t !== null && (!first || t < first.t)) {
        first = { spec: item.spec, t };
      }
    }
    if (first) {
      const t = first.t;
      const point = { x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t };
      return {
        path: [...safePath.slice(0, index), point],
        contact: {
          ...point,
          id: first.spec.id,
          kind: first.spec.kind,
          effect: first.spec.effect,
        },
      };
    }
  }
  return { path: safePath, contact: null };
}

/** Labels describe a *predicted* collision, never a confirmed contact. */
export function obstacleGuideLabel(kind: ObstacleKind, effect?: ObstacleEffect): string {
  if (effect === 'frost') return '冰霜机关';
  if (effect === 'magnet') return '磁场柱';
  if (effect === 'burst') return '爆裂机关';
  return kind === 'triangle' ? '三角反射板'
    : kind === 'bar' ? '长条挡板'
    : kind === 'diamond' ? '菱形挡块'
    : kind === 'hex' ? '六边形挡块' : '矩形砖块';
}
