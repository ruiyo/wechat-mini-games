import test from 'node:test';
import assert from 'node:assert/strict';
import { StableColliderRegistry } from '../../games/puck-battle/assets/scripts/StableColliderRegistry';

interface MockPuck { collider: object; name: string; }
test('first launch: empty registry can be cleared repeatedly', () => {
  const registry = new StableColliderRegistry<object, MockPuck>();
  assert.deepEqual(registry.snapshot(), []);
  assert.deepEqual(registry.clear(), []);
  assert.deepEqual(registry.clear(), []);
  assert.equal(registry.size, 0);
});

test('restart: detaches all currently registered objects, then starts fresh', () => {
  const registry = new StableColliderRegistry<object, MockPuck>();
  const one = { collider: {}, name: 'one' };
  const two = { collider: {}, name: 'two' };
  assert.equal(registry.add(one.collider, one), true);
  assert.equal(registry.add(two.collider, two), true);
  assert.deepEqual(registry.snapshot(), [one, two]);
  assert.deepEqual(registry.clear(), [one, two]);
  assert.equal(registry.size, 0);
  assert.equal(registry.get(one.collider), undefined);
  const three = { collider: {}, name: 'three' };
  assert.equal(registry.add(three.collider, three), true);
  assert.deepEqual(registry.snapshot(), [three]);
});

test('unregister and duplicate registration are idempotent', () => {
  const registry = new StableColliderRegistry<object, MockPuck>();
  const a = { collider: {}, name: 'a' };
  const b = { collider: {}, name: 'b' };
  assert.equal(registry.add(a.collider, a), true);
  assert.equal(registry.add(a.collider, a), false);
  assert.equal(registry.add(b.collider, b), true);
  assert.equal(registry.remove(a.collider), a);
  assert.equal(registry.remove(a.collider), undefined);
  assert.deepEqual(registry.snapshot(), [b]);
  assert.equal(registry.size, 1);
});

test('invalid collider entries are rejected rather than crashing cleanup', () => {
  const registry = new StableColliderRegistry<object, MockPuck>();
  const puck = { collider: {}, name: 'safe' };
  assert.equal(registry.add(undefined, puck), false);
  assert.equal(registry.add(null, puck), false);
  assert.equal(registry.remove(undefined), undefined);
  assert.deepEqual(registry.clear(), []);
});
