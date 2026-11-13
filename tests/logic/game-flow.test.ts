import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(
  path.resolve(process.cwd(), 'games/puck-battle/assets/scripts/PuckBattleBootstrap.ts'),
  'utf8',
);

test('main menu is the initial state, and gameplay starts only through startRun', () => {
  assert.match(source, /private state = GameState\.MENU/);
  assert.match(source, /this\.createMenuOverlay\(\);/);
  assert.match(source, /this\.showHome\(\);/);
  assert.match(source, /private startRun\(\): void/);
  assert.match(source, /this\.menuOverlay\.active = false/);
});

test('pause prevents physics updates, and resume restores the previous state', () => {
  assert.match(source, /this\.pausedFrom = this\.state === GameState\.AIMING/);
  assert.match(source, /PhysicsSystem2D\.instance\.enable = false/);
  assert.match(source, /PhysicsSystem2D\.instance\.enable = true/);
  assert.match(source, /this\.state = this\.pausedFrom/);
});

test('result has distinct restart/home buttons and does not restart on arbitrary taps', () => {
  assert.match(source, /ResultRestart/);
  assert.match(source, /ResultHome/);
  assert.match(source, /if \(this\.resultOverlay\?\.active\)/);
  assert.match(source, /this\.returnToHome\(\)/);
});

test('all overlays use canvas-visible nodes and explicit input hit testing', () => {
  assert.match(source, /this\.makeRenderNode\(name\)/);
  assert.match(source, /private withinBox\(/);
  assert.match(source, /if \(this\.menuOverlay\?\.active\)/);
  assert.match(source, /if \(this\.pauseOverlay\?\.active\)/);
  assert.match(source, /if \(this\.helpOverlay\?\.active\)/);
});
