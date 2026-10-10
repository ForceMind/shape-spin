import { describe, expect, it } from 'vitest';
import { ProgressService } from '../../src/services/progressService';
import type { BrowserSaveData, SaveStore } from '../../src/services/saveService';
import type { GameSession } from '../../src/core/session';
import type { LevelDefinition } from '../../src/core/types';

function memoryStore(initial: BrowserSaveData | null = null): SaveStore {
  let value = initial;
  return {
    persistent: false,
    load: () => value,
    save: (next) => { value = structuredClone(next); return true; },
    clear: () => { value = null; },
  };
}

describe('ProgressService', () => {
  it('keeps progress state independent of mutable caller snapshots', () => {
    const service = new ProgressService(memoryStore(), 'campaign-001');
    service.markCompleted('campaign-001');
    service.setLocale('en');
    const first = service.snapshot();
    (first.completedLevelIds as string[]).push('campaign-999');
    expect(service.snapshot().completedLevelIds).toEqual(['campaign-001']);
    expect(service.snapshot().locale).toBe('en');
  });

  it('does not claim an empty store has a continuing run', () => {
    expect(new ProgressService(memoryStore(), 'campaign-001').hasActiveRun()).toBe(false);
  });

  it('keeps campaign selection while saving a daily attempt', () => {
    const store = memoryStore();
    const service = new ProgressService(store, 'campaign-001');
    service.selectLevel('campaign-002');
    const daily: LevelDefinition = {
      levelId: 'daily-2026-09-18', contentVersion: 1, ruleVersion: 2, displayNumber: 0, chapter: 0, titleKey: 'daily.title',
      cells: [{ row: 0, column: 0 }], pieces: [{ pieceId: 'p', row: 0, column: 0, typeId: 'yellow-circle' }],
      targetRows: [{ rowId: 'r', slots: ['yellow-circle'] }], initialSpins: 0, seed: 0, generatorVersion: 0, tags: [], parSpins: 0, witness: [],
    };
    const session: GameSession = {
      levelId: daily.levelId,
      state: { board: [{ pieceId: 'p', row: 0, column: 0, typeId: 'yellow-circle', removed: false }], buffer: [], targets: [{ rowId: 'r', filled: [null], completed: false }], activeTargetIndex: 0, spinsRemaining: 0, moves: 0, phase: 'playing' },
      audit: { runId: 'daily', startedAtMs: 0, hintCount: 0, undoCount: 0, spinsUsed: 0 }, history: [],
    };
    service.save('daily', daily, session);
    expect(store.load()?.progress.selectedLevelId).toBe('campaign-002');
    expect(store.load()?.activeRun?.levelId).toBe('daily-2026-09-18');
  });

  it('writes one complete save envelope with the stable selected level', () => {
    const store = memoryStore();
    const service = new ProgressService(store, 'campaign-001');
    service.selectLevel('campaign-002');
    service.markCompleted('campaign-001');
    const level: LevelDefinition = {
      levelId: 'campaign-002', contentVersion: 1, ruleVersion: 2, displayNumber: 2, chapter: 1, titleKey: 'x',
      cells: [{ row: 0, column: 0 }], pieces: [{ pieceId: 'p', row: 0, column: 0, typeId: 'yellow-circle' }],
      targetRows: [{ rowId: 'r', slots: ['yellow-circle'] }], initialSpins: 0, seed: 0, generatorVersion: 0, tags: [], parSpins: 0, witness: [],
    };
    const session: GameSession = {
      levelId: level.levelId,
      state: { board: [{ pieceId: 'p', row: 0, column: 0, typeId: 'yellow-circle', removed: false }], buffer: [], targets: [{ rowId: 'r', filled: [null], completed: false }], activeTargetIndex: 0, spinsRemaining: 0, moves: 0, phase: 'playing' },
      audit: { runId: 'r', startedAtMs: 0, hintCount: 0, undoCount: 0, spinsUsed: 0 },
      history: [],
    };
    service.save('campaign', level, session);
    const saved = store.load();
    expect(saved?.progress.selectedLevelId).toBe('campaign-002');
    expect(saved?.progress.completedLevelIds).toEqual(['campaign-001']);
    expect(saved?.activeRun?.levelId).toBe('campaign-002');
    expect(service.exportData()).toEqual(saved);
  });
});
