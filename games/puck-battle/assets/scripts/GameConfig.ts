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
  maxActivePucks: 3,
  maxMisses: 5,
  comboStep: 0.15,
  maxComboMultiplier: 2.2,
} as const;

export const WORD_UI_CONFIG = {
  tileWidth: 72,
  tileHeight: 76,
  tileGap: 12,
  tileYRatio: 0.36,
  previewYRatio: 0.425,
  confirmYRatio: 0.475,
} as const;
