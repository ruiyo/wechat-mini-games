import test from 'node:test';
import assert from 'node:assert/strict';
import { predictWallBouncePath } from '../../games/puck-battle/assets/scripts/AimRules';
const bounds = { left: -100, right: 100, bottom: -100, top: 100 };
test('straight preview is bounded and precise', () => {
  assert.deepEqual(predictWallBouncePath(0, 0, 0, 1, 80, bounds),
    [{ x: 0, y: 0 }, { x: 0, y: 80 }]);
});
test('preview reflects off walls but respects bounce cap', () => {
  const points = predictWallBouncePath(0, 0, 1, 0, 270, bounds, 1);
  assert.equal(points.length, 3);
  assert.ok(Math.abs(points[1].x - 100) < 0.000001);
  assert.ok(Math.abs(points[2].x + 70) < 0.000001);
  assert.deepEqual(predictWallBouncePath(0, 0, 1, 0, 250, bounds, 0),
    [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  for (const point of predictWallBouncePath(0, 0, 2, 1, 460, bounds, 3)) {
    assert.ok(point.x >= -100 && point.x <= 100);
    assert.ok(point.y >= -100 && point.y <= 100);
  }
});
test('zero and invalid vectors never generate non-finite points', () => {
  assert.deepEqual(predictWallBouncePath(0, 0, NaN, 1, 100, bounds), [{ x: 0, y: 0 }]);
  assert.deepEqual(predictWallBouncePath(0, 0, 0, 0, 100, bounds), [{ x: 0, y: 0 }]);
});
