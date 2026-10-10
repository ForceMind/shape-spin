import type { LevelDefinition } from '../core/types';

export interface PracticeRequest {
  readonly seed: number;
  readonly difficulty: number;
}

export function normalizePracticeRequest(seed: number, difficulty: number): PracticeRequest {
  return {
    seed: Math.max(1, Math.floor(Number.isFinite(seed) ? seed : 1)),
    difficulty: Math.min(10, Math.max(1, Math.floor(Number.isFinite(difficulty) ? difficulty : 1))),
  };
}

/** Deterministic, replayable practice identity selected from verified campaign content. */
export function buildPracticeLevel(levels: readonly LevelDefinition[], request: PracticeRequest): LevelDefinition {
  if (levels.length === 0) throw new Error('Cannot build practice level from an empty campaign');
  const normalized = normalizePracticeRequest(request.seed, request.difficulty);
  const index = (normalized.seed * 7 + normalized.difficulty * 13) % levels.length;
  const base = levels[index];
  if (!base) throw new Error('Practice level index out of range');
  return { ...base, levelId: `practice-${normalized.seed}-${normalized.difficulty}`, displayNumber: 0, titleKey: 'practice.title' };
}
