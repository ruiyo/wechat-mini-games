import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function requireFile(relativePath) {
  const fullPath = path.join(repositoryRoot, relativePath);
  try {
    await access(fullPath);
  } catch {
    throw new Error(`Required project file is missing: ${relativePath}`);
  }
}

const requiredFiles = [
  'games/puck-battle/package.json',
  'games/puck-battle/tsconfig.json',
  'games/puck-battle/assets/scripts/PuckBattleBootstrap.ts',
  'games/puck-battle/assets/scripts/GameConfig.ts',
  'games/puck-battle/assets/scripts/WordDictionary.ts',
  'games/puck-battle/assets/scripts/WordPuzzleController.ts',
  'games/puck-battle/assets/scripts/AmmoFactory.ts',
  'games/puck-battle/assets/scripts/AmmoEffectController.ts',
  'games/puck-battle/assets/scripts/ScoreRules.ts',
  'games/puck-battle/assets/scripts/SaveManager.ts',
  'docs/GDD_PUCK_BATTLE.md',
  'docs/TECHNICAL_DESIGN_PUCK_BATTLE.md',
  'docs/MVP_PLAN.md',
  '.github/workflows/ci.yml',
];

for (const file of requiredFiles) {
  await requireFile(file);
}

const projectPackagePath = path.join(repositoryRoot, 'games/puck-battle/package.json');
const projectPackage = JSON.parse(await readFile(projectPackagePath, 'utf8'));
const creatorVersion = projectPackage.creator?.version;

if (creatorVersion !== '3.8.8') {
  throw new Error(`Expected Cocos Creator 3.8.8, found: ${creatorVersion ?? 'not set'}`);
}

const dictionaryPath = path.join(
  repositoryRoot,
  'games/puck-battle/assets/scripts/WordDictionary.ts',
);
const dictionarySource = await readFile(dictionaryPath, 'utf8');
const words = [...dictionarySource.matchAll(/\{ word: '([^']+)'/g)].map((match) => match[1]);

if (words.length !== 24) {
  throw new Error(`Expected 24 dictionary entries, found ${words.length}`);
}

if (words.some((word) => [...word].length !== 2)) {
  throw new Error('Every MVP dictionary entry must contain exactly two Chinese characters');
}

if (new Set(words).size !== words.length) {
  throw new Error('The word dictionary contains duplicate entries');
}

console.log('Project validation passed.');
console.log(`Cocos Creator: ${creatorVersion}`);
console.log(`Dictionary entries: ${words.length}`);
console.log('Note: the editor-authored Game.scene is checked by the Windows build script.');
