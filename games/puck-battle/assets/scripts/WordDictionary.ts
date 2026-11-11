export type AmmoType = 'bounce' | 'magnet' | 'ice' | 'impact';

export interface WordDefinition {
  word: string;
  ammoType: AmmoType;
  ammoName: string;
  description: string;
}

export const WORD_DEFINITIONS: WordDefinition[] = [
  { word: '弹跳', ammoType: 'bounce', ammoName: '弹跳弹', description: '增强反弹，适合借墙改变路线。' },
  { word: '反弹', ammoType: 'bounce', ammoName: '弹跳弹', description: '增强反弹，适合借墙改变路线。' },
  { word: '跳跃', ammoType: 'bounce', ammoName: '弹跳弹', description: '增强反弹，适合借墙改变路线。' },
  { word: '弹射', ammoType: 'bounce', ammoName: '弹跳弹', description: '增强反弹，适合借墙改变路线。' },
  { word: '弹力', ammoType: 'bounce', ammoName: '弹跳弹', description: '增强反弹，适合借墙改变路线。' },
  { word: '回弹', ammoType: 'bounce', ammoName: '弹跳弹', description: '增强反弹，适合借墙改变路线。' },

  { word: '磁吸', ammoType: 'magnet', ammoName: '磁吸弹', description: '飞行时轻微向目标中心偏转。' },
  { word: '磁力', ammoType: 'magnet', ammoName: '磁吸弹', description: '飞行时轻微向目标中心偏转。' },
  { word: '吸引', ammoType: 'magnet', ammoName: '磁吸弹', description: '飞行时轻微向目标中心偏转。' },
  { word: '吸附', ammoType: 'magnet', ammoName: '磁吸弹', description: '飞行时轻微向目标中心偏转。' },
  { word: '引力', ammoType: 'magnet', ammoName: '磁吸弹', description: '飞行时轻微向目标中心偏转。' },
  { word: '磁场', ammoType: 'magnet', ammoName: '磁吸弹', description: '飞行时轻微向目标中心偏转。' },

  { word: '冰冻', ammoType: 'ice', ammoName: '冰冻弹', description: '接近目标圈时快速减速，方便停准。' },
  { word: '冷冻', ammoType: 'ice', ammoName: '冰冻弹', description: '接近目标圈时快速减速，方便停准。' },
  { word: '冰封', ammoType: 'ice', ammoName: '冰冻弹', description: '接近目标圈时快速减速，方便停准。' },
  { word: '寒冰', ammoType: 'ice', ammoName: '冰冻弹', description: '接近目标圈时快速减速，方便停准。' },
  { word: '冻结', ammoType: 'ice', ammoName: '冰冻弹', description: '接近目标圈时快速减速，方便停准。' },
  { word: '冰霜', ammoType: 'ice', ammoName: '冰冻弹', description: '接近目标圈时快速减速，方便停准。' },

  { word: '冲击', ammoType: 'impact', ammoName: '冲击弹', description: '发射速度和碰撞冲击更强。' },
  { word: '撞击', ammoType: 'impact', ammoName: '冲击弹', description: '发射速度和碰撞冲击更强。' },
  { word: '震荡', ammoType: 'impact', ammoName: '冲击弹', description: '发射速度和碰撞冲击更强。' },
  { word: '重击', ammoType: 'impact', ammoName: '冲击弹', description: '发射速度和碰撞冲击更强。' },
  { word: '冲撞', ammoType: 'impact', ammoName: '冲击弹', description: '发射速度和碰撞冲击更强。' },
  { word: '轰击', ammoType: 'impact', ammoName: '冲击弹', description: '发射速度和碰撞冲击更强。' },
];

const WORD_MAP = new Map<string, WordDefinition>(
  WORD_DEFINITIONS.map((definition) => [definition.word, definition]),
);

export function findWord(first: string, second: string): WordDefinition | null {
  return WORD_MAP.get(first + second) || WORD_MAP.get(second + first) || null;
}

export function getRandomWordDefinition(): WordDefinition {
  const index = Math.floor(Math.random() * WORD_DEFINITIONS.length);
  return WORD_DEFINITIONS[index];
}
