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

const projectRoot = 'games/puck-battle';
const required = [
  projectRoot + '/package.json',
  projectRoot + '/tsconfig.json',
  projectRoot + '/assets/scenes/Game.scene',
  projectRoot + '/assets/scenes/Game.scene.meta',
  projectRoot + '/assets/scripts/PuckBattleBootstrap.ts',
  projectRoot + '/assets/scripts/PuckBattleBootstrap.ts.meta',
  projectRoot + '/assets/scripts/GameConfig.ts',
  projectRoot + '/assets/scripts/WordDictionary.ts',
  projectRoot + '/assets/scripts/WordPuzzleController.ts',
  projectRoot + '/assets/scripts/AmmoFactory.ts',
  projectRoot + '/assets/scripts/AmmoEffectController.ts',
  projectRoot + '/assets/scripts/ScoreRules.ts',
  projectRoot + '/assets/scripts/SaveManager.ts',
  projectRoot + '/settings/v2/packages/engine.json',
  projectRoot + '/settings/v2/packages/project.json',
  'docs/GDD_PUCK_BATTLE.md',
  'docs/TECHNICAL_DESIGN_PUCK_BATTLE.md',
  'docs/MVP_PLAN.md',
  '.github/workflows/ci.yml'
];

const data = new Map();
for (const file of required) data.set(file, await readRequired(file));

const project = JSON.parse(data.get(projectRoot + '/package.json'));
if (!project.creator || project.creator.version !== '3.8.8') {
  throw new Error('Project must target Cocos Creator 3.8.8');
}

const objects = JSON.parse(data.get(projectRoot + '/assets/scenes/Game.scene'));
if (!Array.isArray(objects) || objects.length < 15) throw new Error('Invalid Game.scene object array');
const rootScene = objects.find((x) => x.__type__ === 'cc.Scene');
const canvas = objects.find((x) => x.__type__ === 'cc.Node' && x._name === 'Canvas');
if (!rootScene || !canvas) throw new Error('Game.scene is missing its root Scene or Canvas');

const sceneMeta = JSON.parse(data.get(projectRoot + '/assets/scenes/Game.scene.meta'));
if (sceneMeta.uuid !== rootScene._id) throw new Error('Game.scene.meta UUID mismatch');
if (!canvas._components.some((ref) => objects[ref.__id__].__type__ === 'cc.Canvas')) {
  throw new Error('Canvas component missing');
}
if (!canvas._components.some((ref) => objects[ref.__id__].__type__ === 'cc.UITransform')) {
  throw new Error('UITransform component missing');
}
const canvasIndex = objects.indexOf(canvas);
const canvasTransform = objects.find((item) =>
  item.__type__ === 'cc.UITransform' && item.node && item.node.__id__ === canvasIndex
);
if (!canvasTransform || canvasTransform._contentSize.width !== 720 || canvasTransform._contentSize.height !== 1280) {
  throw new Error('Canvas UITransform must use the 720x1280 portrait design size');
}

const scriptMeta = JSON.parse(data.get(projectRoot + '/assets/scripts/PuckBattleBootstrap.ts.meta'));
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

const engine = JSON.parse(data.get(projectRoot + '/settings/v2/packages/engine.json'));
const modules = engine.modules && engine.modules.includeModules || [];
if (!modules.includes('physics-2d-box2d')) {
  throw new Error('Cocos project settings do not include physics-2d-box2d');
}
const projectSettings = JSON.parse(data.get(projectRoot + '/settings/v2/packages/project.json'));
if (!projectSettings.general || !projectSettings.general.designResolution) {
  throw new Error('Cocos project settings are missing general.designResolution');
}
const designResolution = projectSettings.general.designResolution;
if (designResolution.width !== 720 || designResolution.height !== 1280) {
  throw new Error('Cocos project design resolution must be 720x1280 portrait');
}
if (designResolution.fitHeight !== true || designResolution.fitWidth !== false) {
  throw new Error('Cocos project must use fitHeight=true and fitWidth=false');
}

const source = data.get(projectRoot + '/assets/scripts/WordDictionary.ts');
const words = [...source.matchAll(/\{ word: '([^']+)'/g)].map((m) => m[1]);
if (words.length !== 24) throw new Error('Expected 24 dictionary words, found ' + words.length);
if (words.some((word) => [...word].length !== 2)) {
  throw new Error('Dictionary entries must be two-character words');
}
if (new Set(words).size !== words.length) throw new Error('Dictionary has duplicate words');

console.log('Project validation passed.');
console.log('Cocos Creator: 3.8.8');
console.log('Project root: ' + projectRoot);
console.log('Design resolution: 720x1280 portrait, fit height');
console.log('Dictionary entries: ' + words.length);
console.log('Game.scene: Canvas + PuckBattleBootstrap');
console.log('Box2D module: included in project settings');
