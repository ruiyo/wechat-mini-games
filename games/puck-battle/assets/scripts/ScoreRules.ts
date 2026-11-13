export interface ScoreRadii {
  center: number;
  middle: number;
  outer: number;
}

/** Score a puck by its final distance from the target center. */
export function scoreByDistance(distance: number, radii: ScoreRadii): number {
  if (distance <= radii.center) return 50;
  if (distance <= radii.middle) return 30;
  if (distance <= radii.outer) return 10;
  return 0;
}

export function distanceBetween(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
