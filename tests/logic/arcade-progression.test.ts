import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARCADE_STAGE_COUNT, ArcadeRunProgress, UPGRADES, dailyChallengeId,
  dailyChallengeSeed, generateArcadeStage, makeSeed, offerUpgrades,
} from '../../games/puck-battle/assets/scripts/ArcadeProgression';
import { WORD_DEFINITIONS } from '../../games/puck-battle/assets/scripts/WordDictionary';
import { AmmoFactory } from '../../games/puck-battle/assets/scripts/AmmoFactory';
import { FUSION_RECIPES, chainPoints, getFusionRecipe } from '../../games/puck-battle/assets/scripts/FusionRules';

test('each adventure has four reproducible but different tile stages and a boss', () => {
  const seed = makeSeed('my-run-101');
  assert.equal(ARCADE_STAGE_COUNT, 4);
  const stages = [1, 2, 3, 4].map((index) => generateArcadeStage(seed, index));
  assert.deepEqual(stages[0], generateArcadeStage(seed, 1));
  assert.notDeepEqual(stages[0], generateArcadeStage(makeSeed('other'), 1));
  assert.deepEqual(stages.map((s) => s.blocks.length), [4, 5, 6, 5]);
  assert.equal(stages[3].blocks.filter((block) => block.boss).length, 1);
  assert.equal(stages[3].blocks.find((block) => block.boss)?.hp, 5);
  assert.ok(stages.every((s) => s.shotLimit > 4));
});

test('three-upgrade offers are deterministic, unique and mechanically active', () => {
  const seed = makeSeed('second-run');
  const options = offerUpgrades(seed, 1);
  assert.deepEqual(options, offerUpgrades(seed, 1));
  assert.equal(options.length, 3);
  assert.equal(new Set(options.map((o) => o.id)).size, 3);
  assert.ok(UPGRADES.length >= 9);
  const run = new ArcadeRunProgress(seed);
  const stage = run.startStage();
  assert.equal(run.totalBlocks, stage.blocks.length);
  assert.ok(run.applyUpgrade('magnet'));
  assert.ok(run.applyUpgrade('extra'));
  assert.ok(run.applyUpgrade('chain'));
  assert.ok(run.applyUpgrade('glyph'));
  assert.equal(run.shotLimit, stage.shotLimit + 2);
  assert.equal(run.blockDamageBonus, 1);
  assert.ok(run.chainBonus > 0);
  const magnet = AmmoFactory.create(WORD_DEFINITIONS.find((def) => def.ammoType === 'magnet')!);
  assert.ok(run.modifyAmmo(magnet).magnetRange > magnet.magnetRange);
  assert.ok(run.modifyAmmo(magnet).magnetAcceleration > magnet.magnetAcceleration);
  for (let i = 0; i < stage.blocks.length; i++) run.recordDestroyed();
  assert.ok(run.cleared);
  assert.ok(run.advance());
  assert.equal(run.stage, 2);
  assert.equal(run.shotsThisStage, 0);
  assert.equal(run.destroyedBlocks, 0);
});

test('failure and success use tile objectives, not the old five-miss score loop', () => {
  const run = new ArcadeRunProgress(123);
  run.startStage();
  for (let i = 0; i < run.shotLimit; i++) run.recordShot();
  assert.ok(run.failed);
  assert.ok(!run.cleared);
  assert.ok(!run.complete);
  for (let i = 0; i < run.totalBlocks; i++) run.recordDestroyed();
  assert.ok(run.cleared);
  assert.ok(!run.failed);
});

test('daily identifier and full content seed agree in all time zones', () => {
  const japan = new Date('2026-11-13T10:20:00+09:00');
  const utc = new Date('2026-11-13T01:20:00Z');
  assert.equal(dailyChallengeId(japan), dailyChallengeId(utc));
  assert.equal(dailyChallengeSeed(japan), dailyChallengeSeed(utc));
  assert.notEqual(dailyChallengeSeed(japan), dailyChallengeSeed(new Date('2026-11-14T01:20:00Z')));
});

test('all six unordered special-ammo combinations resolve to distinct abilities', () => {
  const types = ['bounce', 'magnet', 'ice', 'impact'] as const;
  const seen = new Set<string>();
  for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
      const forward = getFusionRecipe(types[i], types[j]);
      const backward = getFusionRecipe(types[j], types[i]);
      assert.ok(forward);
      assert.deepEqual(forward, backward);
      seen.add(forward!.id);
      assert.equal(getFusionRecipe(types[i], types[i]), null);
    }
  }
  assert.equal(seen.size, 6);
  assert.equal(FUSION_RECIPES.length, 6);
  assert.ok(FUSION_RECIPES.every((recipe) => recipe.radius > 80 && recipe.blockDamage >= 2));
});

test('chain scoring rewards multiple linked impacts but has a hard cap', () => {
  assert.equal(chainPoints(100, 1), 100);
  assert.ok(chainPoints(100, 2) > 100);
  assert.ok(chainPoints(100, 6, 0.3) > chainPoints(100, 6));
  assert.ok(chainPoints(100, 1000, 999) <= 420);
  assert.equal(chainPoints(-1, 3), 0);
});
