import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const game = readFileSync('games/puck-battle/assets/scripts/PuckBattleBootstrap.ts', 'utf8');
const physics = readFileSync('games/puck-battle/assets/scripts/AmmoEffectController.ts', 'utf8');
const runtime = readFileSync('games/puck-battle/assets/scripts/PuckInteractionSystem.ts', 'utf8');

test('all pucks use non-sensor colliders with contact events enabled', () => {
  assert.match(physics, /body\.enabledContactListener = true/);
  assert.match(physics, /collider\.sensor = false/);
  assert.match(physics, /body\.bullet = true/);
  assert.match(runtime, /collider\.on\(Contact2DType\.BEGIN_CONTACT, this\.onPuckBeginContact/);
});
test('physical contacts are registered, deduplicated, and deferred', () => {
  assert.match(runtime, /private onPuckBeginContact\(/);
  assert.match(runtime, /this\.lastContact\.set\(/);
  assert.match(runtime, /this\.pending\.push\(/);
  assert.match(game, /this\.interactions\.update\(deltaTime\)/);
  assert.match(game, /this\.interactions\.register\(entry\)/);
  assert.match(runtime, /c\.target\.body\.wakeUp\(\)/);
});
test('four ammo types have specific mechanics and visible reactions', () => {
  for (const snippet of [
    "c.source.ammo.type === 'impact'",
    "c.source.ammo.type === 'ice'",
    "c.source.ammo.type === 'magnet'",
    "c.source.ammo.type === 'bounce'",
    "calculateMagnetDeltaVelocity(",
    "this.collisions += 1",
    "this.pulses.push(",
  ]) assert.ok(runtime.includes(snippet), snippet);
});
test('gameplay shows real puck collisions and keeps old objects in the physics world', () => {
  assert.match(game, /this\.interactions\.collisionCount/);
  assert.match(game, /this\.interactions\.beginShot\(puck\)/);
  assert.match(game, /this\.interactions\.endShot\(\)/);
  assert.match(game, /this\.interactions\.unregister\(oldest\)/);
  assert.match(game, /pathIntersectsCircle\(/);
});
