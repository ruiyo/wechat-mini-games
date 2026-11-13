import type { AmmoType } from './WordDictionary';

export type FusionId =
  'magnet-ice' | 'magnet-impact' | 'bounce-ice' |
  'bounce-impact' | 'ice-impact' | 'bounce-magnet';

export interface FusionRecipe {
  id: FusionId;
  name: string;
  description: string;
  radius: number;
  blockDamage: number;
  color: [number, number, number];
}

export const FUSION_RECIPES: FusionRecipe[] = [
  { id: 'magnet-ice', name: '冰磁陷阱', description: '牵引附近弹药并冻结', radius: 133, blockDamage: 2, color: [98, 200, 247] },
  { id: 'magnet-impact', name: '引力爆弹', description: '大范围震荡击退', radius: 147, blockDamage: 3, color: [154, 131, 253] },
  { id: 'bounce-ice', name: '冰晶连弹', description: '范围冰冻与碎字', radius: 115, blockDamage: 2, color: [90, 219, 233] },
  { id: 'bounce-impact', name: '震荡弹', description: '震荡波击碎方块', radius: 140, blockDamage: 3, color: [247, 159, 74] },
  { id: 'ice-impact', name: '破冰弹', description: '破冰爆裂与冲击', radius: 145, blockDamage: 3, color: [111, 186, 249] },
  { id: 'bounce-magnet', name: '回旋磁弹', description: '强力牵引旧弹药', radius: 165, blockDamage: 2, color: [124, 166, 244] },
];
const ORDER: AmmoType[] = ['bounce', 'magnet', 'ice', 'impact'];

export function getFusionRecipe(a: AmmoType, b: AmmoType): FusionRecipe | null {
  if (a === b) return null;
  const key = [a, b].sort((x, y) => ORDER.indexOf(x) - ORDER.indexOf(y)).join('-');
  return FUSION_RECIPES.find((recipe) => recipe.id === key) || null;
}

export function chainPoints(base: number, events: number, extra = 0): number {
  if (!Number.isFinite(base) || base < 0 || !Number.isFinite(events)) return 0;
  const count = Math.max(1, Math.min(12, Math.floor(events)));
  const multiplier = Math.min(4.2, 1 + (count - 1) * (0.28 + Math.max(0, extra)));
  return Math.round(base * multiplier);
}
