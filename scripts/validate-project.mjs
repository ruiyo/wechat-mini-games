import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function readRequired(relativePath) {
  const fullPath = path.join(root, relativePath);
  try {
    await access(fullPath);
    return await readFile(fullPath, 'utf8');
  } catch {
    throw new Error('Required project file is missing: ' + relativePath);
  }
}

const required = [
  'games/puck-battle/package.json',
  'games/puck-battle/tsconfig.json',
  'games/puck-battle/assets/scenes/Game.scene',
  'games/puck-battle/assets/scenes/Game.scene.meta',
  'games/puck-battle/assets/scripts/PuckBattleBootstrap.ts',
  'games/puck-battle/assets/scripts/PuckBattleBootstrap.ts.meta',
  'games/puck-battle/assets/scripts/GameConfig.ts',
  'games/puck-battle/assets/scripts/WordDictionary.ts',
  'games/puck-battle/assets/scripts/WordPuzzleController.ts',
  'games/puck-battle/assets/scripts/AmmoFactory.ts',
  'games/puck-battle/assets/scripts/AmmoEffectController.ts',
  'games/puck-battle/assets/scripts/ScoreRules.ts',
  'games/puck-battle/assets/scripts/SaveManager.ts',
  'settings/v2/packages/engine.json',
  'settings/v2/packages/project.json',
  'docs/GDD_PUCK_BATTLE.md',
  'docs/TECHNICAL_DESIGN_PUCK_BATTLE.md',
  'docs/MVP_PLAN.md',
  '.github/workflows/ci.yml'
];
const data = new Map();
for (const file of required) data.set(file, await readRequired(file));

const project = JSON.parse(data.get('games/puck-battle/package.json'));
if (!project.creator || project.creator.version !== '3.8.8') {
  throw new Error('Project must target Cocos Creator 3.8.8');
}

const objects = JSON.parse(data.get('games/puck-battle/assets/scenes/Game.scene'));
if (!Array.isArray(objects) || objects.length < 15) throw new Error('Invalid Game.scene object array');
const rootScene = objects.find((x) => x.__type__ === 'cc.Scene');
const canvas = objects.find((x) => x.__type__ === 'cc.Node' && x._name === 'Canvas');
if (!rootScene || !canvas) throw new Error('Game.scene is missing its root Scene or Canvas');
const sceneMeta = JSON.parse(data.get('games/puck-battle/assets/scenes/Game.scene.meta'));
if (sceneMeta.uuid !== rootScene._id) throw new Error('Game.scene.meta UUID mismatch');
if (!canvas._components.some((ref) => objects[ref.__id__].__type__ === 'cc.Canvas')) throw new Error('Canvas component missing');
if (!canvas._components.some((ref) => objects[ref.__id__].__type__ === 'cc.UITransform')) throw new Error('UITransform component missing');

const scriptMeta = JSON.parse(data.get('games/puck-battle/assets/scripts/PuckBattleBootstrap.ts.meta'));
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function compressClassId(uuid) {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) throw new Error('Invalid bootstrap script UUID');
  let result = hex.slice(0, 5);
  for (let i = 5; i < 32; i += 3) {
    const value = parseInt(hex.slice(i, i + 3), 16);
    result += alphabet[(value >> 6) & 63] + alphabet[value & 63];
  }
  return result;
}
const classId = compressClassId(scriptMeta.uuid);
if (!canvas._components.some((ref) => objects[ref.__id__].__type__ === classId)) {
  throw new Error('PuckBattleBootstrap is not attached to Canvas');
}

const engine = JSON.parse(data.get('settings/v2/packages/engine.json'));
const modules = engine.modules && engine.modules.includeModules || [];
if (!modules.includes('physics-2d-box2d')) throw new Error('Box2D module is not included');

const source = data.get('games/puck-battle/assets/scripts/WordDictionary.ts');
const words = [...source.matchAll(/\{ word: '([^']+)'/g)].map((m) => m[1]);
if (words.length !== 24) throw new Error('Expected 24 dictionary words, found ' + words.length);
if (words.some((word) => [...word].length !== 2)) throw new Error('Dictionary entries must be two-character words');
if (new Set(words).size !== words.length) throw new Error('Dictionary has duplicate words');

console.log('Project validation passed.');
console.log('Cocos Creator: 3.8.8');
console.log('Dictionary entries: ' + words.length);
console.log('Game.scene: Canvas + PuckBattleBootstrap');
console.log('Box2D module: included');
