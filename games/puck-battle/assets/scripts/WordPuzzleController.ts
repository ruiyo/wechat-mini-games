import {
  findWord,
  getRandomWordDefinition,
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

  reset(): void {
    const pack = INITIAL_LETTER_PACKS[
      Math.floor(Math.random() * INITIAL_LETTER_PACKS.length)
    ];
    this.letters = [...pack];
    this.selectedIndices = [];
  }

  getLetters(): string[] {
    return [...this.letters];
  }

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

    const refill = getRandomWordDefinition().word.split('');
    this.letters.push(refill[0], refill[1]);
    this.selectedIndices = [];

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
