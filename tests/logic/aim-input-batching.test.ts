import test from 'node:test';
import assert from 'node:assert/strict';
import { PuckBattleBootstrap } from '../../games/puck-battle/assets/scripts/PuckBattleBootstrap';

function event(x: number, y: number, id = 1) {
  return {
    getUILocation: () => ({ x: x + 360, y: y + 640 }),
    getID: () => id,
  };
}

test('many touch moves draw at most once per game update', () => {
  const game: any = new PuckBattleBootstrap();
  game.onLoad();
  game.onTouchStart(event(0, -124)); // open main menu's adventure button
  assert.equal(game.menuOverlay.active, false);
  game.wordPuzzle.suggestWord();
  game.confirmWord();
  const p = game.currentPuck.node.position;
  game.onTouchStart(event(p.x, p.y));
  assert.equal(game.state, 4); // AIMING
  const original = game.aimGraphics.draws;
  for (let i = 1; i <= 32; i++) {
    game.onTouchMove(event(p.x, p.y - i * 4));
  }
  assert.equal(game.aimGraphics.draws, original);
  game.update(1 / 60);
  assert.ok(game.aimGraphics.draws > original);
  const after = game.aimGraphics.draws;
  game.update(1 / 60);
  assert.equal(game.aimGraphics.draws, after);
  game.onTouchEnd(event(p.x, p.y - 128));
  assert.equal(game.state, 5); // FLYING
  assert.equal(game.aimDirty, false);
  game.onDestroy();
});

test('invalid short pull and cancelled second finger restore ready hint', () => {
  const game: any = new PuckBattleBootstrap();
  game.onLoad();
  game.onTouchStart(event(0, -207)); // open practice from the menu
  assert.equal(game.menuOverlay.active, false);
  game.handlePracticeAmmoInput(game.practiceAmmoCenters[0]);
  const p = game.currentPuck.node.position;
  game.onTouchStart(event(p.x, p.y, 4));
  game.onTouchMove(event(p.x, p.y - 5, 4));
  game.onTouchEnd(event(p.x, p.y - 5, 4));
  assert.equal(game.state, 3);
  assert.match(game.hintLabel.string, /按住圆盘/);
  game.onTouchStart(event(p.x, p.y, 4));
  game.onTouchMove(event(p.x, p.y - 60, 4));
  game.onTouchCancel(event(p.x, p.y - 60, 6)); // unrelated touch
  assert.equal(game.state, 4);
  game.onTouchCancel(event(p.x, p.y - 60, 4));
  assert.equal(game.state, 3);
  assert.equal(game.aimDirty, false);
  assert.match(game.hintLabel.string, /按住圆盘/);
  game.onDestroy();
});
