import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateAim } from '../../games/puck-battle/assets/scripts/AimRules';
import { AIM_CONFIG, PUCK_CONFIG } from '../../games/puck-battle/assets/scripts/GameConfig';

test('tap and short accidental drags do not launch', () => {
  for (const distance of [0, 2, PUCK_CONFIG.minPullDistance - 1]) {
    const aim = calculateAim(0, 0, -distance, 0);
    assert.equal(aim.ready, false);
    assert.equal(aim.speed, 0);
  }
});

test('shot strength grows monotonically with a larger control range', () => {
  const pulls = [20, 35, 60, 90, 120, 155, 180, 205, 260];
  const shots = pulls.map(d => calculateAim(0, 0, 0, -d));
  for (let i = 1; i < shots.length; i += 1) {
    assert.ok(shots[i].speed >= shots[i - 1].speed);
  }
  assert.ok(shots[3].strength < 0.5, 'medium pull uses finer low-power control');
  assert.equal(shots[7].strength, 1);
  assert.equal(shots[7].speed, shots[8].speed, 'power clamps at the maximum pull');
  assert.equal(shots[7].speed, PUCK_CONFIG.maxLaunchSpeed);
});

test('pull direction matches finger displacement and is independent of puck position', () => {
  const shot = calculateAim(30, -55, -70, -155);
  assert.ok(Math.abs(shot.directionX - Math.SQRT1_2) < 0.0001);
  assert.ok(Math.abs(shot.directionY - Math.SQRT1_2) < 0.0001);
});

test('speed multipliers apply after dead zone and preserve direction', () => {
  const one = calculateAim(0, 0, 0, -130);
  const fast = calculateAim(0, 0, 0, -130, 1.2);
  assert.ok(Math.abs(fast.speed - one.speed * 1.2) < 0.00001);
  assert.equal(fast.directionY, 1);
  assert.ok(AIM_CONFIG.powerExponent > 1);
});
