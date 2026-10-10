import type { LevelDefinition } from '../core/types';

/** UTC date identity and deterministic daily level selection. */
export function utcDateKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

export function utcDaySeed(now = new Date()): number {
  return Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86_400_000);
}

export function buildDailyLevel(levels: readonly LevelDefinition[], now = new Date()): LevelDefinition {
  if (levels.length === 0) throw new Error('Cannot build daily level from an empty campaign');
  const seed = utcDaySeed(now);
  const base = levels[seed % levels.length];
  if (!base) throw new Error('Daily level index out of range');
  return { ...base, levelId: `daily-${utcDateKey(now)}`, displayNumber: 0, titleKey: 'daily.title' };
}
