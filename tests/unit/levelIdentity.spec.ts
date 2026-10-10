import { describe, expect, it } from 'vitest';
import { createGame, createRunAudit } from '../../src/core/engine';
import { deserializeSave, serializeSave } from '../../src/core/serialization';
import { levelContentIdentity } from '../../src/core/levelIdentity';
import { ProgressService } from '../../src/services/progressService';
import type { BrowserSaveData, SaveStore } from '../../src/services/saveService';
import type { LevelDefinition, SaveEnvelope } from '../../src/core/types';

const original: LevelDefinition = {
  levelId: 'campaign-009', contentVersion: 1, ruleVersion: 2, displayNumber: 9, chapter: 1, titleKey: 'x',
  cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }],
  pieces: [
    { pieceId: 'a', row: 0, column: 0, typeId: 'yellow-circle' },
    { pieceId: 'b', row: 0, column: 1, typeId: 'pink-triangle' },
  ],
  targetRows: [{ rowId: 'r', slots: ['yellow-circle', 'pink-triangle'] }],
  initialSpins: 0, seed: 9, generatorVersion: 2, tags: [], parSpins: 0, witness: [],
};

function savedRun(level: LevelDefinition): SaveEnvelope {
  return {
    schemaVersion: 2, ruleVersion: level.ruleVersion, savedAtMs: 1, mode: 'campaign', levelId: level.levelId,
    state: createGame(level), history: [], audit: createRunAudit('run', 0),
  };
}

describe('resumable level identity', () => {
  it('is stable under irrelevant definition ordering but changes with target order', () => {
    const reordered = { ...original, cells: [...original.cells].reverse(), pieces: [...original.pieces].reverse() };
    const changed = { ...original, targetRows: [{ rowId: 'r', slots: ['pink-triangle', 'yellow-circle'] }] };
    expect(levelContentIdentity(reordered)).toBe(levelContentIdentity(original));
    expect(levelContentIdentity(changed)).not.toBe(levelContentIdentity(original));
  });

  it('rejects a legacy active run without content identity rather than guessing compatibility', () => {
    expect(() => deserializeSave(serializeSave(savedRun(original)), original)).toThrow(/content identity/i);
  });

  it('rejects an active run when target order changes under the same levelId', () => {
    const changed = { ...original, targetRows: [{ rowId: 'r', slots: ['pink-triangle', 'yellow-circle'] }] };
    const envelope = { ...savedRun(original), levelContentIdentity: levelContentIdentity(original) };
    expect(() => deserializeSave(serializeSave(envelope), changed)).toThrow(/content identity/i);
  });

  it('keeps global clears and rewards when an incompatible run must restart', () => {
    const data: BrowserSaveData = {
      schemaVersion: 2,
      progress: {
        schemaVersion: 1, completedLevelIds: ['campaign-001'], selectedLevelId: original.levelId,
        locale: 'zh-CN', soundEnabled: true, reducedMotion: false,
        rewardLedger: { 'campaign:first-clear:campaign-001': 10 },
      },
      activeRun: savedRun(original),
    };
    const store: SaveStore = { persistent: false, load: () => data, save: () => true, clear: () => undefined };
    const progress = new ProgressService(store, original.levelId);
    expect(progress.hasActiveRun(original)).toBe(false);
    expect(progress.restoreRun(original)).toBeNull();
    expect(progress.takeRecoveryNotice()).toBe(true);
    expect(progress.takeRecoveryNotice()).toBe(false);
    expect(progress.snapshot().completedLevelIds).toEqual(['campaign-001']);
    expect(progress.snapshot().rewardLedger['campaign:first-clear:campaign-001']).toBe(10);
  });
});
