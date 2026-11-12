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
