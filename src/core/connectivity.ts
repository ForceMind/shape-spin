import type { BoardPiece, CellPosition, GameState, LevelDefinition } from './types';

const DIRECTIONS: readonly CellPosition[] = [
  { row: -1, column: 0 },
  { row: 1, column: 0 },
  { row: 0, column: -1 },
  { row: 0, column: 1 },
];

export function positionKey(position: CellPosition): string {
  return `${position.row},${position.column}`;
}

export function defaultExits(level: LevelDefinition): readonly CellPosition[] {
  if (level.exits && level.exits.length > 0) return level.exits;
  return level.cells.filter((cell) => cell.row === 0);
}

function neighbors(position: CellPosition): readonly CellPosition[] {
  return DIRECTIONS.map(({ row, column }) => ({ row: position.row + row, column: position.column + column }));
}

/**
 * Finds empty valid cells reachable from an exit. A removed piece is empty; walls
 * and omitted cells never participate. This is the only movement test used by rules.
 */
export function reachableEmptyCells(level: LevelDefinition, state: GameState): ReadonlySet<string> {
  const validCells = new Set(level.cells.map(positionKey));
  const occupied = new Set(state.board.filter((piece) => !piece.removed).map(positionKey));
  const reachable = new Set<string>();
  const queue: CellPosition[] = [];

  for (const exit of defaultExits(level)) {
    const key = positionKey(exit);
    if (validCells.has(key) && !occupied.has(key) && !reachable.has(key)) {
      reachable.add(key);
      queue.push(exit);
    }
  }

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (!current) continue;
    for (const candidate of neighbors(current)) {
      const key = positionKey(candidate);
      if (validCells.has(key) && !occupied.has(key) && !reachable.has(key)) {
        reachable.add(key);
        queue.push(candidate);
      }
    }
  }

  return reachable;
}

/**
 * A piece may be removed when its own position becomes connected to an exit once
 * removed. This directly implements the frozen rule rather than approximating it
 * with a top-row or board-edge shortcut.
 */
export function isPieceSelectable(level: LevelDefinition, state: GameState, piece: BoardPiece): boolean {
  if (piece.removed) return false;
  const boardWithoutPiece: GameState = {
    ...state,
    board: state.board.map((entry) => entry.pieceId === piece.pieceId ? { ...entry, removed: true } : entry),
  };
  return reachableEmptyCells(level, boardWithoutPiece).has(positionKey(piece));
}

export function getSelectablePieceIds(level: LevelDefinition, state: GameState): readonly string[] {
  return state.board
    .filter((piece) => isPieceSelectable(level, state, piece))
    .map((piece) => piece.pieceId);
}
