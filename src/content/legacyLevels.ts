import { RULE_VERSION } from '../core/types';
import type { CellPosition, LegacyTypeKey, LevelDefinition, PieceDefinition, PlayerAction } from '../core/types';
import { typeIdFromLegacyKey } from './pieceTypes';

export interface LegacyLevelSource {
  readonly displayNumber: number;
  readonly titleKey: string;
  readonly mask: readonly string[];
  readonly keys: readonly LegacyTypeKey[];
  readonly goals: readonly (readonly LegacyTypeKey[])[];
  readonly spins: number;
  readonly seed: number;
  readonly tags: readonly string[];
  readonly legacyPlan: readonly number[];
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffle<T>(values: T[], random: () => number): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = values[index];
    values[index] = values[swapIndex] as T;
    values[swapIndex] = value as T;
  }
  return values;
}

function positionsFromMask(mask: readonly string[]): CellPosition[] {
  return mask.flatMap((row, rowIndex) => [...row].flatMap((value, columnIndex) => value === '1' ? [{ row: rowIndex, column: columnIndex }] : []));
}

function oldSelectable(pieces: readonly (CellPosition & { readonly index: number; removed: boolean })[]): number[] {
  const byPosition = new Map(pieces.map((piece) => [`${piece.row},${piece.column}`, piece]));
  const open = new Set<number>();
  const queue: typeof pieces[number][] = [];
  for (const piece of pieces) {
    if (piece.row === 0 && piece.removed) {
      open.add(piece.index);
      queue.push(piece);
    }
  }
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const piece = queue[queueIndex];
    if (!piece) continue;
    for (const [rowOffset, columnOffset] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const neighbor = byPosition.get(`${piece.row + rowOffset},${piece.column + columnOffset}`);
      if (neighbor?.removed && !open.has(neighbor.index)) {
        open.add(neighbor.index);
        queue.push(neighbor);
      }
    }
  }
  const DIRECTIONS: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  return pieces.filter((piece) => !piece.removed && (piece.row === 0 || DIRECTIONS.some((dir) => {
    const rowOffset = dir[0];
    const columnOffset = dir[1];
    const neighbor = byPosition.get(`${piece.row + rowOffset},${piece.column + columnOffset}`);
    return neighbor !== undefined && open.has(neighbor.index);
  }))).map((piece) => piece.index);
}

function reproduceGenerated(displayNumber: number, titleKey: string, mask: readonly string[], palette: readonly LegacyTypeKey[], spins: number, seed: number, windowSize: number, tags: readonly string[]): LegacyLevelSource {
  const random = mulberry32(seed);
  const count = positionsFromMask(mask).length;
  const keys = shuffle(Array.from({ length: count }, (_, index) => palette[index % palette.length] as LegacyTypeKey), random);
  const sandbox = positionsFromMask(mask).map((position, index) => ({ ...position, index, removed: false }));
  const legacyPlan: number[] = [];
  while (sandbox.some((piece) => !piece.removed)) {
    const options = oldSelectable(sandbox);
    if (options.length === 0) throw new Error('Disconnected legacy level mask');
    const selected = options[Math.floor(random() * options.length)];
    if (selected === undefined) throw new Error('Legacy generation selected no piece');
    const piece = sandbox[selected];
    if (!piece) throw new Error('Legacy generation selected invalid piece');
    piece.removed = true;
    legacyPlan.push(selected);
  }
  const goalOrder: number[] = [];
  for (let index = 0; index < legacyPlan.length; index += windowSize) goalOrder.push(...shuffle(legacyPlan.slice(index, index + windowSize), random));
  const goals: LegacyTypeKey[][] = [];
  for (let index = 0; index < goalOrder.length; index += 3) {
    goals.push(goalOrder.slice(index, index + 3).map((pieceIndex) => keys[pieceIndex] as LegacyTypeKey));
  }
  return { displayNumber, titleKey, mask, keys, goals, spins, seed, tags, legacyPlan };
}

export const AUTHORED_SOURCES: LegacyLevelSource[] = [
  {
    displayNumber: 1,
    titleKey: 'level.001.title',
    mask: ['111', '111', '111', '111'],
    keys: ['Y', 'P', 'P', 'C', 'Y', 'Y', 'R', 'P', 'C', 'R', 'R', 'C'],
    goals: [['P', 'Y', 'P'], ['R', 'Y', 'Y'], ['C', 'C', 'C'], ['P', 'R', 'R']],
    spins: 0,
    seed: 0,
    tags: ['legacy', 'tutorial', 'authored'],
    legacyPlan: [0, 1, 2, 3, 4, 5, 6, 8, 11, 7, 9, 10],
  },
  {
    displayNumber: 3,
    titleKey: 'level.003.title',
    mask: ['01110', '11111', '01110', '11111'],
    keys: ['O', 'B', 'B', 'H', 'O', 'B', 'O', 'H', 'G', 'D', 'D', 'G', 'G', 'H', 'B', 'D'],
    goals: [['D', 'H', 'G'], ['O', 'B', 'B'], ['B', 'H', 'H'], ['D', 'G', 'G'], ['O', 'O', 'D'], ['B']],
    spins: 3,
    seed: 0,
    tags: ['legacy', 'spin-tutorial', 'authored'],
    legacyPlan: [0, 1, 2, 4, 3, 8, 9, 5, 6, 7, 13, 10, 12, 11, 14, 15],
  },
];

export const GENERATED_SOURCES: LegacyLevelSource[] = [
  reproduceGenerated(2, 'level.002.title', ['111', '111', '111', '111', '111'], ['Y', 'P', 'C', 'R'], 2, 2126, 5, ['legacy', 'generated']),
  reproduceGenerated(4, 'level.004.title', ['01110', '11111', '11011', '11111', '01110'], ['B', 'O', 'G', 'H', 'D'], 2, 4103, 6, ['legacy', 'generated', 'side-path']),
  reproduceGenerated(5, 'level.005.title', ['01110', '01110', '11111', '01110', '11111'], ['P', 'C', 'Y', 'R', 'H'], 2, 5901, 6, ['legacy', 'generated', 'corridor']),
  reproduceGenerated(6, 'level.006.title', ['11111', '11111', '11111', '11111', '11111'], ['B', 'O', 'C', 'G', 'D'], 3, 6488, 6, ['legacy', 'generated', 'same-shape']),
  reproduceGenerated(7, 'level.007.title', ['01110', '11111', '10101', '11111', '11111'], ['Y', 'P', 'C', 'O', 'G', 'H', 'D'], 2, 7375, 6, ['legacy', 'generated', 'buffer']),
  reproduceGenerated(8, 'level.008.title', ['11111', '11111', '11011', '11111', '11111'], ['Y', 'P', 'C', 'R', 'O', 'B', 'G', 'H'], 2, 8831, 6, ['legacy', 'generated', 'challenge']),
];

function toLevel(source: LegacyLevelSource): LevelDefinition {
  const levelId = `campaign-${String(source.displayNumber).padStart(3, '0')}`;
  const cells = positionsFromMask(source.mask);
  const pieces: PieceDefinition[] = cells.map((position, index) => ({ ...position, pieceId: `${levelId}-piece-${String(index).padStart(2, '0')}`, typeId: typeIdFromLegacyKey(source.keys[index] as LegacyTypeKey) }));
  // Witness is generated from the legacy plan via seedWitness() and validated
  // by replaying through the production engine. See scripts/validate-levels.ts.
  const witness: PlayerAction[] = source.legacyPlan.length > 0
    ? source.legacyPlan.map((pieceIndex) => ({ kind: 'pick' as const, pieceId: `${levelId}-piece-${String(pieceIndex).padStart(2, '0')}` }))
    : [];
  return {
    levelId,
    contentVersion: 1,
    ruleVersion: RULE_VERSION,
    displayNumber: source.displayNumber,
    chapter: 1,
    titleKey: source.titleKey,
    cells,
    pieces,
    targetRows: source.goals.map((slots, index) => ({ rowId: `${levelId}-target-${index}`, slots: slots.map(typeIdFromLegacyKey) })),
    initialSpins: source.spins,
    seed: source.seed,
    generatorVersion: source.seed === 0 ? 0 : 1,
    tags: source.tags,
    parSpins: 0,
    witness,
  };
}

export const LEGACY_LEVELS: readonly LevelDefinition[] = [...AUTHORED_SOURCES, ...GENERATED_SOURCES]
  .sort((left, right) => left.displayNumber - right.displayNumber)
  .map(toLevel);
