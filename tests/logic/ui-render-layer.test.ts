import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const scene = JSON.parse(readFileSync(path.join(repoRoot, 'games/puck-battle/assets/scenes/Game.scene'), 'utf8'));
const source = readFileSync(path.join(repoRoot, 'games/puck-battle/assets/scripts/PuckBattleBootstrap.ts'), 'utf8');

test('runtime-created UI nodes share a layer visible to the serialized Canvas camera', () => {
  const canvas = scene.find((object: any) => object.__type__ === 'cc.Node' && object._name === 'Canvas');
  const camera = scene.find((object: any) => object.__type__ === 'cc.Camera');
  assert.ok(canvas && camera);

  const DEFAULT_LAYER = 1 << 30;
  assert.equal(camera._visibility & DEFAULT_LAYER, 0,
    'regression guard: the default layer is not visible to the UI camera');
  assert.notEqual(camera._visibility & canvas._layer, 0,
    'the Canvas layer must be visible to the UI camera');

  assert.match(source, /private makeRenderNode\(name: string\): Node/);
  assert.match(source, /node\.layer = this\.node\.layer;/);
  assert.equal((source.match(/\bnew Node\(/g) ?? []).length, 1,
    'all runtime nodes must use makeRenderNode, not bare new Node');
});

test('both background and UI widgets use the layer-aware node creator', () => {
  for (const required of [
    "this.makeRenderNode('Background')",
    "this.makeRenderNode('ScoringTarget')",
    "this.makeRenderNode('WordTile_' + i)",
    "this.makeRenderNode('WordBookOverlay')",
    "this.makeRenderNode('Ammo_' + index)",
    "this.makeRenderNode('AmmoWord')",
  ]) {
    assert.ok(source.includes(required), 'Missing layer-aware creation: ' + required);
  }
});
