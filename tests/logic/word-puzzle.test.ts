import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORD_DEFINITIONS,
  findWord,
} from '../../games/puck-battle/assets/scripts/WordDictionary';
import { WordPuzzleController } from '../../games/puck-battle/assets/scripts/WordPuzzleController';

test('MVP dictionary contains 24 unique two-character words across four ammo types', () => {
  assert.equal(WORD_DEFINITIONS.length, 24);
  assert.equal(new Set(WORD_DEFINITIONS.map((entry) => entry.word)).size, 24);
  assert.ok(WORD_DEFINITIONS.every((entry) => [...entry.word].length === 2));

  const ammoTypes = new Set(WORD_DEFINITIONS.map((entry) => entry.ammoType));
  assert.deepEqual([...ammoTypes].sort(), ['bounce', 'ice', 'impact', 'magnet']);
});

test('word lookup accepts both character orders', () => {
  assert.equal(findWord('弹', '跳')?.word, '弹跳');
  assert.equal(findWord('跳', '弹')?.word, '弹跳');
  assert.equal(findWord('磁', '吸')?.ammoType, 'magnet');
  assert.equal(findWord('冰', '冻')?.ammoType, 'ice');
  assert.equal(findWord('冲', '击')?.ammoType, 'impact');
  assert.equal(findWord('弹', '磁'), null);
});

test('every initial letter pack has six characters and at least three valid word choices', () => {
  const puzzle = new WordPuzzleController();

  for (let i = 0; i < 100; i += 1) {
    puzzle.reset();
    const letters = puzzle.getLetters();
    assert.equal(letters.length, 6);

    let validWordCount = 0;
    for (let first = 0; first < letters.length; first += 1) {
      for (let second = first + 1; second < letters.length; second += 1) {
        if (findWord(letters[first], letters[second])) validWordCount += 1;
      }
    }
    assert.ok(validWordCount >= 3, 'each starting pack should offer at least three meaningful word choices');
    assert.equal(puzzle.hasValidWord(), true);
  }
});

test('valid word confirmation consumes two characters and refills the pool to six', () => {
  const puzzle = new WordPuzzleController();
  puzzle.reset();

  const letters = puzzle.getLetters();
  const expected = findWord(letters[0], letters[1]);
  assert.ok(expected, 'the first two characters of each initial pack should form a valid word');

  puzzle.toggleSelection(0);
  puzzle.toggleSelection(1);

  assert.equal(puzzle.canConfirm(), true);
  const result = puzzle.confirmSelection();

  assert.equal(result?.word, expected.word);
  assert.equal(puzzle.getLetters().length, 6);
  assert.equal(puzzle.getSelectedIndices().length, 0);
  assert.equal(puzzle.hasValidWord(), true);
});

test('invalid word confirmation does not consume characters', () => {
  const puzzle = new WordPuzzleController();
  puzzle.reset();

  const letters = puzzle.getLetters();
  let invalidPair: [number, number] | null = null;

  for (let i = 0; i < letters.length && !invalidPair; i += 1) {
    for (let j = i + 1; j < letters.length; j += 1) {
      if (!findWord(letters[i], letters[j])) {
        invalidPair = [i, j];
        break;
      }
    }
  }

  assert.ok(invalidPair, 'initial packs should include at least one invalid pair');
  puzzle.toggleSelection(invalidPair[0]);
  puzzle.toggleSelection(invalidPair[1]);

  const before = puzzle.getLetters();
  assert.equal(puzzle.confirmSelection(), null);
  assert.deepEqual(puzzle.getLetters(), before);
});

test('selection is limited to two distinct tiles and can be toggled off', () => {
  const puzzle = new WordPuzzleController();
  puzzle.reset();

  puzzle.toggleSelection(0);
  puzzle.toggleSelection(1);
  puzzle.toggleSelection(2);
  assert.deepEqual(puzzle.getSelectedIndices(), [0, 1]);

  puzzle.toggleSelection(0);
  assert.deepEqual(puzzle.getSelectedIndices(), [1]);
});
