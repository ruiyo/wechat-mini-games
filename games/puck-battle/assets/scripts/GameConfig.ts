export const PUCK_CONFIG = {
  arenaWidthRatio: 0.86,
  arenaHeightRatio: 0.52,
  puckRadius: 19,
  maxPullDistance: 205,
  minPullDistance: 20,
  maxLaunchSpeed: 720,
  stopSpeed: 10,
  stableDuration: 0.30,
  maxShotDuration: 7.5,
  wallThickness: 24,
  maxActivePucks: 3,
  maxMisses: 5,
  comboStep: 0.15,
  maxComboMultiplier: 2.2,
} as const;

export const WORD_UI_CONFIG = {
  tileWidth: 52,
  tileHeight: 72,
  tileGap: 8,
  tileFontSize: 27,
  wordBookButtonXRatio: 0.36,
  wordBookButtonWidth: 112,
  wordBookButtonHeight: 48,
  tileYRatio: 0.35,
  previewYRatio: 0.404,
  confirmYRatio: 0.449,
} as const;

/** Keeps short drags deliberate and gives medium pulls finer speed control. */
export const AIM_CONFIG = {
  powerExponent: 1.35,
  minimumSpeedRatio: 0.23,
  touchRadiusMultiplier: 3.2,
  moveRedrawThreshold: 2,
} as const;
