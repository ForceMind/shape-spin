import type { GameEvent } from '../core/types';
import { BoardRenderer, type BoardGeometry } from './BoardRenderer';
import { BufferRenderer } from './BufferRenderer';
import { EffectsRenderer } from './EffectsRenderer';
import { DESIGN_HEIGHT, DESIGN_WIDTH, drawBackground } from './RenderPrimitives';
import type { RenderSnapshot } from './RenderSnapshot';
import { ReelRenderer } from './ReelRenderer';

/**
 * Single Canvas owner, modelled after Arrow Flow's BoardRenderer ownership
 * pattern. It consumes RenderSnapshot and GameEvent, never GameSession.
 */
export class CanvasRenderer {
  public readonly reel = new ReelRenderer();
  public readonly buffer = new BufferRenderer();
  public readonly board = new BoardRenderer();
  public readonly effects = new EffectsRenderer();
  private frameId = 0;
  private snapshot: RenderSnapshot | null = null;
  private previousSnapshot: RenderSnapshot | null = null;
  private reducedMotion = false;
  private lastBoardGeometry: BoardGeometry | null = null;

  public constructor(private readonly canvas: HTMLCanvasElement) {
    this.resize();
  }

  public resize(): void {
    const shell = document.getElementById('game');
    if (!shell) return;
    const rect = shell.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  public render(snapshot: RenderSnapshot, reducedMotion: boolean): void {
    const wasEmpty = this.snapshot === null;
    this.previousSnapshot = this.snapshot;
    this.snapshot = snapshot;
    this.reducedMotion = reducedMotion;
    if (wasEmpty || reducedMotion) this.reel.snapTo(snapshot.state.activeTargetIndex);
    this.buffer.observe(snapshot, snapshot.timestampMs);
    this.draw(snapshot.timestampMs);
  }

  public hover(pieceId: string | null): void {
    this.board.setHovered(pieceId);
    if (this.snapshot) this.draw(performance.now());
  }

  public blocked(pieceId: string, now: number): void {
    this.board.shake(pieceId, now);
    this.startLoop();
  }

  public consume(events: readonly GameEvent[], now: number): void {
    if (!this.snapshot) return;
    for (const event of events) {
      if (event.type === 'stored') {
        const from = this.boardPoint(event.pieceId, this.previousSnapshot) ?? { x: 215, y: 700 };
        const to = BufferRenderer.position(event.bufferIndex);
        this.effects.addFlight({ typeId: event.typeId, from, to, size: this.lastBoardGeometry?.cell ?? 38, startedAt: now, duration: 280, store: true });
      } else if (event.type === 'fitted') {
        const from = event.source === 'board'
          ? this.boardPoint(event.pieceId, this.previousSnapshot)
          : this.bufferPoint(event.pieceId, this.previousSnapshot);
        const to = this.reelPoint(event.slotIndex);
        this.effects.addFlight({ typeId: event.typeId, from: from ?? { x: 215, y: 523 }, to, size: this.lastBoardGeometry?.cell ?? 38, startedAt: now, duration: 340, store: false });
      } else if (event.type === 'rotated') {
        const from = this.previousSnapshot?.state.activeTargetIndex ?? this.snapshot.state.activeTargetIndex;
        this.animateReel(from, event.to, event.reason === 'spin' ? 900 : 420, now);
      } else if (event.type === 'rowCompleted') {
        this.reel.flash(now);
        this.reel.celebrate(now, 480, ['Lovely!', 'Perfect fit!', 'Nice!', 'So satisfying!'][event.rowIndex % 4] ?? 'Nice!');
      } else if (event.type === 'won') {
        this.effects.burst(110, 265, ['#f4d372', '#86c8b3', '#eeacbb', '#85b5d6'], 40, true);
        this.effects.burst(320, 245, ['#f4d372', '#86c8b3', '#eeacbb', '#85b5d6'], 40, true);
      }
    }
    this.startLoop();
  }

  private boardPoint(pieceId: string, snapshot: RenderSnapshot | null): { readonly x: number; readonly y: number } | null {
    if (!snapshot || !this.lastBoardGeometry) return null;
    const piece = snapshot.state.board.find((entry) => entry.pieceId === pieceId);
    return piece ? BoardRenderer.centerOf(this.lastBoardGeometry, piece.row, piece.column) : null;
  }

  private bufferPoint(pieceId: string, snapshot: RenderSnapshot | null): { readonly x: number; readonly y: number } | null {
    if (!snapshot) return null;
    const index = snapshot.state.buffer.findIndex((piece) => piece.pieceId === pieceId);
    return index >= 0 ? BufferRenderer.position(index) : null;
  }

  private reelPoint(slotIndex: number): { readonly x: number; readonly y: number } {
    return { x: [123, 215, 307][slotIndex] ?? 215, y: 293 };
  }

  public clear(): void {
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.effects.clear();
  }

  private animateReel(from: number, to: number, duration: number, startedAt: number): void {
    if (this.reducedMotion) {
      this.reel.setInterpolatedPosition(to);
      return;
    }
    const distance = to >= from ? to - from : to + (this.snapshot?.level.targetRows.length ?? 0) - from;
    const end = from + Math.max(1, distance);
    const tick = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      this.reel.setInterpolatedPosition(from + (end - from) * eased);
      this.draw(now);
      if (progress < 1) this.frameId = requestAnimationFrame(tick);
      else {
        this.reel.setInterpolatedPosition(to);
        this.frameId = 0;
        this.startLoop();
      }
    };
    cancelAnimationFrame(this.frameId);
    this.frameId = requestAnimationFrame(tick);
  }

  private startLoop(): void {
    if (this.frameId !== 0) return;
    const tick = (now: number): void => {
      this.draw(now);
      if (this.effectsActive(now)) this.frameId = requestAnimationFrame(tick);
      else this.frameId = 0;
    };
    this.frameId = requestAnimationFrame(tick);
  }

  private effectsActive(_now: number): boolean {
    return this.effects.active;
  }

  private draw(now: number): void {
    if (!this.snapshot) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(this.canvas.width / DESIGN_WIDTH, 0, 0, this.canvas.height / DESIGN_HEIGHT, 0, 0);
    ctx.clearRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    drawBackground(ctx);
    this.reel.draw(ctx, this.snapshot, now);
    this.buffer.draw(ctx, this.snapshot, now);
    this.lastBoardGeometry = this.board.draw(ctx, this.snapshot, now);
    this.effects.draw(ctx, now, this.reducedMotion);
  }
}
