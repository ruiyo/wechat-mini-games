import test from 'node:test';
import assert from 'node:assert/strict';
import { WordPuzzleController } from '../../games/puck-battle/assets/scripts/WordPuzzleController';
test('hint selects a valid word without consuming the current cards', () => {
  const puzzle = new WordPuzzleController();
  for (let i = 0; i < 50; i++) {
    puzzle.reset();
    puzzle.toggleSelection(5);
    const before = puzzle.getLetters();
    const hint = puzzle.suggestWord();
    assert.ok(hint);
    assert.equal(puzzle.getSelectedWord()?.word, hint.word);
    assert.equal(puzzle.canConfirm(), true);
    assert.equal(puzzle.getSelectedIndices().length, 2);
    assert.deepEqual(puzzle.getLetters(), before);
    assert.equal(puzzle.confirmSelection()?.word, hint.word);
    assert.equal(puzzle.getLetters().length, 6);
  }
});
