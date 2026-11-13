/**
 * Physics-backed geometric obstacles, with repeatable layouts for every mode.
 * Positions are fractions of the 2D arena, not screen pixels.
 * No obstacle is spawned in the launch lane or on top of a Hanzi block.
 */
export type ObstacleKind = 'brick' | 'triangle' | 'bar' | 'diamond' | 'hex';
export type ObstacleMode = 'classic' | 'practice' | 'adventure';
export interface ObstacleSpec {
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
