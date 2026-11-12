import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERACTION_CONFIG, calculatePuckContact,
  calculateImpactPush, calculateMagnetDeltaVelocity,
  pathIntersectsCircle,
} from '../../games/puck-battle/assets/scripts/PuckInteractionRules';

test('head-on closing contact and separating motion are distinguished', () => {
  const hit = calculatePuckContact(0, 0, 400, 0, 38, 0, 0, 0);
  assert.equal(hit.nx, 1);
  assert.equal(hit.closingSpeed, 400);
  assert.equal(hit.relativeSpeed, 400);
  const separating = calculatePuckContact(0, 0, -200, 0, 38, 0, 200, 0);
  assert.equal(separating.closingSpeed, 0);
});
test('contact normal handles overlapping centers', () => {
  const hit = calculatePuckContact(0, 0, 100, 0, 0, 0, 0, 0);
  assert.ok(Number.isFinite(hit.nx) && Number.isFinite(hit.ny));
  assert.equal(hit.closingSpeed, 100);
});
test('impact knockback is speed-dependent and bounded', () => {
  assert.equal(calculateImpactPush(0), 0);
  assert.equal(calculateImpactPush(20), 0);
  assert.equal(calculateImpactPush(100), INTERACTION_CONFIG.impactMinPush);
  assert.ok(calculateImpactPush(350) > calculateImpactPush(100));
  assert.equal(calculateImpactPush(10000), INTERACTION_CONFIG.impactMaxPush);
});
test('magnet pulls only nearby old pucks and caps one-frame acceleration', () => {
  const close = calculateMagnetDeltaVelocity(35, 0, 1 / 60);
  assert.ok(close.x > 0 && close.y === 0);
  assert.deepEqual(calculateMagnetDeltaVelocity(160, 0, 1 / 60), { x: 0, y: 0 });
  assert.deepEqual(calculateMagnetDeltaVelocity(0, 0, 1 / 60), { x: 0, y: 0 });
  assert.deepEqual(calculateMagnetDeltaVelocity(40, 0, 0), { x: 0, y: 0 });
  const huge = calculateMagnetDeltaVelocity(20, 0, 10);
  assert.ok(Math.hypot(huge.x, huge.y) <= INTERACTION_CONFIG.magnetMaxDeltaVelocity);
});
test('aiming guide reports candidate old-puck intersections', () => {
  const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  assert.equal(pathIntersectsCircle(path, 50, 10, 18), true);
  assert.equal(pathIntersectsCircle(path, 50, 50, 18), false);
  assert.equal(pathIntersectsCircle(path, 115, 0, 18), true);
});
