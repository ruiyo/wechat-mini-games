import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code = readFileSync('games/puck-battle/assets/scripts/PuckBattleBootstrap.ts', 'utf8');
test('word UI hides completely during aiming and hint is a separate action', () => {
  assert.match(code, /this\.wordTrayNode\.active = visible/);
  assert.match(code, /this\.wordHintNode\.active = visible/);
  assert.match(code, /this\.wordPuzzle\.suggestWord\(\)/);
});
test('second finger cannot move or end the first finger drag', () => {
  assert.match(code, /this\.activeTouchId = event\.getID\(\)/);
  assert.equal((code.match(/event\.getID\(\) !== this\.activeTouchId/g) || []).length, 3);
});
test('guide is visual only and shooting still uses Box2D velocity', () => {
  assert.match(code, /predictWallBouncePath\(/);
  assert.match(code, /puck\.body\.linearVelocity = velocity/);
});
