import type { AmmoType, WordDefinition } from './WordDictionary';

export interface AmmoDefinition {
  word: string;
  type: AmmoType;
  name: string;
  description: string;
  color: [number, number, number];
  launchSpeedMultiplier: number;
  restitution: number;
  friction: number;
  linearDamping: number;
  density: number;
  scoreMultiplier: number;
  magnetSteer: number;
  magnetRange: number;
  magnetAcceleration: number;
  targetDamping: number;
}

const AMMO_BASE: Record<AmmoType, Omit<AmmoDefinition, 'word'>> = {
  bounce: {
    type: 'bounce',
    name: '弹跳弹',
    description: '高弹性！碰撞墙面或旧弹药会明显反弹。',
    color: [255, 190, 77],
    launchSpeedMultiplier: 1,
    restitution: 0.95,
    friction: 0.06,
    linearDamping: 0.42,
    density: 1,
    scoreMultiplier: 1,
    magnetSteer: 0,
    magnetRange: 0,
    magnetAcceleration: 0,
    targetDamping: 0.42,
  },
  magnet: {
    type: 'magnet',
    name: '磁吸弹',
    description: '发射后持续3秒牵引附近旧弹药，即使停下也有效。',
    color: [85, 157, 244],
    launchSpeedMultiplier: 0.96,
    restitution: 0.2,
    friction: 0.15,
    linearDamping: 0.9,
    density: 1,
    scoreMultiplier: 1,
    magnetSteer: 0.055,
    magnetRange: 235,
    magnetAcceleration: 2100,
    targetDamping: 0.9,
  },
  ice: {
    type: 'ice',
    name: '冰冻弹',
    description: '寒霜范围冻结附近旧弹药约2秒，短时间无法移动。',
    color: [91, 207, 235],
    launchSpeedMultiplier: 1.04,
    restitution: 0.06,
    friction: 0.82,
    linearDamping: 0.82,
    density: 1,
    scoreMultiplier: 1.05,
    magnetSteer: 0,
    magnetRange: 0,
    magnetAcceleration: 0,
    targetDamping: 6.7,
  },
  impact: {
    type: 'impact',
    name: '冲击弹',
    description: '高质量重击！碰撞时额外推动旧弹药。',
    color: [246, 111, 91],
    launchSpeedMultiplier: 1.18,
    restitution: 0.35,
    friction: 0.13,
    linearDamping: 0.72,
    density: 2.4,
    scoreMultiplier: 1.1,
    magnetSteer: 0,
    magnetRange: 0,
    magnetAcceleration: 0,
    targetDamping: 0.72,
  },
};

export class AmmoFactory {
  static create(definition: WordDefinition): AmmoDefinition {
    const base = AMMO_BASE[definition.ammoType];
    return {
      ...base,
      word: definition.word,
      name: definition.ammoName,
      description: base.description,
    };
  }
}
