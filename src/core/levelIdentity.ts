import type { LevelDefinition } from './types';

/** Exact identity for resumable state, not a difficulty/dedup fingerprint. */
export function levelContentIdentity(level: LevelDefinition): string {
  const cells = [...level.cells].map(({ row, column }) => `${row},${column}`).sort();
  const exits = level.exits === undefined ? null : [...level.exits].map(({ row, column }) => `${row},${column}`).sort();
  const pieces = [...level.pieces]
    .map(({ pieceId, row, column, typeId }) => [pieceId, row, column, typeId] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const targets = level.targetRows.map(({ rowId, slots }) => [rowId, [...slots]]);
  const normalized = JSON.stringify([
    level.ruleVersion,
    level.contentVersion,
    level.initialSpins,
    cells,
    exits,
    pieces,
    targets,
  ]);
  // FNV-1a over UTF-16 code units; deterministic in browsers and Node.
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = Math.imul(hash ^ normalized.charCodeAt(index), 0x01000193);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}-${normalized.length}`;
}
