/**
 * Pure, serializable game-domain model.
 * No DOM, Canvas, audio, timers, or browser APIs may be imported here.
 */

export const BUFFER_CAPACITY = 5;
export const RULE_VERSION = 2;

export type Locale = 'en' | 'zh-CN';
export type Mode = 'campaign' | 'daily' | 'practice' | 'editor';
export type GamePhase = 'playing' | 'won' | 'lost' | 'error';

export interface PieceType {
  /** Stable gameplay identity; theme colours never change this value. */
  readonly typeId: string;
  readonly shapeId: ShapeId;
  readonly colorId: ColorId;
  readonly legacyKey?: LegacyTypeKey;
}

export type ShapeId = 'circle' | 'triangle' | 'square' | 'star' | 'hexagon' | 'diamond';
export type ColorId = 'yellow' | 'pink' | 'cyan' | 'coral' | 'red' | 'blue' | 'green' | 'orange' | 'lilac';
export type LegacyTypeKey = 'Y' | 'P' | 'C' | 'R' | 'O' | 'B' | 'G' | 'H' | 'D';

export interface CellPosition {
  readonly row: number;
  readonly column: number;
}

export interface PieceDefinition extends CellPosition {
  readonly pieceId: string;
  readonly typeId: string;
}

/** A target row always has one to three slots; no empty row is legal. */
export interface TargetRowDefinition {
  readonly rowId: string;
  readonly slots: readonly string[];
}

export interface LevelDefinition {
  readonly levelId: string;
  readonly contentVersion: number;
  readonly ruleVersion: number;
  readonly displayNumber: number;
  readonly chapter: number;
  readonly titleKey: string;
  /** Every listed position is a valid cell; omitted positions are walls. */
  readonly cells: readonly CellPosition[];
  readonly exits?: readonly CellPosition[];
  readonly pieces: readonly PieceDefinition[];
  readonly targetRows: readonly TargetRowDefinition[];
  readonly initialSpins: number;
  readonly seed: number;
  readonly generatorVersion: number;
  readonly tags: readonly string[];
  readonly parSpins: number;
  /** A replayable action witness is authored/generated only after engine validation. */
  readonly witness: readonly PlayerAction[];
}

export interface BoardPiece extends PieceDefinition {
  removed: boolean;
}

export interface FilledSlot {
  readonly pieceId: string;
  readonly typeId: string;
}

export interface TargetRowState {
  readonly rowId: string;
  filled: (FilledSlot | null)[];
  completed: boolean;
}

/** Reversible state; transactions mutate only a deep-cloned candidate. */
export interface GameState {
  board: BoardPiece[];
  buffer: FilledSlot[];
  targets: TargetRowState[];
  activeTargetIndex: number;
  spinsRemaining: number;
  moves: number;
  phase: GamePhase;
}

/** Attempt statistics intentionally remain outside undo snapshots. */
export interface RunAudit {
  readonly runId: string;
  readonly startedAtMs: number;
  hintCount: number;
  undoCount: number;
  spinsUsed: number;
}

export type PlayerAction =
  | { readonly kind: 'pick'; readonly pieceId: string }
  | { readonly kind: 'spin' };

export type GameEvent =
  | { readonly type: 'picked'; readonly pieceId: string }
  | { readonly type: 'stored'; readonly pieceId: string; readonly typeId: string; readonly bufferIndex: number }
  | { readonly type: 'fitted'; readonly pieceId: string; readonly typeId: string; readonly rowIndex: number; readonly slotIndex: number; readonly source: 'board' | 'buffer' }
  | { readonly type: 'rowCompleted'; readonly rowIndex: number }
  | { readonly type: 'rotated'; readonly from: number; readonly to: number; readonly reason: 'spin' | 'auto' }
  | { readonly type: 'won' }
  | { readonly type: 'lost' };

export type RejectionReason = 'ended' | 'gone' | 'blocked' | 'full' | 'no-spins' | 'last-row' | 'invalid-action';

export type ActionResult =
  | { readonly ok: true; readonly state: GameState; readonly audit: RunAudit; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly reason: RejectionReason; readonly state: GameState; readonly audit: RunAudit; readonly events: readonly [] };

export interface SaveEnvelope {
  readonly schemaVersion: number;
  readonly ruleVersion: number;
  readonly savedAtMs: number;
  readonly mode: Mode;
  readonly levelId: string;
  readonly state: GameState;
  readonly history: readonly GameState[];
  readonly audit: RunAudit;
}
