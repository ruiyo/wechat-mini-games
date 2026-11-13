import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CircleCollider2D, Contact2DType, Node, RigidBody2D, Vec2,
} from 'cc';
import { PuckInteractionSystem } from '../../games/puck-battle/assets/scripts/PuckInteractionSystem';
import { AmmoFactory } from '../../games/puck-battle/assets/scripts/AmmoFactory';
import { WORD_DEFINITIONS } from '../../games/puck-battle/assets/scripts/WordDictionary';

function bounce(index: number, x: number, vx = 0) {
  const node = new Node('Puck-' + index);
  node.setPosition(x, 0);
  const body = new RigidBody2D();
  body.linearVelocity = new Vec2(vx, 0);
  return {
    node, body, index, freezeRemaining: 0,
    collider: new CircleCollider2D(),
    ammo: AmmoFactory.create(WORD_DEFINITIONS.find((w) => w.ammoType === 'bounce')!),
  };
}

test('same-type collisions build Lv1-Lv3 resonance without duplicate farming', () => {
  const system = new PuckInteractionSystem();
  const shot = bounce(10, 0, 250);
  system.register(shot);
  system.beginShot(shot);
  for (let i = 0; i < 4; i++) {
    const old = bounce(i, 50 + i * 2);
    system.register(old);
    shot.collider.emitContact(Contact2DType.BEGIN_CONTACT, old.collider);
    old.collider.emitContact(Contact2DType.BEGIN_CONTACT, shot.collider);
    const result = system.update(0.25);
    assert.equal(result.length, 1);
    assert.equal(result[0].resonance, Math.min(3, i + 1));
    assert.equal(result[0].fusion, undefined);
    assert.match(result[0].text, /同型共鸣/);
    assert.equal(old.body.linearVelocity.x, 0);
    assert.ok(shot.body.linearVelocity.x > 250);
    assert.equal(shot.collider.listenerCount(Contact2DType.BEGIN_CONTACT), 1);
    shot.collider.emitContact(Contact2DType.BEGIN_CONTACT, old.collider);
    assert.equal(system.update(0.01).length, 0, 'same pair cannot stack twice');
  }
  assert.equal(system.collisionCount, 4);
  system.reset();
  assert.equal(system.collisionCount, 0);
  assert.equal(shot.collider.listenerCount(Contact2DType.BEGIN_CONTACT), 0);
});

test('resonance power resets when a new shot starts', () => {
  const system = new PuckInteractionSystem();
  const first = bounce(1, 0, 220);
  const old = bounce(0, 40);
  system.register(first);
  system.register(old);
  system.beginShot(first);
  first.collider.emitContact(Contact2DType.BEGIN_CONTACT, old.collider);
  assert.equal(system.update(0.1)[0].resonance, 1);
  system.endShot();
  const next = bounce(2, 0, 220);
  system.register(next);
  system.beginShot(next);
  next.collider.emitContact(Contact2DType.BEGIN_CONTACT, old.collider);
  assert.equal(system.update(0.1)[0].resonance, 1);
  system.reset();
});
