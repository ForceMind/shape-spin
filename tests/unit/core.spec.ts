import { describe, expect, it } from 'vitest';
import { applyAction, createGame, createRunAudit, getLegalActions } from '../../src/core/engine';
import { getSelectablePieceIds } from '../../src/core/connectivity';
import { replay } from '../../src/core/replay';
import { createSaveEnvelope, deserializeSave, serializeSave } from '../../src/core/serialization';
import { createSession, dispatch, undo } from '../../src/core/session';
import { validateState } from '../../src/core/validation';
import { RULE_VERSION } from '../../src/core/types';
import type { LevelDefinition, PlayerAction } from '../../src/core/types';

function makeLevel(overrides: Partial<LevelDefinition> = {}): LevelDefinition {
  const level: LevelDefinition = {
    levelId: 'test-level',
    contentVersion: 1,
    ruleVersion: RULE_VERSION,
    displayNumber: 1,
    chapter: 1,
    titleKey: 'test.title',
    cells: [
      { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 },
      { row: 1, column: 0 }, { row: 1, column: 1 }, { row: 1, column: 2 },
    ],
    pieces: [
      { pieceId: 'p1', typeId: 'pink-triangle', row: 0, column: 0 },
      { pieceId: 'p2', typeId: 'yellow-circle', row: 0, column: 1 },
      { pieceId: 'p3', typeId: 'pink-triangle', row: 0, column: 2 },
      { pieceId: 'p4', typeId: 'red-circle', row: 1, column: 0 },
      { pieceId: 'p5', typeId: 'blue-circle', row: 1, column: 1 },
      { pieceId: 'p6', typeId: 'red-circle', row: 1, column: 2 },
    ],
    targetRows: [
      { rowId: 'r1', slots: ['pink-triangle', 'yellow-circle', 'pink-triangle'] },
      { rowId: 'r2', slots: ['red-circle', 'blue-circle', 'red-circle'] },
    ],
    initialSpins: 2,
    seed: 1,
    generatorVersion: 1,
    tags: ['test'],
    parSpins: 0,
    witness: [],
    ...overrides,
  };
  return level;
}

describe('case A: target matching is not column or click-order bound', () => {
  it('can click yellow, pink, pink to complete the row', () => {
    const level = makeLevel();
    let state = createGame(level);
    let audit = createRunAudit('case-a', 0);

    for (const pieceId of ['p2', 'p1', 'p3']) {
      const result = applyAction(level, state, audit, { kind: 'pick', pieceId });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      audit = result.audit;
    }

    expect(state.targets[0]?.completed).toBe(true);
    expect(state.targets[0]?.filled.map((slot) => slot?.pieceId)).toEqual(['p1', 'p2', 'p3']);
    expect(state.activeTargetIndex).toBe(1);
    expect(state.buffer).toEqual([]);
  });
});

describe('case B: spin releases buffered pieces and advances automatically', () => {
  it('fills red, blue, blue from buffer after one SPIN and keeps one red', () => {
    // Current row requires lilac-diamond/orange-hexagon/green-square; the four
    // picked pieces do not match it, so they must enter the buffer.
    // After SPIN to r2 (red/blue/blue), three pieces auto-fit; the fourth red
    // stays in buffer because r3 (yellow/pink) does not accept it.
    const level = makeLevel({
      cells: [
        { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 }, { row: 0, column: 3 },
        { row: 1, column: 0 }, { row: 1, column: 1 }, { row: 1, column: 2 }, { row: 1, column: 3 }, { row: 1, column: 4 },
      ],
      pieces: [
        { pieceId: 'red-a', typeId: 'red-circle', row: 0, column: 0 },
        { pieceId: 'blue-a', typeId: 'blue-circle', row: 0, column: 1 },
        { pieceId: 'blue-b', typeId: 'blue-circle', row: 0, column: 2 },
        { pieceId: 'red-b', typeId: 'red-circle', row: 0, column: 3 },
        { pieceId: 'target-d', typeId: 'lilac-diamond', row: 1, column: 0 },
        { pieceId: 'target-h', typeId: 'orange-hexagon', row: 1, column: 1 },
        { pieceId: 'target-g', typeId: 'green-square', row: 1, column: 2 },
        { pieceId: 'later-y', typeId: 'yellow-circle', row: 1, column: 3 },
        { pieceId: 'later-p', typeId: 'pink-triangle', row: 1, column: 4 },
      ],
      targetRows: [
        { rowId: 'r1', slots: ['lilac-diamond', 'orange-hexagon', 'green-square'] },
        { rowId: 'r2', slots: ['red-circle', 'blue-circle', 'blue-circle'] },
        { rowId: 'r3', slots: ['yellow-circle', 'pink-triangle'] },
        { rowId: 'r4', slots: ['red-circle'] },
      ],
      initialSpins: 3,
    });
    const session = createSession(level, 'case-b', 0);

    // Buffer all four pieces (none match the current diamond/hexagon/square row).
    for (const pieceId of ['red-a', 'blue-a', 'blue-b', 'red-b']) {
      const result = dispatch(session, level, { kind: 'pick', pieceId });
      expect(result.ok).toBe(true);
    }
    expect(session.state.buffer.map((piece) => piece.typeId)).toEqual(['red-circle', 'blue-circle', 'blue-circle', 'red-circle']);
    expect(session.state.activeTargetIndex).toBe(0);
    expect(session.state.spinsRemaining).toBe(3);

    const spin = dispatch(session, level, { kind: 'spin' });
    expect(spin.ok).toBe(true);
    if (!spin.ok) return;
    expect(spin.state.spinsRemaining).toBe(2);
    // After spinning to r2, red-a/blue-a/blue-b fit; red-b stays buffered.
    expect(spin.state.targets[1]?.completed).toBe(true);
    expect(spin.state.buffer).toEqual([{ pieceId: 'red-b', typeId: 'red-circle' }]);
    // Auto-advance to r3 (yellow/pink) — no match for red-b, so it stays buffered.
    expect(spin.state.activeTargetIndex).toBe(2);
    expect(spin.state.phase).toBe('playing');
    // SPIN back to r1 so target pieces can complete it via settle().
    expect(dispatch(session, level, { kind: 'spin' }).ok).toBe(true);
    expect(session.state.activeTargetIndex).toBe(0);
    // Pick target pieces to complete r1.
    for (const pieceId of ['target-d', 'target-h', 'target-g']) {
      expect(dispatch(session, level, { kind: 'pick', pieceId }).ok).toBe(true);
    }
    expect(session.state.targets[0]?.completed).toBe(true);
    // Pick yellow and pink to complete r3; red-b stays in buffer meanwhile.
    expect(dispatch(session, level, { kind: 'pick', pieceId: 'later-y' }).ok).toBe(true);
    expect(dispatch(session, level, { kind: 'pick', pieceId: 'later-p' }).ok).toBe(true);
    // Auto-advance to r4 releases red-b from the buffer, completing the win.
    expect(session.state.buffer).toEqual([]);
    expect(session.state.phase).toBe('won');
  });
});

describe('case C: four-direction empty-cell connectivity', () => {
  it('does not cross a diagonal and unlocks a side piece only through a four-way empty path', () => {
    const level = makeLevel({
      cells: [
        { row: 0, column: 0 }, { row: 0, column: 1 },
        { row: 1, column: 0 }, { row: 1, column: 1 },
        { row: 2, column: 0 }, { row: 2, column: 1 },
      ],
      pieces: [
        { pieceId: 'exit', typeId: 'yellow-circle', row: 0, column: 0 },
        { pieceId: 'wall-a', typeId: 'pink-triangle', row: 0, column: 1 },
        { pieceId: 'wall-b', typeId: 'cyan-square', row: 1, column: 0 },
        { pieceId: 'wall-c', typeId: 'coral-star', row: 1, column: 1 },
        { pieceId: 'side', typeId: 'red-circle', row: 2, column: 0 },
        { pieceId: 'other', typeId: 'blue-circle', row: 2, column: 1 },
      ],
      targetRows: [
        { rowId: 'r1', slots: ['yellow-circle', 'pink-triangle', 'cyan-square'] },
        { rowId: 'r2', slots: ['coral-star', 'red-circle', 'blue-circle'] },
      ],
    });
    let state = createGame(level);
    let audit = createRunAudit('case-c', 0);

    // `side` touches the removed exit only diagonally after picking wall-a; it
    // remains blocked until a genuine vertical/horizontal empty route exists.
    expect(getSelectablePieceIds(level, state)).toEqual(expect.arrayContaining(['exit', 'wall-a']));
    expect(getSelectablePieceIds(level, state)).not.toContain('side');

    for (const pieceId of ['exit', 'wall-b']) {
      const result = applyAction(level, state, audit, { kind: 'pick', pieceId });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
      audit = result.audit;
    }
    expect(getSelectablePieceIds(level, state)).toContain('side');
  });
});

describe('case D: full buffer can still direct-fit', () => {
  it('does not declare loss while a selectable direct-fit exists', () => {
    const level = makeLevel({
      cells: [
        { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 },
        { row: 0, column: 3 }, { row: 0, column: 4 }, { row: 0, column: 5 },
      ],
      pieces: [
        { pieceId: 'current', typeId: 'yellow-circle', row: 0, column: 0 },
        ...Array.from({ length: 5 }, (_, index) => ({ pieceId: `buffer-${index}`, typeId: 'pink-triangle', row: 0, column: index + 1 })),
      ],
      targetRows: [
        { rowId: 'r1', slots: ['yellow-circle'] },
        { rowId: 'r2', slots: ['pink-triangle', 'pink-triangle', 'pink-triangle'] },
        { rowId: 'r3', slots: ['pink-triangle', 'pink-triangle'] },
      ],
      initialSpins: 0,
    });
    let state = createGame(level);
    const audit = createRunAudit('case-d', 0);
    for (const pieceId of ['buffer-0', 'buffer-1', 'buffer-2', 'buffer-3', 'buffer-4']) {
      const result = applyAction(level, state, audit, { kind: 'pick', pieceId });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }
    expect(state.buffer).toHaveLength(5);
    expect(state.phase).toBe('playing');
    const direct = applyAction(level, state, audit, { kind: 'pick', pieceId: 'current' });
    expect(direct.ok).toBe(true);
    if (direct.ok) {
      expect(direct.state.phase).toBe('won');
    }
  });
});

describe('case E: undo restores an entire automatic chain', () => {
  it('one undo restores the complete pre-action state across multiple auto-completed rows', () => {
    // Two rows; buffer holds pieces for row 2. One direct pick completes row 1,
    // then auto-advance triggers buffered fits completing row 2 (a chain).
    const level = makeLevel({
      cells: [
        { row: 0, column: 0 }, { row: 0, column: 1 }, { row: 0, column: 2 },
        { row: 1, column: 0 }, { row: 1, column: 1 },
      ],
      pieces: [
        { pieceId: 'buffer-a', typeId: 'pink-triangle', row: 0, column: 0 },
        { pieceId: 'buffer-b', typeId: 'pink-triangle', row: 0, column: 1 },
        { pieceId: 'buffer-c', typeId: 'pink-triangle', row: 0, column: 2 },
        { pieceId: 'direct-1', typeId: 'yellow-circle', row: 1, column: 0 },
        { pieceId: 'direct-2', typeId: 'yellow-circle', row: 1, column: 1 },
      ],
      targetRows: [
        { rowId: 'r1', slots: ['yellow-circle', 'yellow-circle'] },
        { rowId: 'r2', slots: ['pink-triangle', 'pink-triangle', 'pink-triangle'] },
      ],
      initialSpins: 1,
    });
    const session = createSession(level, 'case-e', 0);

    // Buffer the three pink triangles (row 1 wants yellow circles).
    for (const pieceId of ['buffer-a', 'buffer-b', 'buffer-c']) {
      expect(dispatch(session, level, { kind: 'pick', pieceId }).ok).toBe(true);
    }
    expect(session.state.buffer).toHaveLength(3);
    expect(session.state.activeTargetIndex).toBe(0);

    const beforeChain = JSON.stringify(session.state);
    // One pick completes row 1 and auto-chains row 2 from buffer.
    expect(dispatch(session, level, { kind: 'pick', pieceId: 'direct-1' }).ok).toBe(true);
    expect(dispatch(session, level, { kind: 'pick', pieceId: 'direct-2' }).ok).toBe(true);
    expect(session.state.phase).toBe('won');

    // Undo the second pick: restore state after direct-1, before row 1 completed.
    expect(undo(session, level)).toBe(true);
    expect(session.state.phase).toBe('playing');
    expect(session.state.targets[0]?.filled.filter(Boolean)).toHaveLength(1);
    expect(session.state.buffer).toHaveLength(3);
    // Undo the first pick: restores the full pre-chain state.
    expect(undo(session, level)).toBe(true);
    expect(JSON.stringify(session.state)).toBe(beforeChain);
    expect(session.state.buffer).toHaveLength(3);
    expect(session.state.activeTargetIndex).toBe(0);
    expect(session.audit.undoCount).toBe(2);
  });
});

describe('atomicity and validation', () => {
  it('invalid actions leave state, history and audit untouched', () => {
    const level = makeLevel();
    const session = createSession(level, 'atomic', 0);
    const stateBefore = session.state;
    const auditBefore = session.audit;
    const result = dispatch(session, level, { kind: 'pick', pieceId: 'unknown' });
    expect(result).toMatchObject({ ok: false, reason: 'gone' });
    expect(session.state).toBe(stateBefore);
    expect(session.audit).toBe(auditBefore);
    expect(session.history).toHaveLength(0);
  });

  it('rejects same-shape different-color and wrong-shape same-color target data', () => {
    const invalid = makeLevel({ targetRows: [{ rowId: 'r1', slots: ['red-circle', 'yellow-circle', 'pink-triangle'] }, { rowId: 'r2', slots: ['red-circle', 'blue-circle', 'red-circle'] }] });
    expect(() => createGame(invalid)).toThrow();
  });

  it('rejects terminal phases inconsistent with the exact victory predicate', () => {
    const level = makeLevel();
    const initial = createGame(level);
    expect(() => validateState(level, { ...initial, phase: 'won' })).toThrow();

    const won = replay(level, [
      { kind: 'pick', pieceId: 'p2' }, { kind: 'pick', pieceId: 'p1' }, { kind: 'pick', pieceId: 'p3' },
      { kind: 'pick', pieceId: 'p4' }, { kind: 'pick', pieceId: 'p5' }, { kind: 'pick', pieceId: 'p6' },
    ]);
    expect(won.ok).toBe(true);
    if (!won.ok) return;
    expect(() => validateState(level, { ...won.state, phase: 'lost' })).toThrow();
    expect(() => validateState(level, { ...initial, phase: 'error' })).toThrow();
  });

  it('save round-trips through only validated serializable data', () => {
    const level = makeLevel();
    const session = createSession(level, 'save', 0);
    dispatch(session, level, { kind: 'pick', pieceId: 'p2' });
    const serialized = serializeSave(createSaveEnvelope(session, 'campaign', 123));
    const restored = deserializeSave(serialized, level);
    expect(restored.state).toEqual(session.state);
    expect(restored.audit).toEqual(session.audit);
    expect(restored.history).toHaveLength(1);
  });

  it('legal actions and every replay step satisfy invariants', () => {
    const level = makeLevel();
    const actions: PlayerAction[] = [
      { kind: 'pick', pieceId: 'p2' },
      { kind: 'pick', pieceId: 'p1' },
      { kind: 'pick', pieceId: 'p3' },
      { kind: 'pick', pieceId: 'p4' },
      { kind: 'pick', pieceId: 'p5' },
      { kind: 'pick', pieceId: 'p6' },
    ];
    const result = replay(level, actions);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe('won');
    result.steps.forEach((step) => expect(() => validateState(level, step.state)).not.toThrow());
    expect(getLegalActions(level, result.state)).toEqual([]);
  });
});
