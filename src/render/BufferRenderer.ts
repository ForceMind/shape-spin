import type { RenderSnapshot } from './RenderSnapshot';
import { DESIGN_HEIGHT, drawToken, easeOutCubic, lerp, roundedRect } from './RenderPrimitives';

const BUFFER_X = [44, 103, 162, 221, 280] as const;
const BUFFER_Y = 523;

/** Original Demo five-slot buffer treatment, rendered from the core snapshot. */
export class BufferRenderer {
  private previousPieceIds: readonly string[] = [];
  private transitionStartedAt = 0;
  private transitionDuration = 280;

  public observe(snapshot: RenderSnapshot, now: number): void {
    const ids = snapshot.state.buffer.map((piece) => piece.pieceId);
    if (ids.join('|') !== this.previousPieceIds.join('|')) {
      this.previousPieceIds = ids;
      this.transitionStartedAt = now;
    }
  }

  public draw(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot, now: number): void {
    const buffer = snapshot.state.buffer;
    const danger = buffer.length >= 4;
    for (let index = 0; index < BUFFER_X.length; index += 1) {
      const x = BUFFER_X[index] ?? 44;
      ctx.save();
      ctx.shadowColor = '#5a805731';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 5;
      roundedRect(ctx, x - 24, BUFFER_Y - 22, 48, 48, 11);
      ctx.fillStyle = '#99b79d';
      ctx.fill();
      ctx.restore();
      const face = ctx.createLinearGradient(0, BUFFER_Y - 25, 0, BUFFER_Y + 22);
      face.addColorStop(0, '#eff4e5');
      face.addColorStop(1, '#d1dfc6');
      roundedRect(ctx, x - 24, BUFFER_Y - 25, 48, 46, 11);
      ctx.fillStyle = face;
      ctx.fill();
      ctx.strokeStyle = '#f9fbef';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      roundedRect(ctx, x - 20, BUFFER_Y - 21, 40, 38, 8);
      ctx.strokeStyle = danger && index >= buffer.length ? '#c89e7070' : '#a6bda638';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (!buffer[index]) {
        ctx.font = '650 11px ui-rounded, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = danger ? '#b8a383' : '#afc0a6';
        ctx.fillText(String(index + 1), x, BUFFER_Y - 1);
      }
    }

    const progress = this.transitionStartedAt === 0 ? 1 : Math.min(1, (now - this.transitionStartedAt) / this.transitionDuration);
    for (let index = 0; index < buffer.length; index += 1) {
      const piece = buffer[index];
      if (!piece) continue;
      const x = BUFFER_X[index] ?? 44;
      const scale = 0.9 + easeOutCubic(progress) * 0.1;
      drawToken(ctx, x, BUFFER_Y - 5, 35, piece.typeId, { scale, shadow: false });
    }
  }

  public static position(index: number): { readonly x: number; readonly y: number } {
    return { x: BUFFER_X[index] ?? 44, y: BUFFER_Y - 5 };
  }
}

export { BUFFER_X, BUFFER_Y };
