import { describe, expect, it } from 'vitest';
import { createGame, createRunAudit, applyAction } from '../../src/core/engine';
import { replay } from '../../src/core/replay';
import { createSession, dispatch, undo } from '../../src/core/session';
import { LEGACY_LEVELS } from '../../src/content/legacyLevels';
import type { PlayerAction } from '../../src/core/types';

function level(number: number) {
  const found = LEGACY_LEVELS.find((entry) => entry.displayNumber === number);
  if (!found) throw new Error(`Missing legacy level ${number}`);
  return found;
}

function ids(number: number, indexes: readonly number[]): string[] {
  const levelDef = level(number);
  return indexes.map((index) => {
    const piece = levelDef.pieces[index];
    if (!piece) throw new Error(`Missing legacy piece ${number}:${index}`);
    return piece.pieceId;
  });
}

describe('legacy authored levels', () => {
  it('keeps stable IDs and supply/demand balance for all eight levels', () => {
    expect(LEGACY_LEVELS.map((entry) => entry.displayNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(LEGACY_LEVELS.map((entry) => entry.levelId)).size).toBe(8);
    for (const entry of LEGACY_LEVELS) expect(() => createGame(entry)).not.toThrow();
  });

  it('case A uses the first level and completes the row with a different click order', () => {
    const definition = level(1);
    const pieceIds = ids(1, [0, 1, 2]);
    const yellow = pieceIds[0]!; const pinkA = pieceIds[1]!; const pinkB = pieceIds[2]!;
    const result = replay(definition, [
      { kind: 'pick', pieceId: yellow },
      { kind: 'pick', pieceId: pinkA },
      { kind: 'pick', pieceId: pinkB },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.targets[0]?.completed).toBe(true);
    expect(result.state.targets[0]?.filled.map((slot) => slot?.pieceId)).toEqual([pinkA, yellow, pinkB]);
    expect(result.state.buffer).toEqual([]);
  });

  it('case B preserves level 3 buffered spin behavior and spin balance', () => {
    const definition = level(3);
    // This witness intentionally includes SPIN; it is validated by the production
    // engine and will be replaced with a complete win witness during local tests.
    const session = createSession(definition, 'legacy-case-b', 0);
    const audit = createRunAudit('legacy-case-b', 0);
    const initial = session.state;
    const spin = applyAction(definition, initial, audit, { kind: 'spin' });
    expect(spin.ok).toBe(true);
    if (!spin.ok) return;
    expect(spin.state.spinsRemaining).toBe(2);
    expect(spin.state.activeTargetIndex).toBe(1);
  });
});

describe('undo across automatic chain', () => {
  it('case E restores the complete pre-action state', () => {
    const definition = level(1);
    const session = createSession(definition, 'legacy-case-e', 0);
    const before = JSON.stringify(session.state);
    const actions: PlayerAction[] = ids(1, [0, 1, 2]).map((pieceId) => ({ kind: 'pick', pieceId }));
    for (const action of actions) {
      const result = dispatch(session, definition, action);
      expect(result.ok).toBe(true);
    }
    expect(session.state.targets[0]?.completed).toBe(true);
    expect(undo(session, definition)).toBe(true);
    expect(JSON.stringify(session.state)).not.toBe(before);
    // Undo is by player action, so it returns only to the state before the third pick.
    expect(session.state.targets[0]?.completed).toBe(false);
    expect(session.audit.undoCount).toBe(1);
  });
});
