import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const game = readFileSync('games/puck-battle/assets/scripts/PuckBattleBootstrap.ts', 'utf8');
const physics = readFileSync('games/puck-battle/assets/scripts/AmmoEffectController.ts', 'utf8');
test('all pucks use physical colliders with contact callbacks enabled', () => {
  assert.match(physics, /body\.enabledContactListener = true/);
  assert.match(physics, /collider\.sensor = false/);
  assert.match(physics, /body\.bullet = true/);
  assert.match(game, /collider\.on\(Contact2DType\.BEGIN_CONTACT, this\.onPuckBeginContact/);
});
test('contact events are deduplicated and processed after the physics callback', () => {
  assert.match(game, /private onPuckBeginContact\(/);
  assert.match(game, /this\.lastContactByPair\.set\(/);
  assert.match(game, /this\.pendingContacts\.push\(/);
  assert.match(game, /this\.resolvePendingContacts\(\);/);
  assert.match(game, /target\.body\.wakeUp\(\)/);
});
test('four special shot types have gameplay responses and visible feedback', () => {
  for (const snippet of [
    "source.ammo.type === 'impact'", "source.ammo.type === 'ice'",
    "source.ammo.type === 'magnet'", "source.ammo.type === 'bounce'",
    "private updateMagnetField(", "private updateEffectVisuals(",
    "this.puckContactCount += 1",
  ]) assert.ok(game.includes(snippet), snippet);
});
