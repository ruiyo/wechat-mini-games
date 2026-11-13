import {
  findWord,
  WORD_DEFINITIONS,
} from './WordDictionary';
import type { WordDefinition } from './WordDictionary';

const INITIAL_LETTER_PACKS: string[][] = [
  ['弹', '跳', '磁', '吸', '冰', '冻'],
  ['反', '弹', '冲', '击', '冷', '冻'],
  ['跳', '跃', '撞', '击', '冰', '封'],
  ['磁', '力', '吸', '引', '震', '荡'],
  ['弹', '射', '重', '击', '寒', '冰'],
  ['弹', '力', '吸', '附', '冻', '结'],
];

export class WordPuzzleController {
  private letters: string[] = [];
  private selectedIndices: number[] = [];
  private collectedGlyphs: string[] = [];
  private nextRandom: () => number = Math.random;

  reset(seed?: number): void {
    // Daily runs use a stable sequence; ordinary runs remain varied.
    if (seed === undefined) this.nextRandom = Math.random;
    else {
      let state = seed >>> 0;
      this.nextRandom = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    }
    const pack = INITIAL_LETTER_PACKS[
      Math.floor(this.nextRandom() * INITIAL_LETTER_PACKS.length)
    ];
    this.letters = [...pack];
    this.selectedIndices = [];
    this.collectedGlyphs = [];
  }

  getLetters(): string[] {
    return [...this.letters];
  }

  collectGlyph(glyph: string): boolean {
    // Battle drops remain a tactical resource. They are inserted at the next
    // refill, paired with a dictionary partner so six cards never deadlock.
    if (!glyph || !WORD_DEFINITIONS.some((w) => w.word.includes(glyph))) return false;
    if (this.collectedGlyphs.length >= 12) this.collectedGlyphs.shift();
    this.collectedGlyphs.push(glyph);
    return true;
  }

  getQueuedGlyphs(): string[] { return this.collectedGlyphs.slice(); }

  getSelectedIndices(): number[] {
    return [...this.selectedIndices];
  }

  toggleSelection(index: number): void {
    if (index < 0 || index >= this.letters.length) return;

    const existing = this.selectedIndices.indexOf(index);
    if (existing >= 0) {
      this.selectedIndices.splice(existing, 1);
      return;
    }

    if (this.selectedIndices.length >= 2) return;
    this.selectedIndices.push(index);
  }

  /** Show a valid pair without using or replacing any characters. */
  suggestWord(): WordDefinition | null {
    for (let i = 0; i < this.letters.length; i++) {
      for (let j = i + 1; j < this.letters.length; j++) {
        const word = findWord(this.letters[i], this.letters[j]);
        if (word) {
          this.selectedIndices = [i, j];
          return word;
        }
      }
    }
    this.selectedIndices = [];
    return null;
  }

  getSelectedWord(): WordDefinition | null {
    if (this.selectedIndices.length !== 2) return null;
    const first = this.letters[this.selectedIndices[0]];
    const second = this.letters[this.selectedIndices[1]];
    return findWord(first, second);
  }

  getPreviewText(): string {
    if (this.selectedIndices.length === 0) return '请选择两个汉字组成词语';
    if (this.selectedIndices.length === 1) {
      return '已选择「' + this.letters[this.selectedIndices[0]] + '」，再选一个字';
    }

    const first = this.letters[this.selectedIndices[0]];
    const second = this.letters[this.selectedIndices[1]];
    const definition = findWord(first, second);
    return definition
      ? definition.word + '  →  ' + definition.ammoName
      : first + second + '：暂未收录，请调整选择';
  }

  canConfirm(): boolean {
    return this.getSelectedWord() !== null;
  }

  confirmSelection(): WordDefinition | null {
    const definition = this.getSelectedWord();
    if (!definition) return null;

    const indices = [...this.selectedIndices].sort((a, b) => b - a);
    for (const index of indices) {
      this.letters.splice(index, 1);
    }

    let refill: string[];
    if (this.collectedGlyphs.length > 0) {
      const earned = this.collectedGlyphs.shift()!;
      const candidates = WORD_DEFINITIONS.filter((w) => w.word.includes(earned));
      const chosen = candidates[Math.floor(this.nextRandom() * candidates.length)];
      // Put the won character on the tray NOW, not in an invisible inventory.
      refill = [earned, chosen.word[0] === earned ? chosen.word[1] : chosen.word[0]];
    } else {
      refill = WORD_DEFINITIONS[
        Math.floor(this.nextRandom() * WORD_DEFINITIONS.length)
      ].word.split('');
    }
    this.letters.push(refill[0], refill[1]);
    this.selectedIndices = [];
    // Defensive fallback for future multi-character blocks/dictionary updates.
    if (!this.hasValidWord()) {
      const fallback = WORD_DEFINITIONS[
        Math.floor(this.nextRandom() * WORD_DEFINITIONS.length)
      ].word.split('');
      this.letters.splice(4, 2, fallback[0], fallback[1]);
    }

    return definition;
  }

  hasValidWord(): boolean {
    for (let i = 0; i < this.letters.length; i += 1) {
      for (let j = i + 1; j < this.letters.length; j += 1) {
        if (findWord(this.letters[i], this.letters[j])) return true;
      }
    }
    return false;
  }
}
