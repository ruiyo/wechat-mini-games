import test from 'node:test';
import assert from 'node:assert/strict';
import { Contact2DType, ERigidBody2DType, PhysicsSystem2D, Vec2, sys } from 'cc';
import { PuckBattleBootstrap } from '../../games/puck-battle/assets/scripts/PuckBattleBootstrap';
import { WORD_UI_CONFIG } from '../../games/puck-battle/assets/scripts/GameConfig';

function createGame(): any {
  const game: any = new PuckBattleBootstrap();
  game.node.layer = 524288;
  assert.doesNotThrow(() => game.onLoad());
  return game;
}
function event(x: number, y: number, id = 1): any {
  return {
    getUILocation: () => ({ x: x + 360, y: y + 640 }),
    getID: () => id,
  };
}
function tap(game: any, x: number, y: number): void {
  game.onTouchStart(event(x, y));
}

test('real bootstrap initializes main menu then starts and restarts normal mode', () => {
  const game = createGame();
  assert.equal(game.menuOverlay.active, true);
  assert.equal(game.state, 0); // MENU
  tap(game, 0, -124);
  assert.equal(game.practiceMode, false);
  assert.equal(game.state, 2); // WORD_SELECT
  assert.equal(game.menuOverlay.active, false);
  assert.equal(game.pucks.length, 0);

  // Normal word confirmation creates exactly one physical projectile.
  const first = game.tileCenters[0], second = game.tileCenters[1];
  tap(game, first.x, first.y);
  tap(game, second.x, second.y);
  tap(game, 0, -1280 * WORD_UI_CONFIG.confirmYRatio);
  assert.equal(game.state, 3); // READY
  assert.equal(game.pucks.length, 1);

  // Return a scoring shot without a physics engine timestep in the mock.
  game.currentPuck.node.setPosition(
    game.targetCenter.x, game.targetCenter.y);
  game.finishCurrentShot();
  assert.equal(game.state, 2); // WORD_SELECT
  assert.ok(game.totalScore > 0);
  assert.equal(game.shotsFired, 1);

  // Pausing, restarting and going home must not revive a stale collider.
  tap(game, 720 * 0.36, 1280 * 0.38);
  assert.equal(game.state, 1); // PAUSED
  assert.equal(PhysicsSystem2D.instance.enable, false);
  tap(game, 0, -78); // restart
  assert.equal(game.state, 2);
  assert.equal(game.pucks.length, 0);
  tap(game, 720 * 0.36, 1280 * 0.38);
  tap(game, 0, -171); // home
  assert.equal(game.state, 0);
  assert.equal(game.menuOverlay.active, true);
  game.onDestroy();
});

test('practice mode supports all four ammo buttons and truly transfers momentum', () => {
  sys.localStorage.clear();
  const game = createGame();
  tap(game, 0, -207);
  assert.equal(game.practiceMode, true);
  assert.equal(game.state, 2);
  assert.equal(game.pucks.length, 2);
  assert.equal(game.pucks[0].index, 0);
  assert.equal(game.pucks[1].index, 1);
  assert.ok(game.pucks[0].node.position.x < 0);
  assert.ok(game.pucks[1].node.position.x > 0);

  // Quick-select the impact ammo button (4th).
  tap(game, 720 * 0.3, -1280 * WORD_UI_CONFIG.tileYRatio);
  assert.equal(game.state, 3);
  assert.equal(game.currentPuck.ammo.type, 'impact');
  assert.equal(game.currentPuck.index, 2);
  assert.equal(game.pucks.length, 3);
  const shot = game.currentPuck;
  const pos = shot.node.position;
  game.onTouchStart(event(pos.x, pos.y));
  game.onTouchMove(event(pos.x, pos.y - 130));
  game.onTouchEnd(event(pos.x, pos.y - 130));
  assert.equal(game.state, 5); // FLYING
  assert.ok(shot.body.linearVelocity.y > 0);

  // Physics mock fires both per-collider contact events; the real collision
  // system should resolve the single impact on the NEXT frame.
  const old = game.pucks[0];
  old.collider.emitContact(Contact2DType.BEGIN_CONTACT, shot.collider);
  shot.collider.emitContact(Contact2DType.BEGIN_CONTACT, old.collider);
  game.update(1 / 60);
  assert.equal(game.interactions.collisionCount, 1);
  assert.ok(Math.hypot(old.body.linearVelocity.x, old.body.linearVelocity.y) > 0);
  assert.match(game.shotsLabel.string, /撞击 1/);
  assert.equal(game.contactNotice.node.active, true);

  const beforeBest = sys.localStorage.getItem('word-puck.best-score.v1');
  tap(game, 720 * 0.36, 1280 * 0.38); // pause
  tap(game, 0, -171); // return home
  assert.equal(game.state, 0);
  assert.equal(game.practiceMode, false);
  assert.equal(game.pucks.length, 0);
  assert.equal(sys.localStorage.getItem('word-puck.best-score.v1'), beforeBest);
  game.onDestroy();
});

test('repeated practice restarts re-create two targets with no duplicate listeners', () => {
  const game = createGame();
  tap(game, 0, -207);
  for (let i = 0; i < 4; i += 1) {
    tap(game, 720 * 0.36, 1280 * 0.38); // pause
    tap(game, 0, -78); // restart practice
    assert.equal(game.practiceMode, true);
    assert.equal(game.pucks.length, 2);
    assert.equal(game.pucks[0].collider.listenerCount(Contact2DType.BEGIN_CONTACT), 1);
    assert.equal(game.pucks[1].collider.listenerCount(Contact2DType.BEGIN_CONTACT), 1);
  }
  game.onDestroy();
});

test('all four practice buttons create the intended ammo with unique colliders', () => {
  const game = createGame();
  tap(game, 0, -207);
  const types = ['bounce', 'magnet', 'ice', 'impact'];
  for (let i = 0; i < types.length; i += 1) {
    const x = 720 * (-0.3 + i * 0.2);
    tap(game, x, -1280 * WORD_UI_CONFIG.tileYRatio);
    assert.equal(game.state, 3); // READY
    assert.equal(game.currentPuck.ammo.type, types[i]);
    assert.deepEqual(game.pucks.map((p: any) => p.index), [0, 1, 2]);
    assert.equal(game.currentPuck.collider.listenerCount(Contact2DType.BEGIN_CONTACT), 1);
    game.restartRun();
    assert.equal(game.state, 2);
    assert.equal(game.pucks.length, 2);
  }
  game.returnToHome();
  assert.equal(game.practiceMode, false);
  game.onDestroy();
});

test('idle magnetic shot actively pulls old pucks and delays early settlement', () => {
  const game = createGame();
  tap(game, 0, -207);
  // Magnetic ammo is the second practice button.
  tap(game, 720 * (-0.1), -1280 * WORD_UI_CONFIG.tileYRatio);
  assert.equal(game.currentPuck.ammo.type, 'magnet');
  const shot = game.currentPuck;
  const old = game.pucks[0];
  shot.node.setPosition(old.node.position.x - 85, old.node.position.y);
  const pos = shot.node.position;
  game.onTouchStart(event(pos.x, pos.y));
  game.onTouchMove(event(pos.x, pos.y - 125));
  game.onTouchEnd(event(pos.x, pos.y - 125));
  assert.equal(game.state, 5);
  // The magnet comes to rest before its 3.2s field has expired.
  shot.body.linearVelocity = new Vec2(0, 0);
  old.body.linearVelocity = new Vec2(0, 0);
  const original = old.body.linearVelocity.x;
  game.update(1 / 60);
  assert.notEqual(old.body.linearVelocity.x, original);
  assert.ok(old.body.wakeCount > 0);
  assert.equal(game.interactions.shouldDelayShotCompletion, true);
  assert.equal(game.state, 5, 'should not finish while magnet can pull');
  // Once the field ends, settle normally.
  for (const puck of game.pucks) puck.body.linearVelocity = new Vec2();
  game.update(3.3);
  assert.equal(game.interactions.shouldDelayShotCompletion, false);
  assert.equal(game.state, 6);
  game.update(0.35);
  assert.equal(game.state, 2);
  game.onDestroy();
});

test('ice hard-freeze survives settling, word selection and paused time', () => {
  const game = createGame();
  tap(game, 0, -207);
  // Ice ammo is the third practice button.
  tap(game, 720 * 0.1, -1280 * WORD_UI_CONFIG.tileYRatio);
  assert.equal(game.currentPuck.ammo.type, 'ice');
  const old = game.pucks[0], shot = game.currentPuck;
  shot.node.setPosition(old.node.position.x + 55, old.node.position.y);
  const pos = shot.node.position;
  game.onTouchStart(event(pos.x, pos.y));
  game.onTouchMove(event(pos.x, pos.y - 100));
  game.onTouchEnd(event(pos.x, pos.y - 100));
  assert.equal(game.state, 5);
  shot.body.linearVelocity = new Vec2(0, 0);
  game.update(0.36);
  assert.equal(old.body.type, ERigidBody2DType.Static);
  assert.equal(old.body.linearVelocity.x, 0);
  game.finishCurrentShot();
  assert.equal(game.state, 2);
  assert.equal(old.body.type, ERigidBody2DType.Static,
    'ice must remain locked during next word selection');
  game.update(0.3);
  const timeRemaining = old.freezeRemaining;
  tap(game, 720 * 0.36, 1280 * 0.38);
  game.update(10);
  assert.equal(old.freezeRemaining, timeRemaining,
    'paused game may not silently consume freeze duration');
  tap(game, 0, 22);
  game.update(2.5);
  assert.equal(old.body.type, ERigidBody2DType.Dynamic);
  assert.equal(old.freezeRemaining, 0);
  game.onDestroy();
});
