import test from 'node:test';
import assert from 'node:assert/strict';
import { WordPuzzleController } from '../../games/puck-battle/assets/scripts/WordPuzzleController';

test('collecting a visible glyph actually adds it to the next six-card refill', () => {
  const puzzle = new WordPuzzleController();
  puzzle.reset();
  assert.equal(puzzle.collectGlyph('磁'), true);
  assert.equal(puzzle.collectGlyph('王'), false);
  assert.deepEqual(puzzle.getQueuedGlyphs(), ['磁']);
  assert.ok(puzzle.suggestWord());
  assert.ok(puzzle.confirmSelection());
  assert.equal(puzzle.getLetters().length, 6);
  assert.equal(puzzle.getQueuedGlyphs().length, 0);
  assert.equal(puzzle.getLetters()[4], '磁');
  assert.equal(puzzle.hasValidWord(), true);
});

test('reward glyphs remain queued for consecutive launches and never soft-lock the dictionary', () => {
  const puzzle = new WordPuzzleController();
  puzzle.reset(123);
  for (const c of '弹跳磁吸冰冻冲击反击力回冷封寒') puzzle.collectGlyph(c);
  for (let i = 0; i < 12; i++) {
    assert.equal(puzzle.getLetters().length, 6);
    assert.equal(puzzle.hasValidWord(), true);
    assert.ok(puzzle.suggestWord());
    assert.ok(puzzle.confirmSelection());
  }
  assert.equal(puzzle.getQueuedGlyphs().length, 0);
});

test('same daily seed reproduces initial hand and subsequent word refills', () => {
  const one = new WordPuzzleController(), two = new WordPuzzleController();
  one.reset(20261113); two.reset(20261113);
  for (let i = 0; i < 8; i++) {
    assert.deepEqual(one.getLetters(), two.getLetters());
    one.suggestWord(); two.suggestWord();
    assert.equal(one.confirmSelection()?.word, two.confirmSelection()?.word);
  }
});
