import type { ColorId, LegacyTypeKey, PieceType, ShapeId } from '../core/types';

/**
 * Stable compatibility mapping for all original Demo types.
 * Rendering themes may supply colours separately; game rules use typeId only.
 */
const legacy = <T extends PieceType>(value: T): T => value;

export const PIECE_TYPES: Readonly<Record<LegacyTypeKey, PieceType>> = {
  Y: legacy({ typeId: 'yellow-circle', shapeId: 'circle', colorId: 'yellow', legacyKey: 'Y' }),
  P: legacy({ typeId: 'pink-triangle', shapeId: 'triangle', colorId: 'pink', legacyKey: 'P' }),
  C: legacy({ typeId: 'cyan-square', shapeId: 'square', colorId: 'cyan', legacyKey: 'C' }),
  R: legacy({ typeId: 'coral-star', shapeId: 'star', colorId: 'coral', legacyKey: 'R' }),
  O: legacy({ typeId: 'red-circle', shapeId: 'circle', colorId: 'red', legacyKey: 'O' }),
  B: legacy({ typeId: 'blue-circle', shapeId: 'circle', colorId: 'blue', legacyKey: 'B' }),
  G: legacy({ typeId: 'green-square', shapeId: 'square', colorId: 'green', legacyKey: 'G' }),
  H: legacy({ typeId: 'orange-hexagon', shapeId: 'hexagon', colorId: 'orange', legacyKey: 'H' }),
  D: legacy({ typeId: 'lilac-diamond', shapeId: 'diamond', colorId: 'lilac', legacyKey: 'D' }),
} as const;

export const LEGACY_TYPE_KEYS = Object.keys(PIECE_TYPES) as LegacyTypeKey[];

export function typeIdFromLegacyKey(key: LegacyTypeKey): string {
  return PIECE_TYPES[key].typeId;
}

export function legacyKeyFromTypeId(typeId: string): LegacyTypeKey | undefined {
  return LEGACY_TYPE_KEYS.find((key) => PIECE_TYPES[key].typeId === typeId);
}

export function typeMatches(left: PieceType, right: PieceType): boolean {
  return left.shapeId === right.shapeId && left.colorId === right.colorId;
}

export function isKnownShapeId(value: string): value is ShapeId {
  return ['circle', 'triangle', 'square', 'star', 'hexagon', 'diamond'].includes(value);
}
