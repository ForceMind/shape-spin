import type { GameState, LevelDefinition } from '../core/types';

/**
 * Immutable render input built from the authoritative rule state. Renderers use
 * this shape only; they must never mutate GameState or keep a second gameplay
 * truth.
 */
export interface RenderSnapshot {
  readonly level: LevelDefinition;
  readonly state: GameState;
  readonly selectablePieceIds: ReadonlySet<string>;
  readonly timestampMs: number;
}

export function createRenderSnapshot(
  level: LevelDefinition,
  state: GameState,
  selectablePieceIds: ReadonlySet<string>,
  timestampMs: number,
): RenderSnapshot {
  return { level, state, selectablePieceIds, timestampMs };
}
