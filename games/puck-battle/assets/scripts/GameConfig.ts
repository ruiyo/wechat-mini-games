export const PUCK_CONFIG = {
  arenaWidthRatio: 0.86,
  arenaHeightRatio: 0.59,
  puckRadius: 19,
  maxPullDistance: 155,
  minPullDistance: 12,
  maxLaunchSpeed: 760,
  stopSpeed: 7,
  stableDuration: 0.48,
  maxShotDuration: 9,
  wallThickness: 24,
} as const;

export const PUCK_COLORS = [
  { r: 66, g: 153, b: 225, a: 255 },
  { r: 244, g: 114, b: 100, a: 255 },
  { r: 91, g: 190, b: 145, a: 255 },
] as const;
