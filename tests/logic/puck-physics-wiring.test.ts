import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const game = readFileSync('games/puck-battle/assets/scripts/PuckBattleBootstrap.ts', 'utf8');
const physics = readFileSync('games/puck-battle/assets/scripts/AmmoEffectController.ts', 'utf8');
const runtime = readFileSync('games/puck-battle/assets/scripts/PuckInteractionSystem.ts', 'utf8');

test('pucks register physical contact events and keep sensor disabled', () => {
  assert.match(physics, /body\.enabledContactListener = true/);
  assert.match(physics, /collider\.sensor = false/);
  assert.match(physics, /body\.bullet = true/);
  assert.match(runtime, /collider\.on\(Contact2DType\.BEGIN_CONTACT, this\.onPuckBeginContact/);
});

test('puck cleanup is repeatable and does not downlevel Map iterators', () => {
  assert.match(runtime, /private readonly registered = new StableColliderRegistry/);
  assert.match(runtime, /const removed = this\.registered\.clear\(\)/);
  assert.match(runtime, /this\.detachContactListener\(puck\.collider\)/);
  assert.match(runtime, /if \(!previous\) return/);
  assert.ok(!runtime.includes('this.registered.values()'),
    'Map iterators break when compiled to the legacy Cocos JavaScript target');
  assert.ok(!runtime.includes('[...this.registered'),
    'never spread a Map iterator in a Cocos runtime reset');
  assert.equal((runtime.match(/this\.registered\.snapshot\(\)/g) || []).length, 4);
});

test('physics contacts are registered, deduplicated and processed on the next update', () => {
  assert.match(runtime, /private onPuckBeginContact\(/);
  assert.match(runtime, /this\.lastContact\.set\(/);
  assert.match(runtime, /this\.pending\.push\(/);
  assert.match(game, /this\.interactions\.update\(deltaTime\)/);
  assert.match(game, /this\.interactions\.register\(entry\)/);
  assert.match(runtime, /c\.target\.body\.wakeUp\(\)/);
});

test('all four ammo types have active physics effects and collision feedback', () => {
  for (const snippet of [
    "c.source.ammo.type === 'impact'", "c.source.ammo.type === 'ice'",
    "c.source.ammo.type === 'magnet'", "c.source.ammo.type === 'bounce'",
    "calculateMagnetDeltaVelocity(", "this.collisions += 1", "this.pulses.push(",
  ]) assert.ok(runtime.includes(snippet), snippet);
});

test('restart and other game flows release the collision system', () => {
  assert.match(game, /this\.interactions\.collisionCount/);
  assert.match(game, /this\.interactions\.beginShot\(puck\)/);
  assert.match(game, /this\.interactions\.endShot\(\)/);
  assert.match(game, /this\.interactions\.unregister\(oldest\)/);
  assert.match(game, /private restartRun\(\): void \{\s*this\.interactions\.reset\(\)/);
  assert.match(game, /pathIntersectsCircle\(/);
});
