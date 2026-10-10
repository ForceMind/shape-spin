import { getSelectablePieceIds } from '../core/connectivity';
import { getLegalActions } from '../core/engine';
import { dispatch, undo, type GameSession } from '../core/session';
import type { ActionResult, GameEvent, LevelDefinition, PlayerAction } from '../core/types';
import { CanvasRenderer } from '../render/CanvasRenderer';
import { createRenderSnapshot } from '../render/RenderSnapshot';

export interface GamePresentation {
  readonly level: LevelDefinition;
  readonly session: GameSession;
  readonly selectablePieceIds: ReadonlySet<string>;
  readonly canSpin: boolean;
  readonly remainingPieceCount: number;
}

/**
 * Bridges the deterministic core and CanvasRenderer. It is deliberately the
 * only gameplay-facing layer allowed to call dispatch()/undo(); screens use
 * GamePresentation plus callback results rather than mutating sessions.
 */
export class GameController {
  public constructor(
    private readonly renderer: CanvasRenderer,
    private level: LevelDefinition,
    private session: GameSession,
    private readonly reducedMotion: () => boolean,
  ) {}

  public replace(level: LevelDefinition, session: GameSession): void {
    this.renderer.clear();
    this.level = level;
    this.session = session;
    this.render();
  }

  public presentation(): GamePresentation {
    const selectablePieceIds = new Set(getSelectablePieceIds(this.level, this.session.state));
    return {
      level: this.level,
      session: this.session,
      selectablePieceIds,
      canSpin: getLegalActions(this.level, this.session.state).some((action) => action.kind === 'spin'),
      remainingPieceCount: this.session.state.board.filter((piece) => !piece.removed).length,
    };
  }

  public pick(pieceId: string): ActionResult {
    const result = dispatch(this.session, this.level, { kind: 'pick', pieceId });
    if (result.ok) this.afterAction(result.events);
    else if (result.reason === 'blocked') this.renderer.blocked(pieceId, performance.now());
    return result;
  }

  public spin(): ActionResult {
    const result = dispatch(this.session, this.level, { kind: 'spin' });
    if (result.ok) this.afterAction(result.events);
    return result;
  }

  public undo(): boolean {
    const undone = undo(this.session, this.level);
    if (undone) this.render();
    return undone;
  }

  public render(): void {
    const selectable = new Set(getSelectablePieceIds(this.level, this.session.state));
    this.renderer.render(
      createRenderSnapshot(this.level, this.session.state, selectable, performance.now()),
      this.reducedMotion(),
    );
  }

  public setHover(pieceId: string | null): void {
    this.renderer.hover(pieceId);
  }

  private afterAction(events: readonly GameEvent[]): void {
    this.render();
    this.renderer.consume(events, performance.now());
  }
}
