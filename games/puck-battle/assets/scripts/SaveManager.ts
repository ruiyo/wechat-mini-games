import { sys } from 'cc';

const BEST_SCORE_KEY = 'word-puck.best-score.v1';
const LEGACY_BEST_SCORE_KEY = 'puck-battle.best-score.v1';
const SOUND_KEY = 'word-puck.sound-enabled.v1';
const WORDS_KEY = 'word-puck.discovered-words.v1';

export class SaveManager {
  static getBestScore(): number {
    try {
      const current = Number(sys.localStorage.getItem(BEST_SCORE_KEY) || 0);
      if (Number.isFinite(current) && current > 0) return current;

      const legacy = Number(sys.localStorage.getItem(LEGACY_BEST_SCORE_KEY) || 0);
      return Number.isFinite(legacy) && legacy > 0 ? legacy : 0;
    } catch {
      return 0;
    }
  }

  static saveBestScore(score: number): number {
    const best = Math.max(this.getBestScore(), Math.floor(score));
    try {
      sys.localStorage.setItem(BEST_SCORE_KEY, String(best));
    } catch (error) {
      console.warn('[WordPuck] Unable to save best score:', error);
    }
    return best;
  }

  /** Offline daily challenge records; no server login or leaderboard required. */
  static getDailyBestScore(dateId: string): number {
    try {
      const result = Number(sys.localStorage.getItem('word-puck.daily.' + dateId) || 0);
      return Number.isFinite(result) && result > 0 ? Math.floor(result) : 0;
    } catch { return 0; }
  }

  static saveDailyBestScore(dateId: string, score: number): number {
    const best = Math.max(this.getDailyBestScore(dateId),
      Math.max(0, Math.floor(score)));
    try { sys.localStorage.setItem('word-puck.daily.' + dateId, String(best)); }
    catch (error) { console.warn('[WordPuck] Unable to save daily score:', error); }
    return best;
  }

  static getSoundEnabled(): boolean {
    try {
      return sys.localStorage.getItem(SOUND_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  static setSoundEnabled(enabled: boolean): void {
    try {
      sys.localStorage.setItem(SOUND_KEY, enabled ? 'true' : 'false');
    } catch (error) {
      console.warn('[WordPuck] Unable to save sound setting:', error);
    }
  }

  static getDiscoveredWords(): string[] {
    try {
      const raw = sys.localStorage.getItem(WORDS_KEY);
      if (!raw) return [];
      const value = JSON.parse(raw);
      return Array.isArray(value)
        ? value.filter((item) => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }

  static recordDiscoveredWord(word: string): string[] {
    const words = new Set(this.getDiscoveredWords());
    words.add(word);
    const result = Array.from(words);
    try {
      sys.localStorage.setItem(WORDS_KEY, JSON.stringify(result));
    } catch (error) {
      console.warn('[WordPuck] Unable to save discovered words:', error);
    }
    return result;
  }
}
