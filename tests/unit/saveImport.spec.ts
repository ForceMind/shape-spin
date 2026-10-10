import { describe, expect, it } from 'vitest';
import { createSession } from '../../src/core/session';
import type { LevelDefinition } from '../../src/core/types';
import { parseBrowserSaveData } from '../../src/services/fileTransferService';
import { ProgressService } from '../../src/services/progressService';
import { defaultProgress, type BrowserSaveData, type SaveStore } from '../../src/services/saveService';

const level: LevelDefinition = {
  levelId: 'campaign-001', contentVersion: 1, ruleVersion: 2, displayNumber: 1, chapter: 1, titleKey: 'x',
  cells: [{ row: 0, column: 0 }], pieces: [{ pieceId: 'p', row: 0, column: 0, typeId: 'yellow-circle' }],
  targetRows: [{ rowId: 'r', slots: ['yellow-circle'] }], initialSpins: 0, seed: 0,
  generatorVersion: 0, tags: [], parSpins: 0, witness: [],
};

function store(initial: BrowserSaveData): SaveStore {
  let current = initial;
  return {
    persistent: false,
    load: () => current,
    save: (data) => { current = structuredClone(data); return true; },
    clear: () => { current = initial; },
  };
}

describe('imported save validation', () => {
  it('rejects incomplete progress without replacing valid stored progress', () => {
    const previous: BrowserSaveData = {
      schemaVersion: 2, progress: { ...defaultProgress(level.levelId), completedLevelIds: [level.levelId] }, activeRun: null,
    };
    const storage = store(previous);
    const progress = new ProgressService(storage, level.levelId);
    const attempts: unknown[] = [
      { schemaVersion: 2, progress: {}, activeRun: null },
      { schemaVersion: 2, progress: { ...previous.progress, completedLevelIds: 'bad' }, activeRun: null },
      { schemaVersion: 2, progress: { ...previous.progress, rewardLedger: { bad: -1 } }, activeRun: null },
    ];
    for (const attempt of attempts) {
      expect(() => parseBrowserSaveData(attempt, [level])).toThrow();
      expect(storage.load()).toEqual(previous);
      expect(progress.snapshot().completedLevelIds).toEqual([level.levelId]);
    }
  });

  it('accepts current valid runs, but rejects mismatched or malformed runs before import', () => {
    const storage = store({ schemaVersion: 2, progress: defaultProgress(level.levelId), activeRun: null });
    const progress = new ProgressService(storage, level.levelId);
    progress.save('campaign', level, createSession(level, 'run', 0));
    const exported = progress.exportData();
    expect(parseBrowserSaveData(exported, [level])).toEqual(exported);
    for (const run of [{ ...exported.activeRun, levelContentIdentity: 'old' }, { ...exported.activeRun, state: {} }]) {
      expect(() => parseBrowserSaveData({ ...exported, activeRun: run }, [level])).toThrow();
      expect(storage.load()).toEqual(exported);
    }
  });

  it('keeps progress while dropping an unverifiable daily active run', () => {
    const previous: BrowserSaveData = { schemaVersion: 2, progress: defaultProgress(level.levelId), activeRun: null };
    const exported = { ...previous, activeRun: { mode: 'daily', levelId: 'daily-old', state: {} } };
    expect(parseBrowserSaveData(exported, [level])).toEqual(previous);
  });

  it('does not switch memory state when persistence fails', () => {
    const previous = { schemaVersion: 2 as const, progress: defaultProgress(level.levelId), activeRun: null };
    const storage: SaveStore = { persistent: false, load: () => previous, save: () => false, clear: () => undefined };
    const progress = new ProgressService(storage, level.levelId);
    const imported = { ...previous, progress: { ...previous.progress, locale: 'en' as const } };
    const validated = parseBrowserSaveData(imported, [level]);
    expect(() => progress.import(validated)).toThrow();
    expect(progress.snapshot().locale).toBe('zh-CN');
  });
});
