import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CircleCollider2D, Contact2DType, ERigidBody2DType, Graphics, Node, RigidBody2D, Vec2,
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

test('ice contact turns the old puck into an immovable Static body then releases it', () => {
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
  assert.equal(old.body.type, ERigidBody2DType.Static);
  system.endShot();
  system.update(1);
  assert.ok(old.freezeRemaining > 0, 'freeze survives shooting state transition');
  assert.equal(old.body.type, ERigidBody2DType.Static);
  system.update(1.6);
  assert.equal(old.freezeRemaining, 0);
  assert.equal(old.body.type, ERigidBody2DType.Dynamic);
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

test('a resting magnetic shot pulls sleeping pucks and holds the round open', () => {
  const system = new PuckInteractionSystem();
  const old = puck(0, 'bounce', 180, 0, 0);
  const restingMagnet = puck(1, 'magnet', 0, 0, 0);
  system.register(old);
  system.register(restingMagnet);
  system.beginShot(restingMagnet);
  assert.equal(system.shouldDelayShotCompletion, true);
  assert.equal(system.update(1 / 60).some((f) => f.text.includes('磁力牵引')), true);
  assert.ok(old.body.linearVelocity.x < 0, 'previous resting puck moves toward magnet');
  assert.ok(old.body.wakeCount > 0);
  const speed = Math.abs(old.body.linearVelocity.x);
  system.update(1 / 60);
  assert.ok(Math.abs(old.body.linearVelocity.x) > speed);
  const graphics = new Graphics();
  system.draw(graphics, 0.1, true, 0, 0, 100, 19);
  assert.ok(graphics.draws > 3, 'visible ring and pull lines');
  system.update(3.3);
  assert.equal(system.shouldDelayShotCompletion, false, 'field expires predictably');
  system.reset();
});

test('ice area-freeze works without direct contact, and old pucks stay locked', () => {
  const system = new PuckInteractionSystem();
  const nearby = puck(0, 'bounce', 75, 0, 150);
  const faraway = puck(1, 'bounce', 250, 0, 110);
  const ice = puck(2, 'ice', 0, 0, 20);
  system.register(nearby);
  system.register(faraway);
  system.register(ice);
  system.beginShot(ice);
  const notifications = system.update(0.35);
  assert.ok(notifications.some((value) => value.text.includes('寒霜爆发')));
  assert.equal(nearby.body.type, ERigidBody2DType.Static);
  assert.equal(nearby.body.linearVelocity.x, 0);
  assert.ok(nearby.freezeRemaining > 0);
  assert.equal(faraway.body.type, ERigidBody2DType.Dynamic);
  const duration = nearby.freezeRemaining;
  system.endShot();
  system.update(0.3);
  assert.equal(nearby.body.type, ERigidBody2DType.Static);
  assert.ok(nearby.freezeRemaining < duration);
  system.reset();
  assert.equal(nearby.body.type, ERigidBody2DType.Dynamic);
  assert.equal(nearby.freezeRemaining, 0);
});

test('a new magnet or impact shot cannot move a hard-frozen puck', () => {
  const system = new PuckInteractionSystem();
  const old = puck(0, 'bounce', 55, 0);
  const ice = puck(1, 'ice', 0, 0, 340);
  system.register(old);
  system.register(ice);
  system.beginShot(ice);
  beginBoth(old, ice);
  system.update(0.02);
  assert.equal(old.body.type, ERigidBody2DType.Static);
  system.endShot();
  const impact = puck(2, 'impact', 0, 0, 300);
  system.register(impact);
  system.beginShot(impact);
  beginBoth(old, impact);
  const result = system.update(0.02);
  assert.ok(result.some((x) => x.text.includes('无法推动')));
  assert.equal(old.body.linearVelocity.x, 0);
  assert.equal(old.body.type, ERigidBody2DType.Static);
  system.reset();
});

test('ice landing burst works even if shot finished before direct collisions', () => {
  const system = new PuckInteractionSystem();
  const old = puck(0, 'magnet', 90, 0);
  const ice = puck(1, 'ice', 0, 0, 600);
  system.register(old);
  system.register(ice);
  system.beginShot(ice);
  system.endShot();
  assert.equal(old.body.type, ERigidBody2DType.Static);
  system.update(2.5);
  assert.equal(old.body.type, ERigidBody2DType.Dynamic);
  system.reset();
});

test('a single newer-collider callback counts even if older collider sends none', () => {
  const system = new PuckInteractionSystem();
  const old = puck(0, 'bounce', 60, 0);
  const shot = puck(5, 'impact', 0, 0, 340);
  system.register(old);
  system.register(shot);
  system.beginShot(shot);
  // Previously this was silently discarded because self.index > other.index.
  shot.collider.emitContact(Contact2DType.BEGIN_CONTACT, old.collider);
  const notices = system.update(1 / 60);
  assert.equal(notices.length, 1);
  assert.equal(system.collisionCount, 1);
  assert.match(notices[0].text, /重击/);
  assert.ok(old.body.linearVelocity.x > 0);
  // The reverse callback in the same physics step must NOT count it twice.
  old.collider.emitContact(Contact2DType.BEGIN_CONTACT, shot.collider);
  assert.equal(system.update(1 / 60).length, 0);
  assert.equal(system.collisionCount, 1);
  system.reset();
});
