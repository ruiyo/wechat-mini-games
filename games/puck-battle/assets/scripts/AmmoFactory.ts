import { AmmoType, WordDefinition } from './WordDictionary';

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
  targetDamping: number;
}

const AMMO_BASE: Record<AmmoType, Omit<AmmoDefinition, 'word'>> = {
  bounce: {
    type: 'bounce',
    name: '弹跳弹',
    description: '增强反弹，适合借墙改变路线。',
    color: [255, 190, 77],
    launchSpeedMultiplier: 1,
    restitution: 0.82,
    friction: 0.08,
    linearDamping: 0.58,
    density: 1,
    scoreMultiplier: 1,
    magnetSteer: 0,
    targetDamping: 0.58,
  },
  magnet: {
    type: 'magnet',
    name: '磁吸弹',
    description: '飞行时轻微向目标中心偏转。',
    color: [85, 157, 244],
    launchSpeedMultiplier: 0.96,
    restitution: 0.2,
    friction: 0.15,
    linearDamping: 0.9,
    density: 1,
    scoreMultiplier: 1,
    magnetSteer: 0.045,
    targetDamping: 0.9,
  },
  ice: {
    type: 'ice',
    name: '冰冻弹',
    description: '接近目标圈时快速减速，方便停准。',
    color: [91, 207, 235],
    launchSpeedMultiplier: 1.04,
    restitution: 0.06,
    friction: 0.82,
    linearDamping: 0.82,
    density: 1,
    scoreMultiplier: 1.05,
    magnetSteer: 0,
    targetDamping: 4.2,
  },
  impact: {
    type: 'impact',
    name: '冲击弹',
    description: '发射速度和碰撞冲击更强。',
    color: [246, 111, 91],
    launchSpeedMultiplier: 1.2,
    restitution: 0.42,
    friction: 0.12,
    linearDamping: 0.78,
    density: 1.55,
    scoreMultiplier: 1.1,
    magnetSteer: 0,
    targetDamping: 0.78,
  },
};

export class AmmoFactory {
  static create(definition: WordDefinition): AmmoDefinition {
    const base = AMMO_BASE[definition.ammoType];
    return {
      ...base,
      word: definition.word,
      name: definition.ammoName,
      description: definition.description,
    };
  }
}
