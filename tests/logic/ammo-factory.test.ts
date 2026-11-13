import test from 'node:test';
import assert from 'node:assert/strict';

import { WORD_DEFINITIONS } from '../../games/puck-battle/assets/scripts/WordDictionary';
import { AmmoFactory } from '../../games/puck-battle/assets/scripts/AmmoFactory';

test('each dictionary ammo type creates a complete, bounded ammo definition', () => {
  const types = ['bounce', 'magnet', 'ice', 'impact'] as const;

  for (const type of types) {
    const word = WORD_DEFINITIONS.find((entry) => entry.ammoType === type);
    assert.ok(word, `missing dictionary entry for ${type}`);

    const ammo = AmmoFactory.create(word);
    assert.equal(ammo.type, type);
    assert.equal(ammo.word, word.word);
    assert.equal(ammo.name, word.ammoName);
    assert.equal(ammo.color.length, 3);
    assert.ok(ammo.launchSpeedMultiplier > 0);
    assert.ok(ammo.density > 0);
    assert.ok(ammo.restitution >= 0 && ammo.restitution <= 1);
    assert.ok(ammo.friction >= 0);
    assert.ok(ammo.linearDamping >= 0);
  }
});

test('ammo definitions are independent objects', () => {
  const word = WORD_DEFINITIONS.find((entry) => entry.ammoType === 'bounce');
  assert.ok(word);

  const first = AmmoFactory.create(word);
  const second = AmmoFactory.create(word);

  assert.notEqual(first, second);
  assert.equal(first.type, second.type);
  assert.deepEqual(first.color, second.color);
});

test('four ammo types have distinct, purposeful handling profiles', () => {
  const byType = new Map(
    WORD_DEFINITIONS.map((word) => [word.ammoType, AmmoFactory.create(word)]),
  );
  const bounce = byType.get('bounce')!;
  const magnet = byType.get('magnet')!;
  const ice = byType.get('ice')!;
  const impact = byType.get('impact')!;

  assert.ok(bounce.restitution > magnet.restitution);
  assert.ok(bounce.restitution > ice.restitution);
  assert.ok(ice.friction > bounce.friction);
  assert.ok(magnet.magnetSteer > 0);
  assert.equal(bounce.magnetSteer, 0);
  assert.ok(ice.targetDamping > ice.linearDamping);
  assert.ok(impact.launchSpeedMultiplier > bounce.launchSpeedMultiplier);
  assert.ok(impact.density > bounce.density);
  assert.ok(bounce.restitution >= 0.9);
  assert.ok(magnet.magnetRange >= 120);
  assert.ok(magnet.magnetAcceleration > 0);
  assert.equal(impact.magnetRange, 0);
  assert.equal(ice.magnetRange, 0);
  assert.ok(ice.targetDamping > 6);
  assert.ok(magnet.magnetRange >= 200);
  assert.ok(magnet.magnetAcceleration >= 1500);
  assert.match(magnet.description, /牵引/);
  assert.match(ice.description, /冻结/);
});
