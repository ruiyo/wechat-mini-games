/** Pure, deterministic puck-to-puck effect rules (Cocos-independent). */
export const INTERACTION_CONFIG = {
  minContactSpeed: 30,
  contactCooldown: 0.20,
  impactMinPush: 95,
  impactMaxPush: 270,
  impactPushRatio: 0.52,
  // Frozen old pucks become temporary STATIC bodies instead of only slowing.
  iceFreezeSeconds: 2.4,
  iceVelocityRatio: 0,
  iceFrozenDamping: 20,
  iceAreaRadius: 108,
  iceAreaActiveSeconds: 2.8,
  // A moving OR resting magnetic shot attracts existing pucks for this time.
  magnetFieldSeconds: 3.2,
  magnetRange: 235,
  magnetAcceleration: 2100,
  magnetMaxDeltaVelocity: 44,
  magnetMaxTargetSpeed: 430,
} as const;

export interface ContactDirection {
  nx: number;
  ny: number;
  closingSpeed: number;
  relativeSpeed: number;
}

/** Normal points from puck A toward B. */
export function calculatePuckContact(
  ax: number, ay: number, avx: number, avy: number,
  bx: number, by: number, bvx: number, bvy: number,
): ContactDirection {
  const dx = bx - ax, dy = by - ay;
  const relX = avx - bvx, relY = avy - bvy;
  const separation = Math.hypot(dx, dy);
  const relSpeed = Math.hypot(relX, relY);
  const nx = separation > 0.001 ? dx / separation : relSpeed > 0.001 ? relX / relSpeed : 1;
  const ny = separation > 0.001 ? dy / separation : relSpeed > 0.001 ? relY / relSpeed : 0;
  return { nx, ny, closingSpeed: Math.max(0, relX * nx + relY * ny), relativeSpeed: relSpeed };
}

export function calculateImpactPush(closingSpeed: number): number {
  if (!Number.isFinite(closingSpeed) || closingSpeed < INTERACTION_CONFIG.minContactSpeed) return 0;
  return Math.min(INTERACTION_CONFIG.impactMaxPush,
    Math.max(INTERACTION_CONFIG.impactMinPush,
      closingSpeed * INTERACTION_CONFIG.impactPushRatio));
}

/** Magnetic field accelerates other pucks toward the active magnet puck. */
export function calculateMagnetDeltaVelocity(
  dx: number, dy: number, deltaTime: number,
  radius = INTERACTION_CONFIG.magnetRange,
  acceleration = INTERACTION_CONFIG.magnetAcceleration,
): { x: number; y: number } {
  if (![dx, dy, deltaTime, radius, acceleration].every(Number.isFinite) || deltaTime <= 0 ||
      radius <= 0 || acceleration <= 0) return { x: 0, y: 0 };
  const distance = Math.hypot(dx, dy);
  if (distance < 0.001 || distance >= radius) return { x: 0, y: 0 };
  // Preserve a clear pull at mid/outer range while smoothly tapering
  // toward the boundary. Cap delta-v to avoid unstable fast-frame spikes.
  const falloff = 1 - distance / radius;
  const strength = 0.34 + 0.66 * Math.pow(falloff, 0.75);
  const delta = Math.min(INTERACTION_CONFIG.magnetMaxDeltaVelocity,
    acceleration * Math.min(deltaTime, 1 / 30) * strength);
  return { x: dx / distance * delta, y: dy / distance * delta };
}

/** Highlight old pucks when the guide approaches their circular bodies. */
export function pathIntersectsCircle(
  path: ReadonlyArray<{ x: number; y: number }>,
  cx: number, cy: number, radius: number,
): boolean {
  if (radius <= 0) return false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const denom = dx * dx + dy * dy;
    const t = denom > 0
      ? Math.max(0, Math.min(1, ((cx - a.x) * dx + (cy - a.y) * dy) / denom))
      : 0;
    const x = a.x + dx * t - cx, y = a.y + dy * t - cy;
    if (x * x + y * y <= radius * radius) return true;
  }
  return false;
}
