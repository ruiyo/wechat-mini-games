import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CircleCollider2D, Contact2DType, Graphics, Node, RigidBody2D, Vec2,
} from 'cc';
import { PuckInteractionSystem } from '../../games/puck-battle/assets/scripts/PuckInteractionSystem';
import { WORD_DEFINITIONS } from '../../games/puck-battle/assets/scripts/WordDictionary';
import { AmmoFactory } from '../../games/puck-battle/assets/scripts/AmmoFactory';
import type { AmmoType } from '../../games/puck-battle/assets/scripts/WordDictionary';

function puck(index: number, type: AmmoType, x: number, y: number, vx = 0, vy = 0) {
  const definition = WORD_DEFINITIONS.find((value) => value.ammoType === type)!;
  const node = new Node('Puck-' + index);
  node.setPosition(x, y);
  const body = new RigidBody2D();
  body.linearVelocity = new Vec2(vx, vy);
  const collider = new CircleCollider2D();
  return {
    index, node, body, collider, ammo: AmmoFactory.create(definition),
    freezeRemaining: 0,
  };
}

function beginBoth(a: ReturnType<typeof puck>, b: ReturnType<typeof puck>): void {
  a.collider.emitContact(Contact2DType.BEGIN_CONTACT, b.collider);
  b.collider.emitContact(Contact2DType.BEGIN_CONTACT, a.collider);
}

test('first start, repeated restart, and home return never throw', () => {
  const system = new PuckInteractionSystem();
  assert.doesNotThrow(() => system.reset());
  assert.doesNotThrow(() => system.reset());
  const old = puck(0, 'bounce', 70, 0);
  const active = puck(1, 'impact', 0, 0, 320);
  system.register(old);
  system.register(active);
  system.register(active);
  assert.equal(active.collider.listenerCount(Contact2DType.BEGIN_CONTACT), 1);
  system.beginShot(active);
  beginBoth(old, active);
  assert.equal(system.update(1 / 60).length, 1);
  assert.equal(system.collisionCount, 1);
  assert.doesNotThrow(() => system.reset());
  assert.equal(system.collisionCount, 0);
  assert.equal(old.collider.listenerCount(Contact2DType.BEGIN_CONTACT), 0);
  assert.equal(active.collider.listenerCount(Contact2DType.BEGIN_CONTACT), 0);
  assert.doesNotThrow(() => system.unregister(old));
  assert.doesNotThrow(() => system.reset());
  const next = puck(2, 'ice', 40, 0, 80);
  system.register(next);
  assert.equal(next.collider.listenerCount(Contact2DType.BEGIN_CONTACT), 1);
  system.reset();
});

test('impact transfers additional velocity to old puck ONLY on contact', () => {
  const system = new PuckInteractionSystem();
  const old = puck(0, 'bounce', 60, 0);
  const shot = puck(1, 'impact', 0, 0, 360);
  system.register(old);
  system.register(shot);
  system.beginShot(shot);
  assert.equal(system.update(1 / 60).length, 0);
  assert.equal(old.body.linearVelocity.x, 0);
  beginBoth(old, shot);
  const feedback = system.update(1 / 60);
  assert.equal(feedback.length, 1);
  assert.match(feedback[0].text, /重击/);
  assert.ok(old.body.linearVelocity.x >= 95);
  assert.equal(system.collisionCount, 1);
  assert.ok(old.body.wakeCount > 0);
  const orphan = new CircleCollider2D();
  shot.collider.emitContact(Contact2DType.BEGIN_CONTACT, orphan);
  assert.equal(system.update(1 / 60).length, 0);
  assert.equal(system.collisionCount, 1);
});

test('ice contact slows the old puck, then damping returns to normal', () => {
  const system = new PuckInteractionSystem();
  const old = puck(0, 'bounce', 50, 0, 40);
  const shot = puck(1, 'ice', 0, 0, 360);
  system.register(old);
  system.register(shot);
  system.beginShot(shot);
  beginBoth(old, shot);
  const feedback = system.update(1 / 60);
  assert.match(feedback[0].text, /冰封/);
  assert.ok(Math.abs(old.body.linearVelocity.x) < 10);
  assert.ok(old.freezeRemaining > 0);
  assert.ok(old.body.linearDamping > old.ammo.linearDamping);
  system.update(2);
  assert.equal(old.freezeRemaining, 0);
  assert.equal(old.body.linearDamping, old.ammo.linearDamping);
  system.reset();
});

test('magnetic field pulls nearby pucks, and draws without allocating Nodes', () => {
  const system = new PuckInteractionSystem();
  const old = puck(0, 'bounce', 70, 0);
  const shot = puck(1, 'magnet', 0, 0, 220);
  system.register(old);
  system.register(shot);
  system.beginShot(shot);
  system.update(1 / 60);
  assert.ok(old.body.linearVelocity.x < 0);
  assert.ok(old.body.wakeCount > 0);
  const graphics = new Graphics();
  assert.doesNotThrow(() => system.draw(graphics, 0.08, true, 0, 0, 110, 19));
  assert.ok(graphics.draws > 0);
  system.reset();
  const before = old.body.linearVelocity.x;
  system.update(1 / 60);
  assert.equal(old.body.linearVelocity.x, before);
});

test('bounce displays contact feedback without additional manual impulse', () => {
  const system = new PuckInteractionSystem();
  const old = puck(0, 'ice', 60, 0, 0);
  const shot = puck(1, 'bounce', 0, 0, 250);
  system.register(old);
  system.register(shot);
  system.beginShot(shot);
  beginBoth(old, shot);
  assert.match(system.update(1 / 60)[0].text, /弹开/);
  assert.equal(old.body.linearVelocity.x, 0);
  assert.equal(system.collisionCount, 1);
  system.reset();
});
