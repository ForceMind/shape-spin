import type { GameSession } from '../core/session';
import { levelContentIdentity } from '../core/levelIdentity';
import type { LevelDefinition, Locale, Mode } from '../core/types';
import { createBrowserSaveStore, defaultProgress, restoreActiveRun, serializeActiveRun, type BrowserSaveData, type SaveStore } from './saveService';

export interface ProgressState {
  readonly completedLevelIds: readonly string[];
  readonly selectedLevelId: string;
  readonly locale: Locale;
  readonly soundEnabled: boolean;
  readonly reducedMotion: boolean;
  readonly rewardLedger: Readonly<Record<string, number>>;
}

/**
 * Application-facing persistence facade. Screens consume ProgressState instead
 * of reading localStorage or BrowserSaveData directly.
 */
export class ProgressService {
  private state: ProgressState;
  private recoveryNotice = false;

  public constructor(
    private readonly store: SaveStore,
    fallbackLevelId: string,
  ) {
    const saved = store.load();
    this.state = saved ? saved.progress : defaultProgress(fallbackLevelId);
  }

  public snapshot(): ProgressState {
    return {
      completedLevelIds: [...this.state.completedLevelIds],
      selectedLevelId: this.state.selectedLevelId,
      locale: this.state.locale,
      soundEnabled: this.state.soundEnabled,
      reducedMotion: this.state.reducedMotion,
      rewardLedger: { ...this.state.rewardLedger },
    };
  }

  public setLocale(locale: Locale): void { this.state = { ...this.state, locale }; }
  public setSoundEnabled(soundEnabled: boolean): void { this.state = { ...this.state, soundEnabled }; }
  public setReducedMotion(reducedMotion: boolean): void { this.state = { ...this.state, reducedMotion }; }
  public selectLevel(levelId: string): void { this.state = { ...this.state, selectedLevelId: levelId }; }
  public setRewardLedger(rewardLedger: Readonly<Record<string, number>>): void { this.state = { ...this.state, rewardLedger: { ...rewardLedger } }; }

  public markCompleted(levelId: string): boolean {
    if (this.state.completedLevelIds.includes(levelId)) return false;
    this.state = { ...this.state, completedLevelIds: [...this.state.completedLevelIds, levelId] };
    return true;
  }

  public hasActiveRun(level?: LevelDefinition): boolean {
    const active = this.store.load()?.activeRun;
    if (!active) return false;
    if (!level) return true;
    return active.levelId === level.levelId && active.levelContentIdentity === levelContentIdentity(level);
  }

  public restoreRun(level: LevelDefinition): GameSession | null {
    const active = this.store.load()?.activeRun;
    if (!active || active.levelId !== level.levelId) return null;
    try { return restoreActiveRun(active, level); }
    catch { this.recoveryNotice = true; return null; }
  }

  public takeRecoveryNotice(): boolean {
    const notice = this.recoveryNotice;
    this.recoveryNotice = false;
    return notice;
  }

  public save(mode: Mode, level: LevelDefinition, session: GameSession): boolean {
    const activeRun = session.state.phase === 'playing' ? serializeActiveRun(level, session, mode, Date.now()) : null;
    const data: BrowserSaveData = {
      schemaVersion: 2,
      progress: {
        schemaVersion: 1,
        completedLevelIds: [...this.state.completedLevelIds],
        selectedLevelId: this.state.selectedLevelId,
        locale: this.state.locale,
        soundEnabled: this.state.soundEnabled,
        reducedMotion: this.state.reducedMotion,
        rewardLedger: { ...this.state.rewardLedger },
      },
      activeRun,
    };
    return this.store.save(data);
  }

  public exportData(): BrowserSaveData {
    const activeRun = this.store.load()?.activeRun ?? null;
    return {
      schemaVersion: 2,
      progress: {
        schemaVersion: 1,
        completedLevelIds: [...this.state.completedLevelIds],
        selectedLevelId: this.state.selectedLevelId,
        locale: this.state.locale,
        soundEnabled: this.state.soundEnabled,
        reducedMotion: this.state.reducedMotion,
        rewardLedger: { ...this.state.rewardLedger },
      },
      activeRun,
    };
  }

  public import(data: BrowserSaveData): void {
    if (!this.store.save(data)) throw new Error('Failed to persist imported save');
    this.state = {
      ...data.progress,
      completedLevelIds: [...data.progress.completedLevelIds],
      rewardLedger: { ...data.progress.rewardLedger },
    };
  }
}

export function createProgressService(fallbackLevelId: string, levelIds: readonly string[]): ProgressService {
  return new ProgressService(createBrowserSaveStore(fallbackLevelId, levelIds), fallbackLevelId);
}
