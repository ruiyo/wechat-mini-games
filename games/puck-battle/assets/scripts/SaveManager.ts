import { sys } from 'cc';

const BEST_SCORE_KEY = 'puck-battle.best-score.v1';
const SOUND_KEY = 'puck-battle.sound-enabled.v1';

export class SaveManager {
  static getBestScore(): number {
    try {
      const value = Number(sys.localStorage.getItem(BEST_SCORE_KEY) || 0);
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  static saveBestScore(score: number): number {
    const best = Math.max(this.getBestScore(), Math.floor(score));
    try {
      sys.localStorage.setItem(BEST_SCORE_KEY, String(best));
    } catch (error) {
      console.warn('[PuckBattle] Unable to save best score:', error);
    }
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
      console.warn('[PuckBattle] Unable to save sound setting:', error);
    }
  }
}
