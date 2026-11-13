import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clipGuideAtObstacles, obstacleGuideLabel, getObstaclesForMode,
  getObstacleVertices,
} from '../../games/puck-battle/assets/scripts/ObstacleLayout';

const stage = getObstaclesForMode('adventure', 2);
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 0.000001,
    `Expected ${actual} to be approximately ${expected}`);

test('clips at first inflated rectangular obstacle, not the farthest one', () => {
  const boxes = [
    { id: 'far', kind: 'brick' as const, x: 0.6, y: 0, width: 20,
      height: 20, angle: 0, restitution: 0.5 },
    { id: 'near', kind: 'bar' as const, x: 0.2, y: 0, width: 20,
      height: 20, angle: 0, restitution: 0.5 },
  ];
  const result = clipGuideAtObstacles(
    [{ x: 0, y: 0 }, { x: 100, y: 0 }], boxes, 100, 100, 0, 5,
  );
  assert.equal(result.contact?.id, 'near');
  assert.equal(result.path.length, 2);
  close(result.path[1].x, 5);
  close(result.contact!.y, 0);
});

test('rotated geometric obstacle is detected using physical polygon vertices', () => {
  const obstacle = { id: 'slant', kind: 'bar' as const,
    x: 0, y: 0, width: 40, height: 10, angle: 45,
    restitution: 0.8 };
  const trace = clipGuideAtObstacles(
    [{ x: -50, y: 0 }, { x: 50, y: 0 }],
    [obstacle], 600, 600, 0, 4,
  );
  assert.equal(trace.contact?.id, 'slant');
  assert.ok(trace.path[1].x < -8 && trace.path[1].x > -30);
  assert.ok(trace.path[1].x < 0);
  assert.equal(getObstacleVertices(stage[0]).length, 3);
});

test('clipping respects wall segments, first contact, and zero-obstacle paths', () => {
  const segments = [
    { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 100 },
  ];
  const one = { id: 'upper', kind: 'hex' as const, x: 0.4, y: 0.6,
    width: 20, height: 20, angle: 0, restitution: 0.7 };
  const clipped = clipGuideAtObstacles(segments, [one], 100, 100, 0, 5);
  assert.equal(clipped.contact?.id, 'upper');
  assert.equal(clipped.path.length, 3);
  close(clipped.path[1].y, 0);
  assert.ok(clipped.path[2].y >= 45 && clipped.path[2].y <= 65);
  const unchanged = clipGuideAtObstacles(segments, [], 100, 100, 0, 5);
  assert.deepEqual(unchanged.path, segments);
  assert.equal(unchanged.contact, null);
  assert.notStrictEqual(unchanged.path, segments, 'do not mutate input');
});

test('parallel misses and invalid input do not invent collisions', () => {
  const far = { id: 'far', kind: 'diamond' as const, x: 0, y: 0,
    width: 10, height: 10, angle: 0, restitution: 0.8 };
  assert.equal(clipGuideAtObstacles(
    [{ x: -50, y: 100 }, { x: 50, y: 100 }], [far],
    100, 100, 0, 5).contact, null);
  assert.equal(clipGuideAtObstacles(
    [{ x: 0, y: 0 }], [far], 100, 100, 0, 5).contact, null);
  assert.match(obstacleGuideLabel('triangle'), /三角/);
  assert.match(obstacleGuideLabel('hex', 'magnet'), /磁场/);
});

test('all four adventure stages have a stable non-empty preview layout', () => {
  for (let i = 1; i <= 4; i++) {
    const specs = getObstaclesForMode('adventure', i);
    const path = [{ x: 0, y: -260 }, { x: 0, y: 300 }];
    const result = clipGuideAtObstacles(path, specs, 600, 660, 20, 19);
    assert.ok(result.path.length >= 2);
    assert.ok(result.path.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  }
});
