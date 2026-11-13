import type { AmmoType } from './WordDictionary';
import type { AmmoDefinition } from './AmmoFactory';

export const ARCADE_STAGE_COUNT = 4;
export type UpgradeId =
  'magnet' | 'ice' | 'impact' | 'bounce' | 'velocity' |
  'chain' | 'glyph' | 'ammo' | 'extra';

export interface UpgradeDefinition {
  id: UpgradeId;
  title: string;
  description: string;
}
export const UPGRADES: UpgradeDefinition[] = [
  { id: 'magnet', title: '磁力共振', description: '磁场范围与牵引强度提升 30%' },
  { id: 'ice', title: '极寒结晶', description: '冰冻弹减速能力提升 40%' },
  { id: 'impact', title: '重型弹头', description: '冲击弹质量提升 35%' },
  { id: 'bounce', title: '回弹大师', description: '弹跳弹碰撞弹性提升' },
  { id: 'velocity', title: '超能发射', description: '所有弹药发射速度提升 12%' },
  { id: 'chain', title: '连锁大师', description: '连锁得分系数提升 30%' },
  { id: 'glyph', title: '破字高手', description: '所有弹药对汉字块额外 +1 伤害' },
  { id: 'ammo', title: '弹药工坊', description: '所有弹药得分系数提升 15%' },
  { id: 'extra', title: '额外弹仓', description: '每关可用发射次数 +2' },
];

export interface GlyphBlockSeed {
  id: number;
  glyph: string;
  x: number; // Fraction of arena width from centre.
  y: number; // Fraction of arena height from arena centre.
  hp: number;
  boss: boolean;
}
export interface ArcadeStage {
  number: number;
  name: string;
  shotLimit: number;
  blocks: GlyphBlockSeed[];
}

/** Deterministic, browser-independent RNG: daily runs share exact layouts. */
export function makeSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
const GLYPHS = '弹跳磁吸冰冻冲击反击力回冷封寒弹射撞击震荡';
const STAGE_NAMES = ['字块练习', '双排机关', '连锁试炼', '字王挑战'];
const X_SLOTS = [-0.31, -0.15, 0, 0.15, 0.31];
const Y_SLOTS = [0.13, 0.27];

export function generateArcadeStage(seed: number, stage: number): ArcadeStage {
  const number = Math.max(1, Math.min(ARCADE_STAGE_COUNT, Math.floor(stage)));
  const rng = seededRandom((seed ^ (number * 0x9E3779B1)) >>> 0);
  const total = number === 1 ? 4 : number === 2 ? 5 : number === 3 ? 6 : 5;
  const blocks: GlyphBlockSeed[] = [];
  for (let i = 0; i < total; i++) {
    // The boss stays in the final upper centre slot. Other blocks form
    // staggered rows that can be shot at from the launch zone.
    const boss = number === 4 && i === 2;
    const xSlot = i % 5;
    const row = Math.floor(i / 5);
    blocks.push({
      id: number * 100 + i,
      glyph: boss ? '王' : GLYPHS[Math.floor(rng() * GLYPHS.length)],
      x: X_SLOTS[xSlot],
      y: Y_SLOTS[row] + (number === 4 && !boss ? -0.05 : 0),
      hp: boss ? 5 : number === 1 ? 1 : (rng() < 0.45 ? 2 : 1),
      boss,
    });
  }
  // Keep the opening stage centred so every player can reach its targets.
  if (number === 1) {
    blocks[0].x = -0.24; blocks[1].x = -0.08;
    blocks[2].x = 0.08; blocks[3].x = 0.24;
  }
  return {
    number, name: STAGE_NAMES[number - 1],
    shotLimit: [8, 8, 10, 12][number - 1],
    blocks,
  };
}

export function offerUpgrades(seed: number, afterStage: number): UpgradeDefinition[] {
  const rng = seededRandom(seed ^ (afterStage * 65537) ^ 0x12345);
  const shuffled = UPGRADES.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled.slice(0, 3);
}

export class ArcadeRunProgress {
  stage = 1;
  shotsThisStage = 0;
  totalBlocks = 0;
  destroyedBlocks = 0;
  readonly upgrades: UpgradeId[] = [];
  constructor(readonly seed: number, readonly isDaily = false) {}
  get stageConfig(): ArcadeStage { return generateArcadeStage(this.seed, this.stage); }
  get shotLimit(): number {
    return this.stageConfig.shotLimit + this.upgrades.filter((id) => id === 'extra').length * 2;
  }
  get shotsLeft(): number { return Math.max(0, this.shotLimit - this.shotsThisStage); }
  get cleared(): boolean { return this.totalBlocks > 0 && this.destroyedBlocks >= this.totalBlocks; }
  get complete(): boolean { return this.cleared && this.stage === ARCADE_STAGE_COUNT; }
  get failed(): boolean { return !this.cleared && this.shotsLeft === 0; }
  startStage(): ArcadeStage {
    const config = this.stageConfig;
    this.shotsThisStage = 0;
    this.destroyedBlocks = 0;
    this.totalBlocks = config.blocks.length;
    return config;
  }
  recordShot(): void { this.shotsThisStage += 1; }
  recordDestroyed(): void {
    this.destroyedBlocks = Math.min(this.totalBlocks, this.destroyedBlocks + 1);
  }
  applyUpgrade(id: UpgradeId): boolean {
    if (!UPGRADES.some((upgrade) => upgrade.id === id)) return false;
    this.upgrades.push(id);
    return true;
  }
  get upgradeChoices(): UpgradeDefinition[] { return offerUpgrades(this.seed, this.stage); }
  advance(): boolean {
    if (!this.cleared || this.stage >= ARCADE_STAGE_COUNT) return false;
    this.stage += 1;
    this.startStage();
    return true;
  }
  count(id: UpgradeId): number { return this.upgrades.filter((x) => x === id).length; }
  modifyAmmo(ammo: AmmoDefinition): AmmoDefinition {
    const next: AmmoDefinition = { ...ammo };
    next.launchSpeedMultiplier *= Math.pow(1.12, this.count('velocity'));
    next.scoreMultiplier *= Math.pow(1.15, this.count('ammo'));
    if (next.type === 'magnet') {
      next.magnetRange *= Math.pow(1.3, this.count('magnet'));
      next.magnetAcceleration *= Math.pow(1.3, this.count('magnet'));
    }
    if (next.type === 'ice') next.targetDamping *= Math.pow(1.4, this.count('ice'));
    if (next.type === 'impact') next.density *= Math.pow(1.35, this.count('impact'));
    if (next.type === 'bounce') next.restitution = Math.min(1, next.restitution + this.count('bounce') * 0.05);
    return next;
  }
  get blockDamageBonus(): number { return this.count('glyph'); }
  get chainBonus(): number { return 0.3 * this.count('chain'); }
}

/** Stable UTC date for equal daily challenge on all players' devices. */
export function dailyChallengeId(date: Date): string {
  return date.getUTCFullYear().toString() + '-' +
    String(date.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(date.getUTCDate()).padStart(2, '0');
}
export function dailyChallengeSeed(date: Date): number {
  return makeSeed('word-puck-daily:' + dailyChallengeId(date));
}
