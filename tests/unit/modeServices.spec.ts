import { describe, expect, it } from 'vitest';
import { buildDailyLevel, utcDateKey, utcDaySeed } from '../../src/services/dailyService';
import { buildPracticeLevel, normalizePracticeRequest } from '../../src/services/practiceService';
import type { LevelDefinition } from '../../src/core/types';

const levels: readonly LevelDefinition[] = [1, 2, 3].map((number) => ({
  levelId: `campaign-${number}`, contentVersion: 1, ruleVersion: 2, displayNumber: number, chapter: 1, titleKey: 'x',
  cells: [{ row: 0, column: 0 }], pieces: [{ pieceId: `p-${number}`, row: 0, column: 0, typeId: 'yellow-circle' }],
  targetRows: [{ rowId: `r-${number}`, slots: ['yellow-circle'] }], initialSpins: 0, seed: number, generatorVersion: 0, tags: [], parSpins: 0, witness: [],
}));

describe('dailyService', () => {
  it('uses UTC identity independent of local timezone', () => {
    const now = new Date('2026-09-18T23:59:59.000Z');
    expect(utcDateKey(now)).toBe('2026-09-18');
    expect(buildDailyLevel(levels, now).levelId).toBe('daily-2026-09-18');
    expect(utcDaySeed(now)).toBe(20714);
  });
});

describe('practiceService', () => {
  it('normalizes inputs and gives deterministic replay identity', () => {
    expect(normalizePracticeRequest(-5, 99)).toEqual({ seed: 1, difficulty: 10 });
    const first = buildPracticeLevel(levels, { seed: 42, difficulty: 3 });
    const second = buildPracticeLevel(levels, { seed: 42, difficulty: 3 });
    expect(first.levelId).toBe('practice-42-3');
    expect(second).toEqual(first);
  });
});
