import type { CellPosition, LevelDefinition } from '../core/types';

export interface LayoutTemplate {
  readonly id: string;
  readonly mask: readonly string[];
  readonly tags: readonly string[];
}

/**
 * Distinct authored topology families. These are intentionally stable rather
 * than random masks: difficulty comes from structure + target ordering, not
 * colour swaps or raw piece count alone.
 */
export const LAYOUT_TEMPLATES: readonly LayoutTemplate[] = [
  { id: 'rectangle', mask: ['1111', '1111', '1111', '1111'], tags: ['rectangle'] },
  { id: 'stair', mask: ['1110', '1111', '0111', '0011', '0011'], tags: ['stair'] },
  { id: 'cross', mask: ['01110', '11111', '01110', '11111', '01110'], tags: ['cross'] },
  { id: 'double-wing', mask: ['11011', '11111', '01110', '11111', '11011'], tags: ['double-wing'] },
  { id: 'corridor', mask: ['01110', '01110', '11111', '01010', '11111'], tags: ['corridor'] },
  { id: 'central-gap', mask: ['11111', '11011', '11011', '11111', '11111'], tags: ['central-gap'] },
  { id: 'narrow-neck', mask: ['11111', '00100', '11111', '11111', '11111'], tags: ['narrow-neck'] },
  { id: 'branches', mask: ['10101', '11111', '01010', '11111', '10101'], tags: ['branches'] },
  { id: 'u-shape', mask: ['11111', '10001', '10001', '11111', '11111'], tags: ['u-shape'] },
  { id: 'notched', mask: ['11111', '11101', '11011', '10111', '11111'], tags: ['notched'] },
] as const;

export function templateForCampaignLevel(displayNumber: number): LayoutTemplate {
  // Levels 1–8 remain the original Demo baseline. New content begins using
  // authored topology families immediately at level 9.
  const templateIndex = Math.max(0, displayNumber - 9) % LAYOUT_TEMPLATES.length;
  return LAYOUT_TEMPLATES[templateIndex] ?? LAYOUT_TEMPLATES[0]!;
}

export function cellsFromMask(mask: readonly string[]): CellPosition[] {
  return mask.flatMap((row, rowIndex) => [...row].flatMap((value, columnIndex) => value === '1' ? [{ row: rowIndex, column: columnIndex }] : []));
}

/** Fingerprint topology + type equality relation + target sequence + SPIN. */
export function levelFingerprint(level: LevelDefinition): string {
  const cells = new Set(level.cells.map((cell) => `${cell.row},${cell.column}`));
  const maxRow = Math.max(...level.cells.map((cell) => cell.row));
  const maxColumn = Math.max(...level.cells.map((cell) => cell.column));
  const mask = Array.from({ length: maxRow + 1 }, (_, row) => Array.from({ length: maxColumn + 1 }, (_, column) => cells.has(`${row},${column}`) ? '1' : '0').join('')).join('/');
  const typeOrder = new Map<string, number>();
  const normalized = (typeId: string): number => {
    const known = typeOrder.get(typeId);
    if (known !== undefined) return known;
    const next = typeOrder.size;
    typeOrder.set(typeId, next);
    return next;
  };
  const pieces = [...level.pieces].sort((a, b) => a.row - b.row || a.column - b.column).map((piece) => normalized(piece.typeId)).join(',');
  const targets = level.targetRows.map((row) => row.slots.map(normalized).join(',')).join('|');
  const exits = (level.exits ?? level.cells.filter((cell) => cell.row === 0)).map((cell) => `${cell.row},${cell.column}`).sort().join(';');
  return `${mask}#${exits}#${pieces}#${targets}#${level.initialSpins}`;
}
