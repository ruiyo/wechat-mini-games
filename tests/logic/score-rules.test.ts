import test from 'node:test';
import assert from 'node:assert/strict';

import {
  distanceBetween,
  scoreByDistance,
} from '../../games/puck-battle/assets/scripts/ScoreRules';

const RADII = { center: 10, middle: 20, outer: 30 };

test('score boundaries are inclusive and ordered from center outward', () => {
  assert.equal(scoreByDistance(0, RADII), 50);
  assert.equal(scoreByDistance(10, RADII), 50);
  assert.equal(scoreByDistance(10.01, RADII), 30);
  assert.equal(scoreByDistance(20, RADII), 30);
  assert.equal(scoreByDistance(20.01, RADII), 10);
  assert.equal(scoreByDistance(30, RADII), 10);
  assert.equal(scoreByDistance(30.01, RADII), 0);
});

test('distanceBetween calculates Euclidean distance', () => {
  assert.equal(distanceBetween(0, 0, 3, 4), 5);
  assert.equal(distanceBetween(10, 10, 10, 10), 0);
});
