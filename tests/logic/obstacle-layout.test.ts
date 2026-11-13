import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxCollider2D, PolygonCollider2D } from 'cc';
import { getObstaclesForMode, getObstacleVertices } from
  '../../games/puck-battle/assets/scripts/ObstacleLayout';
import { PuckBattleBootstrap } from
  '../../games/puck-battle/assets/scripts/PuckBattleBootstrap';

test('all four chapters have distinct shapes and 3D-free geometric silhouettes', () => {
  const kinds = new Set<string>();
  const signatures = new Set<string>();
  for (let stage = 1; stage <= 4; stage++) {
    const obstacles = getObstaclesForMode('adventure', stage);
    assert.ok(obstacles.length >= 2 && obstacles.length <= 4);
    signatures.add(obstacles.map((o) => o.kind).join(','));
    for (const o of obstacles) {
      kinds.add(o.kind);
      assert.ok(o.x >= -0.4 && o.x <= 0.4);
      assert.ok(o.y < -0.01 && o.y > -0.3);
      assert.ok(o.width > 0 && o.height > 0);
      assert.ok(o.restitution > 0 && o.restitution <= 1);
      const points = getObstacleVertices(o);
      assert.ok(points.length >= 3 && points.length <= 6);
      // Box2D: convex polygon winding and max <= 8 vertices.
      let sign = 0;
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const c = points[(i + 2) % points.length];
        const z = (b.x - a.x) * (c.y - b.y) -
          (b.y - a.y) * (c.x - b.x);
        if (Math.abs(z) > 1e-5) {
          if (!sign) sign = Math.sign(z);
          assert.equal(Math.sign(z), sign);
        }
      }
    }
  }
  assert.equal(signatures.size, 4);
  assert.deepEqual([...kinds].sort(), ['bar','brick','diamond','hex','triangle']);
});
test('classic and practice remain playable but have real non-circular obstacles', () => {
  assert.equal(getObstaclesForMode('practice').length, 2);
  assert.equal(getObstaclesForMode('classic').length, 3);
  const game: any = new PuckBattleBootstrap();
  game.onLoad();
  assert.equal(game.obstacleNodes.length, 3);
  assert.ok(game.obstacleNodes.every((n: any) =>
    n.getComponent(BoxCollider2D) || n.getComponent(PolygonCollider2D)));
  game.practiceMode = false;
  game.adventureMode = true;
  game.restartRun();
  assert.equal(game.obstacleNodes.length, 2);
  const previous = game.obstacleNodes.slice();
  game.arcade.stage = 2;
  game.setupArcadeStage();
  assert.ok(previous.every((n: any) => n.destroyed));
  assert.equal(game.obstacleNodes.length, 3);
  const triangles = game.obstacleNodes.filter((n: any) =>
    n.getComponent(PolygonCollider2D));
  assert.equal(triangles.length, 2);
  game.returnToHome();
  assert.equal(game.obstacleNodes.length, 3);
  game.onDestroy();
  assert.equal(game.obstacleNodes.length, 0);
});
