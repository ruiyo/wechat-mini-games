import { AIM_CONFIG, PUCK_CONFIG } from './GameConfig';

/**
 * Convert a finger pull into a shot without relying on the puck's hit offset.
 * The pull direction points from the current finger position to the touch-down
 * position; the puck itself remains anchored until touch release.
 */
export interface AimSolution {
  readonly distance: number;
  readonly directionX: number;
  readonly directionY: number;
  readonly strength: number;
  readonly speed: number;
  readonly ready: boolean;
}

export function calculateAim(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  speedMultiplier = 1,
): AimSolution {
  const dx = startX - currentX;
  const dy = startY - currentY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const ready = distance >= PUCK_CONFIG.minPullDistance;
  const range = PUCK_CONFIG.maxPullDistance - PUCK_CONFIG.minPullDistance;
  const normalized = Math.min(1, Math.max(0, (distance - PUCK_CONFIG.minPullDistance) / range));
  const strength = Math.pow(normalized, AIM_CONFIG.powerExponent);
  const speed = ready
    ? PUCK_CONFIG.maxLaunchSpeed * (AIM_CONFIG.minimumSpeedRatio + strength *
        (1 - AIM_CONFIG.minimumSpeedRatio)) * speedMultiplier
    : 0;
  const safeDistance = Math.max(distance, 0.00001);
  return {
    distance,
    directionX: dx / safeDistance,
    directionY: dy / safeDistance,
    strength,
    speed,
    ready,
  };
}

export interface AimGuideBounds { left: number; right: number; bottom: number; top: number; }
export interface AimGuidePoint { x: number; y: number; }

/** Approximate wall-only direction preview. Bumpers, other pucks and ammo effects
 * are NOT predicted; Box2D remains authoritative for the actual shot. */
export function predictWallBouncePath(
  startX: number, startY: number, directionX: number, directionY: number,
  travelDistance: number, bounds: AimGuideBounds, maxBounces = 2,
): AimGuidePoint[] {
  const points: AimGuidePoint[] = [{ x: startX, y: startY }];
  if ([startX, startY, directionX, directionY, travelDistance,
      bounds.left, bounds.right, bounds.bottom, bounds.top]
      .some((value) => !Number.isFinite(value)) ||
      travelDistance <= 0 || bounds.left >= bounds.right ||
      bounds.bottom >= bounds.top) return points;
  const length = Math.hypot(directionX, directionY);
  if (length <= 0.000001) return points;
  let dx = directionX / length;
  let dy = directionY / length;
  let x = Math.max(bounds.left, Math.min(bounds.right, startX));
  let y = Math.max(bounds.bottom, Math.min(bounds.top, startY));
  points[0] = { x, y };
  let remaining = travelDistance;
  const limit = Math.min(4, Math.max(0, Math.floor(maxBounces)));
  for (let segment = 0; segment <= limit && remaining > 0.0001; segment++) {
    const tx = dx > 0.000001 ? (bounds.right - x) / dx :
      dx < -0.000001 ? (bounds.left - x) / dx : Infinity;
    const ty = dy > 0.000001 ? (bounds.top - y) / dy :
      dy < -0.000001 ? (bounds.bottom - y) / dy : Infinity;
    const toWall = Math.max(0, Math.min(tx, ty));
    const step = Math.min(remaining, toWall);
    if (step > 0.000001) {
      x = Math.max(bounds.left, Math.min(bounds.right, x + dx * step));
      y = Math.max(bounds.bottom, Math.min(bounds.top, y + dy * step));
      points.push({ x, y });
      remaining -= step;
    }
    if (remaining <= 0.0001 || !Number.isFinite(toWall) || segment === limit) break;
    if (Math.abs(tx - toWall) < 0.0001) dx = -dx;
    if (Math.abs(ty - toWall) < 0.0001) dy = -dy;
  }
  return points;
}
