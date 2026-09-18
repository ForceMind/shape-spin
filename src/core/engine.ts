import { BUFFER_CAPACITY } from './types';
import { getSelectablePieceIds } from './connectivity';
import { validateLevel, validateState } from './validation';
import type { ActionResult, GameEvent, GameState, LevelDefinition, PlayerAction, RejectionReason, RunAudit, TargetRowState } from './types';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function createGame(level: LevelDefinition): GameState {
  validateLevel(level);
  const state: GameState = {
    board: level.pieces.map((piece) => ({ ...piece, removed: false })),
    buffer: [],
    targets: level.targetRows.map((row) => ({ rowId: row.rowId, filled: row.slots.map(() => null), completed: false })),
    activeTargetIndex: 0,
    spinsRemaining: level.initialSpins,
    moves: 0,
    phase: 'playing',
  };
  validateState(level, state);
  return state;
}

export function createRunAudit(runId: string, startedAtMs: number): RunAudit {
  return { runId, startedAtMs, hintCount: 0, undoCount: 0, spinsUsed: 0 };
}

function activeSlotIndex(level: LevelDefinition, state: GameState, typeId: string): number {
  const target = state.targets[state.activeTargetIndex];
  const definition = level.targetRows[state.activeTargetIndex];
  if (!target || !definition) return -1;
  return definition.slots.findIndex((expected, index) => expected === typeId && target.filled[index] === null);
}

function nextUnfinishedTarget(state: GameState): { readonly index: number; readonly distance: number } | undefined {
  for (let distance = 1; distance < state.targets.length; distance += 1) {
    const index = (state.activeTargetIndex + distance) % state.targets.length;
    if (!state.targets[index]?.completed) return { index, distance };
  }
  return undefined;
}

function canSpin(state: GameState): boolean {
  return state.spinsRemaining > 0 && nextUnfinishedTarget(state) !== undefined;
}

function fitAt(targets: TargetRowState[], activeTargetIndex: number, slotIndex: number, typeId: string, pieceId: string, source: 'board' | 'buffer', events: GameEvent[]): void {
  const target = targets[activeTargetIndex];
  if (!target || target.filled[slotIndex] !== null) throw new Error('Attempted invalid fit');
  target.filled[slotIndex] = { pieceId, typeId };
  events.push({ type: 'fitted', pieceId, typeId, rowIndex: activeTargetIndex, slotIndex, source });
}

/** Deterministic bounded automatic settlement. */
export function settle(level: LevelDefinition, state: GameState): readonly GameEvent[] {
  const events: GameEvent[] = [];

  // A successful iteration removes a buffered piece or completes a previously
  // incomplete row; the cap makes accidental non-progress a deterministic error.
  const limit = state.buffer.length + state.targets.length + 1;
  for (let iteration = 0; iteration < limit; iteration += 1) {
    const active = state.targets[state.activeTargetIndex];
    const definition = level.targetRows[state.activeTargetIndex];
    if (!active || !definition) throw new Error('Active target missing');

    let fittedAny = false;
    for (let bufferIndex = 0; bufferIndex < state.buffer.length;) {
      const buffered = state.buffer[bufferIndex];
      if (!buffered) break;
      const slotIndex = definition.slots.findIndex((typeId, index) => typeId === buffered.typeId && active.filled[index] === null);
      if (slotIndex < 0) {
        bufferIndex += 1;
        continue;
      }
      fitAt(state.targets, state.activeTargetIndex, slotIndex, buffered.typeId, buffered.pieceId, 'buffer', events);
      state.buffer.splice(bufferIndex, 1);
      fittedAny = true;
    }

    if (!active.filled.every(Boolean)) {
      if (!fittedAny) break;
      continue;
    }
    if (!active.completed) {
      active.completed = true;
      events.push({ type: 'rowCompleted', rowIndex: state.activeTargetIndex });
    }

    const allRemoved = state.board.every((piece) => piece.removed);
    if (allRemoved && state.buffer.length === 0 && state.targets.every((target) => target.completed)) {
      state.phase = 'won';
      events.push({ type: 'won' });
      break;
    }
    const next = nextUnfinishedTarget(state);
    if (!next) throw new Error('Finished targets without a win');
    const from = state.activeTargetIndex;
    state.activeTargetIndex = next.index;
    events.push({ type: 'rotated', from, to: next.index, reason: 'auto' });
  }
  return events;
}

function reject(state: GameState, audit: RunAudit, reason: RejectionReason): ActionResult {
  return { ok: false, reason, state, audit, events: [] };
}

function stateHasLegalPick(level: LevelDefinition, state: GameState): boolean {
  return getSelectablePieceIds(level, state).some((pieceId) => {
    const piece = state.board.find((entry) => entry.pieceId === pieceId);
    return piece !== undefined && (activeSlotIndex(level, state, piece.typeId) >= 0 || state.buffer.length < BUFFER_CAPACITY);
  });
}

function finishIfStuck(level: LevelDefinition, state: GameState, events: GameEvent[]): void {
  if (state.phase !== 'playing') return;
  if (!stateHasLegalPick(level, state) && !canSpin(state)) {
    state.phase = 'lost';
    events.push({ type: 'lost' });
  }
}

/**
 * Executes one player action as an all-or-nothing transaction. audit is updated
 * only for committed player actions; invalid input returns original references.
 */
export function applyAction(level: LevelDefinition, state: GameState, audit: RunAudit, action: PlayerAction): ActionResult {
  validateState(level, state);
  if (state.phase !== 'playing') return reject(state, audit, 'ended');

  const next = clone(state) as GameState;
  const nextAudit = clone(audit) as RunAudit;
  const events: GameEvent[] = [];

  if (action.kind === 'pick') {
    const piece = next.board.find((entry) => entry.pieceId === action.pieceId);
    if (!piece || piece.removed) return reject(state, audit, 'gone');
    if (!getSelectablePieceIds(level, next).includes(piece.pieceId)) return reject(state, audit, 'blocked');
    const slotIndex = activeSlotIndex(level, next, piece.typeId);
    if (slotIndex < 0 && next.buffer.length >= BUFFER_CAPACITY) return reject(state, audit, 'full');

    piece.removed = true;
    next.moves += 1;
    events.push({ type: 'picked', pieceId: piece.pieceId });
    if (slotIndex >= 0) fitAt(next.targets, next.activeTargetIndex, slotIndex, piece.typeId, piece.pieceId, 'board', events);
    else {
      next.buffer.push({ pieceId: piece.pieceId, typeId: piece.typeId });
      events.push({ type: 'stored', pieceId: piece.pieceId, typeId: piece.typeId, bufferIndex: next.buffer.length - 1 });
    }
  } else if (action.kind === 'spin') {
    if (next.spinsRemaining <= 0) return reject(state, audit, 'no-spins');
    const destination = nextUnfinishedTarget(next);
    if (!destination) return reject(state, audit, 'last-row');
    const from = next.activeTargetIndex;
    next.spinsRemaining -= 1;
    next.moves += 1;
    next.activeTargetIndex = destination.index;
    nextAudit.spinsUsed += 1;
    events.push({ type: 'rotated', from, to: destination.index, reason: 'spin' });
  } else {
    return reject(state, audit, 'invalid-action');
  }

  events.push(...settle(level, next));
  finishIfStuck(level, next, events);
  validateState(level, next);
  return { ok: true, state: next, audit: nextAudit, events };
}

export function getLegalActions(level: LevelDefinition, state: GameState): readonly PlayerAction[] {
  if (state.phase !== 'playing') return [];
  const picks = getSelectablePieceIds(level, state)
    .filter((pieceId) => {
      const piece = state.board.find((entry) => entry.pieceId === pieceId);
      return piece !== undefined && (activeSlotIndex(level, state, piece.typeId) >= 0 || state.buffer.length < BUFFER_CAPACITY);
    })
    .map((pieceId) => ({ kind: 'pick' as const, pieceId }));
  return canSpin(state) ? [...picks, { kind: 'spin' }] : picks;
}
