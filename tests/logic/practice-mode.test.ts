import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUCK_CONFIG, WORD_UI_CONFIG } from '../../games/puck-battle/assets/scripts/GameConfig';

const bootstrap = readFileSync('games/puck-battle/assets/scripts/PuckBattleBootstrap.ts', 'utf8');

test('practice mode is a dedicated menu option with matching hit testing', () => {
  assert.match(bootstrap, /MenuPracticeButton', '碰撞练习'/);
  assert.match(bootstrap, /this\.withinBox\(point, 0, -207, 322, 70\)/);
  assert.match(bootstrap, /this\.practiceMode = true;\s*this\.startRun\(\)/);
  assert.match(bootstrap, /this\.practiceMode = false;\s*this\.startRun\(\)/);
});

test('four accessible ammo controls fit the practice word tray on portrait phones', () => {
  const width = 720;
  const buttonWidth = 118;
  const centers = [-0.3, -0.1, 0.1, 0.3].map((ratio) => width * ratio);
  for (let i = 0; i < centers.length; i++) {
    assert.ok(Math.abs(centers[i]) + buttonWidth / 2 < width * 0.92 / 2);
    if (i > 0) assert.ok(centers[i] - centers[i - 1] > buttonWidth);
  }
  assert.match(bootstrap, /PRACTICE_AMMO_TYPES: AmmoType\[\] = \['bounce', 'magnet', 'ice', 'impact'\]/);
  assert.match(bootstrap, /this\.handlePracticeAmmoInput\(point\);/);
  assert.match(bootstrap, /const wordVisible = visible && !this\.practiceMode/);
  assert.match(bootstrap, /const practiceVisible = visible && this\.practiceMode/);
  assert.ok(WORD_UI_CONFIG.tileYRatio > 0.25 && WORD_UI_CONFIG.tileYRatio < 0.45);
});

test('practice starts with at most two physical target pucks and unique ids', () => {
  assert.match(bootstrap, /private spawnPracticeTargets\(\): void/);
  assert.match(bootstrap, /const types: AmmoType\[\] = \['bounce', 'ice'\]/);
  assert.match(bootstrap, /this\.spawnPuck\(AmmoFactory\.create\(word\), new Vec2\(x, y\)\)/);
  assert.match(bootstrap, /const index = this\.nextPuckIndex\+\+/);
  assert.match(bootstrap, /this\.nextPuckIndex = 0/);
  assert.ok(PUCK_CONFIG.maxActivePucks >= 3);
});

test('practice allows repeated shots without polluting normal player records', () => {
  assert.match(bootstrap, /if \(!this\.practiceMode && this\.missCount >= PUCK_CONFIG\.maxMisses\)/);
  assert.match(bootstrap, /if \(!this\.practiceMode\) \{\s*this\.bestScore = SaveManager\.saveBestScore/);
  assert.match(bootstrap, /this\.practiceMode = false;\s*this\.restartRun\(\)/);
  assert.match(bootstrap, /if \(this\.practiceMode && this\.physicsReady\) this\.spawnPracticeTargets\(\)/);
  assert.match(bootstrap, /this\.bestLabel\.string = this\.practiceMode/);
});
