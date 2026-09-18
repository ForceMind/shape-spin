import { BUFFER_CAPACITY } from './types';
import { positionKey } from './connectivity';
import type { GameState, LevelDefinition, TargetRowState } from './types';

export class RuleValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RuleValidationError';
  }
}

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RuleValidationError(message);
}

function typeCounts(typeIds: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const typeId of typeIds) counts.set(typeId, (counts.get(typeId) ?? 0) + 1);
  return counts;
}

function sameCounts(left: ReadonlyMap<string, number>, right: ReadonlyMap<string, number>): boolean {
  if (left.size !== right.size) return false;
  return [...left].every(([typeId, count]) => right.get(typeId) === count);
}

export function validateLevel(level: LevelDefinition): true {
  invariant(typeof level === 'object' && level !== null, 'Level must be an object');
  invariant(typeof level.levelId === 'string' && level.levelId.length > 0, 'Level ID is required');
  invariant(Array.isArray(level.cells), 'Level cells must be an array');
  invariant(Array.isArray(level.pieces), 'Level pieces must be an array');
  invariant(Array.isArray(level.targetRows), 'Target rows must be an array');
  invariant(level.cells.length > 0, 'Level must contain valid cells');
  invariant(level.initialSpins >= 0 && Number.isInteger(level.initialSpins), 'Initial SPIN must be a non-negative integer');
  invariant(level.targetRows.length > 0, 'Level must contain at least one target row');

  const positions = level.cells.map(positionKey);
  invariant(new Set(positions).size === positions.length, 'Level has duplicate valid cells');
  const validPositions = new Set(positions);
  if (level.exits) {
    invariant(level.exits.length > 0, 'Configured exits cannot be empty');
    const exits = level.exits.map(positionKey);
    invariant(new Set(exits).size === exits.length, 'Level has duplicate exits');
    invariant(exits.every((key) => validPositions.has(key)), 'Exit must be a valid cell');
  }

  const pieceIds = level.pieces.map((piece) => piece.pieceId);
  invariant(pieceIds.length <= level.cells.length, 'A valid cell holds at most one initial piece');
  invariant(pieceIds.length > 0, 'Level must contain at least one piece');
  invariant(new Set(pieceIds).size === pieceIds.length, 'Level has duplicate piece IDs');
  invariant(level.pieces.every((piece) => validPositions.has(positionKey(piece))), 'Piece must occupy a valid cell');
  invariant(new Set(level.pieces.map(positionKey)).size === level.pieces.length, 'Level has multiple pieces in one cell');
  invariant(level.pieces.every((piece) => piece.typeId.length > 0), 'Piece type is required');

  const rowIds = level.targetRows.map((row) => row.rowId);
  invariant(new Set(rowIds).size === rowIds.length, 'Level has duplicate target row IDs');
  invariant(level.targetRows.every((row) => row.slots.length >= 1 && row.slots.length <= 3), 'Target row must have one to three slots');
  invariant(level.targetRows.every((row) => row.slots.every((typeId: string) => typeId.length > 0)), 'Target type is required');

  const supply = typeCounts(level.pieces.map((piece) => piece.typeId));
  const demand = typeCounts(level.targetRows.flatMap((row) => [...row.slots]));
  invariant(sameCounts(supply, demand), 'Target demand and piece supply do not balance');
  return true;
}

function validateTargets(level: LevelDefinition, state: GameState, allPieces: ReadonlyMap<string, string>): void {
  invariant(state.targets.length === level.targetRows.length, 'Target state length changed');
  const filledPieceIds: string[] = [];
  state.targets.forEach((target, rowIndex) => {
    const definition = level.targetRows[rowIndex];
    invariant(definition !== undefined, 'Unknown target row');
    validateTarget(target, definition.rowId, definition.slots, allPieces, filledPieceIds);
  });
  invariant(new Set(filledPieceIds).size === filledPieceIds.length, 'Piece filled more than once');
}

function validateTarget(target: TargetRowState, expectedId: string, slots: readonly string[], allPieces: ReadonlyMap<string, string>, filledPieceIds: string[]): void {
  invariant(target.rowId === expectedId, 'Target row identity changed');
  invariant(target.filled.length === slots.length, 'Target slot width changed');
  target.filled.forEach((filled, slotIndex) => {
    if (!filled) return;
    invariant(allPieces.get(filled.pieceId) === slots[slotIndex], 'Filled piece does not match target type');
    invariant(filled.typeId === slots[slotIndex], 'Filled type does not match target slot');
    filledPieceIds.push(filled.pieceId);
  });
  invariant(target.completed === target.filled.every(Boolean), 'Target completion flag does not match filled slots');
}

export function validateState(level: LevelDefinition, state: GameState): true {
  validateLevel(level);
  invariant(typeof state === 'object' && state !== null, 'State must be an object');
  invariant(Array.isArray(state.board), 'Board state must be an array');
  invariant(Array.isArray(state.buffer), 'Buffer state must be an array');
  invariant(Array.isArray(state.targets), 'Target state must be an array');
  invariant(['playing', 'won', 'lost', 'error'].includes(state.phase), 'Game phase invalid');
  invariant(Number.isInteger(state.moves) && state.moves >= 0, 'Move count invalid');
  invariant(state.board.length === level.pieces.length, 'Board state length changed');
  invariant(state.buffer.length <= BUFFER_CAPACITY, 'Buffer capacity exceeded');
  invariant(state.spinsRemaining >= 0 && state.spinsRemaining <= level.initialSpins && Number.isInteger(state.spinsRemaining), 'SPIN state invalid');
  invariant(state.activeTargetIndex >= 0 && state.activeTargetIndex < state.targets.length && Number.isInteger(state.activeTargetIndex), 'Active target index invalid');

  const definitions = new Map(level.pieces.map((piece) => [piece.pieceId, piece]));
  invariant(state.board.every((piece) => {
    const definition = definitions.get(piece.pieceId);
    return definition !== undefined && definition.typeId === piece.typeId && definition.row === piece.row && definition.column === piece.column;
  }), 'Board piece changed from definition');
  invariant(new Set(state.board.map((piece) => piece.pieceId)).size === state.board.length, 'Duplicate board piece');

  const typeByPieceId = new Map(level.pieces.map((piece) => [piece.pieceId, piece.typeId]));
  validateTargets(level, state, typeByPieceId);
  const filledIds = state.targets.flatMap((target) => target.filled.filter((filled): filled is NonNullable<typeof filled> => filled !== null).map((filled) => filled.pieceId));
  const bufferIds = state.buffer.map((piece) => piece.pieceId);
  invariant(bufferIds.every((pieceId, index) => typeByPieceId.get(pieceId) === state.buffer[index]?.typeId), 'Buffer piece type changed');
  const used = [...filledIds, ...bufferIds];
  invariant(new Set(used).size === used.length, 'Piece appears in multiple destinations');

  const removedIds = state.board.filter((piece) => piece.removed).map((piece) => piece.pieceId);
  invariant(removedIds.length === used.length && removedIds.every((pieceId) => used.includes(pieceId)), 'Piece conservation broken');
  const isVictory = removedIds.length === state.board.length && state.buffer.length === 0 && state.targets.every((target) => target.completed);
  invariant((state.phase === 'won') === isVictory, 'Game phase does not match victory state');
  // `lost` is committed only by the engine after it checks legal picks and SPIN.
  // Validation intentionally does not duplicate that search, avoiding a cycle with engine.ts.
  invariant(state.phase !== 'error', 'Error states are not valid resumable game states');
  return true;
}
