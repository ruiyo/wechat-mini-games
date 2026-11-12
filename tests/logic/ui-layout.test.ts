import test from 'node:test';
import assert from 'node:assert/strict';

import { WORD_UI_CONFIG } from '../../games/puck-battle/assets/scripts/GameConfig';

test('six word tiles fit on a 720-unit portrait canvas without overlapping the wordbook button', () => {
  const screenWidth = 720;
  const totalWidth = WORD_UI_CONFIG.tileWidth * 6 + WORD_UI_CONFIG.tileGap * 5;
  const firstCenter = -totalWidth / 2 + WORD_UI_CONFIG.tileWidth / 2;
  const lastCenter = firstCenter + 5 * (WORD_UI_CONFIG.tileWidth + WORD_UI_CONFIG.tileGap);
  const tileRight = lastCenter + WORD_UI_CONFIG.tileWidth / 2;
  const bookLeft = screenWidth * WORD_UI_CONFIG.wordBookButtonXRatio -
    WORD_UI_CONFIG.wordBookButtonWidth / 2;

  assert.ok(firstCenter - WORD_UI_CONFIG.tileWidth / 2 >= -screenWidth / 2);
  assert.ok(tileRight < bookLeft, 'last character tile must remain independently tappable');
});

test('wordbook button remains inside the portrait canvas', () => {
  const screenWidth = 720;
  const center = screenWidth * WORD_UI_CONFIG.wordBookButtonXRatio;
  assert.ok(center - WORD_UI_CONFIG.wordBookButtonWidth / 2 > 0);
  assert.ok(center + WORD_UI_CONFIG.wordBookButtonWidth / 2 < screenWidth);
});
