import test from 'node:test';
import assert from 'node:assert/strict';
import { Contact2DType, ERigidBody2DType, Vec2 } from 'cc';
import { getObstaclesForMode } from
  '../../games/puck-battle/assets/scripts/ObstacleLayout';
import { PuckBattleBootstrap } from
  '../../games/puck-battle/assets/scripts/PuckBattleBootstrap';
import { AmmoFactory } from
  '../../games/puck-battle/assets/scripts/AmmoFactory';
import { WORD_DEFINITIONS } from
  '../../games/puck-battle/assets/scripts/WordDictionary';

function gameAt(stage: number): any {
  const game: any = new PuckBattleBootstrap();
  game.onLoad();
  game.adventureMode = true;
  game.restartRun();
  if (stage !== 1) {
    game.arcade.stage = stage;
    game.setupArcadeStage();
  }
  return game;
}
function spawn(game: any, type: string, x: number, y: number): any {
  const word = WORD_DEFINITIONS.find((w) => w.ammoType === type)!;
  game.spawnPuck(AmmoFactory.create(word), new Vec2(x, y));
  return game.currentPuck;
}

test('special obstacles only appear in chapter three and boss chapter', () => {
  const chapter3 = getObstaclesForMode('adventure', 3);
  const chapter4 = getObstaclesForMode('adventure', 4);
  assert.deepEqual(chapter3.map((o) => o.effect),
    ['frost', 'magnet', undefined]);
  assert.equal(chapter4.filter((o) => o.effect === 'burst').length, 1);
  assert.ok(getObstaclesForMode('classic').every((o) => !o.effect));
  assert.ok(getObstaclesForMode('practice').every((o) => !o.effect));
});

test('frost contact is queued and freezes only other pucks after update', () => {
  const game = gameAt(3);
  const spec = getObstaclesForMode('adventure', 3)[0];
  const x = spec.x * game.arenaWidth;
  const y = game.arenaCenterY + spec.y * game.arenaHeight;
  const other = spawn(game, 'bounce', x - 40, y + 10);
  const active = spawn(game, 'ice', x - 20, y);
  game.state = 5; // FLYING
  game.interactions.beginShot(active);
  const entry = [...game.obstacleColliders.entries()].find(([, v]) => v.effect === 'frost')!;
  entry[0].emitContact(Contact2DType.BEGIN_CONTACT, active.collider);
  assert.equal(other.freezeRemaining, 0, 'no body changes inside a Box2D callback');
  game.update(1 / 60);
  assert.ok(other.freezeRemaining > 1);
  assert.equal(other.body.type, ERigidBody2DType.Static);
  entry[0].emitContact(Contact2DType.BEGIN_CONTACT, active.collider);
  game.update(1 / 60);
  assert.ok(game.activatedObstacleEffects.has(spec.id));
  game.returnToHome();
  assert.equal(game.obstacleColliders.size, 0);
  game.onDestroy();
});

test('magnetic pillar accelerates nearby unfrozen pucks', () => {
  const game = gameAt(3);
  const spec = getObstaclesForMode('adventure', 3)[1];
  const x = spec.x * game.arenaWidth;
  const y = game.arenaCenterY + spec.y * game.arenaHeight;
  const active = spawn(game, 'bounce', x - 95, y);
  game.state = 5;
  game.interactions.beginShot(active);
  const old = active.body.linearVelocity.x;
  game.applyObstacleFields(1 / 60);
  assert.ok(active.body.linearVelocity.x > old);
  game.onDestroy();
});

test('burst trigger fires once per shot and resets on stage change', () => {
  const game = gameAt(4);
  const spec = getObstaclesForMode('adventure', 4).find((s) => s.effect === 'burst')!;
  const x = spec.x * game.arenaWidth;
  const y = game.arenaCenterY + spec.y * game.arenaHeight;
  const active = spawn(game, 'impact', x, y - 45);
  game.state = 5;
  game.interactions.beginShot(active);
  game.glyphArena.beginShot(active);
  const entry = [...game.obstacleColliders.entries()].find(([, v]) => v.effect === 'burst')!;
  entry[0].emitContact(Contact2DType.BEGIN_CONTACT, active.collider);
  const initial = game.fusionScore;
  game.resolveObstacleContacts();
  assert.ok(game.fusionScore > initial);
  entry[0].emitContact(Contact2DType.BEGIN_CONTACT, active.collider);
  game.resolveObstacleContacts();
  assert.equal(game.fusionScore, initial + 40);
  game.onDestroy();
});
