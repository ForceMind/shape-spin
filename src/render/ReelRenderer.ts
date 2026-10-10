import type { RenderSnapshot } from './RenderSnapshot';
import { clamp, DESIGN_WIDTH, drawHole, drawToken, hexMix, roundedPolygon, roundedRect, softEllipse, visualType } from './RenderPrimitives';

const REEL_CENTER_Y = 293;
const REEL_RADIUS = 146;
const REEL_STEP = 0.60;
const COLUMNS = [123, 215, 307] as const;

/**
 * Original Demo's cylindrical 3D reel treatment, adapted to immutable
 * LevelDefinition/GameState snapshots. The game has one shared active target
 * row; visual position may interpolate independently during a spin.
 */
export class ReelRenderer {
  private position = 0;
  private flashUntil = 0;
  private celebration: { start: number; duration: number; text: string } | null = null;

  public snapTo(activeTargetIndex: number): void {
    this.position = activeTargetIndex;
  }

  public setInterpolatedPosition(position: number): void {
    this.position = position;
  }

  public flash(now: number): void {
    this.flashUntil = now + 600;
  }

  public celebrate(now: number, duration: number, text: string): void {
    this.celebration = { start: now, duration, text };
  }

  public draw(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot, now: number): void {
    const { level, state } = snapshot;
    const totalRows = level.targetRows.length;
    if (totalRows === 0) return;

    softEllipse(ctx, 215, 447, 139, 20, '#476e4d27');
    const axle = ctx.createLinearGradient(0, REEL_CENTER_Y - 13, 0, REEL_CENTER_Y + 15);
    axle.addColorStop(0, '#d5e4d8');
    axle.addColorStop(0.28, '#f3f7ef');
    axle.addColorStop(0.55, '#b4cbb9');
    axle.addColorStop(1, '#8da997');
    roundedRect(ctx, -8, REEL_CENTER_Y - 11, 446, 24, 10);
    ctx.fillStyle = axle;
    ctx.fill();
    roundedRect(ctx, 52, 191, 326, 205, 17);
    ctx.fillStyle = '#b8cbbb';
    ctx.fill();
    const backing = ctx.createLinearGradient(0, 188, 0, 405);
    backing.addColorStop(0, '#fcfcf2');
    backing.addColorStop(0.55, '#dae6d7');
    backing.addColorStop(1, '#a1baa8');
    roundedRect(ctx, 54, 183, 322, 210, 17);
    ctx.fillStyle = backing;
    ctx.fill();

    for (const x of [54, 357]) {
      roundedRect(ctx, x, REEL_CENTER_Y - 57, 19, 115, 9);
      const columnGradient = ctx.createLinearGradient(x, 0, x + 19, 0);
      columnGradient.addColorStop(0, '#8caa98');
      columnGradient.addColorStop(0.55, '#e6efdf');
      columnGradient.addColorStop(1, '#98b6a0');
      ctx.fillStyle = columnGradient;
      ctx.fill();
    }

    const base = Math.floor(this.position);
    const tiles: { ordinal: number; angle: number; normal: number }[] = [];
    for (let ordinal = base - 3; ordinal <= base + 3; ordinal += 1) {
      const angle = (this.position - ordinal) * REEL_STEP;
      if (Math.abs(angle) > 1.59) continue;
      tiles.push({ ordinal, angle, normal: Math.max(0.02, Math.cos(angle)) });
    }
    tiles.sort((left, right) => left.normal - right.normal);

    for (const tile of tiles) {
      const rowIndex = modulo(tile.ordinal, totalRows);
      const rowDefinition = level.targetRows[rowIndex];
      const rowState = state.targets[rowIndex];
      if (!rowDefinition || !rowState) continue;
      const half = REEL_STEP * 0.464;
      const top = REEL_CENTER_Y + REEL_RADIUS * Math.sin(tile.angle - half);
      const bottom = REEL_CENTER_Y + REEL_RADIUS * Math.sin(tile.angle + half);
      const height = bottom - top;
      if (height < 0.4) continue;

      for (let column = 0; column < 3; column += 1) {
        const typeId = rowDefinition.slots[column];
        const x = (COLUMNS[column] ?? 215) - 44;
        const type = visualType(typeId ?? '');
        ctx.save();
        ctx.globalAlpha = clamp(tile.normal * 5);
        roundedRect(ctx, x, top + 3, 88, height, Math.min(8, height / 3));
        ctx.fillStyle = hexMix(type.dark, '#719879', 0.24);
        ctx.fill();
        const face = ctx.createLinearGradient(x, top, x + 80, bottom);
        face.addColorStop(0, hexMix(type.light, '#99b591', 0.12 * (1 - tile.normal)));
        face.addColorStop(0.24, hexMix(type.color, type.light, 0.35));
        face.addColorStop(1, hexMix(type.color, '#496b49', 0.14 * (1 - tile.normal)));
        roundedRect(ctx, x + 0.5, top, 87, height - 1, Math.min(8, height / 3));
        ctx.fillStyle = face;
        ctx.fill();
        ctx.strokeStyle = hexMix(type.dark, type.color, 0.65);
        ctx.lineWidth = 0.85;
        ctx.stroke();
        roundedRect(ctx, x + 3, top + 2, 82, Math.max(2, height - 5), Math.min(6, height / 3));
        ctx.strokeStyle = '#ffffff65';
        ctx.lineWidth = 1;
        ctx.stroke();

        const slot = rowState.filled[column];
        if (typeId && tile.normal > 0.1) {
          drawHole(ctx, COLUMNS[column] ?? 215, REEL_CENTER_Y + REEL_RADIUS * Math.sin(tile.angle), typeId, tile.normal, slot !== null);
          if (slot && tile.normal > 0.33) {
            drawToken(ctx, COLUMNS[column] ?? 215, REEL_CENTER_Y + REEL_RADIUS * Math.sin(tile.angle), 33 * tile.normal, slot.typeId, { shadow: false, alpha: tile.normal });
          }
        } else if (!typeId && tile.normal > 0.5) {
          ctx.beginPath();
          ctx.ellipse(COLUMNS[column] ?? 215, REEL_CENTER_Y + REEL_RADIUS * Math.sin(tile.angle), 2, 2 * tile.normal, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#9daa7e35';
          ctx.fill();
        }
        ctx.restore();
      }
    }

    const pulse = clamp(1 - (now - this.flashUntil + 600) / 600);
    ctx.save();
    ctx.shadowColor = '#56735a20';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    roundedRect(ctx, 74, REEL_CENTER_Y - 44, 282, 88, 13);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();
    roundedRect(ctx, 70, REEL_CENTER_Y - 48, 290, 96, 16);
    ctx.strokeStyle = pulse > 0 ? `rgba(111,169,107,${pulse * 0.8})` : '#adc5ae65';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    roundedPolygon(ctx, [[59, REEL_CENTER_Y - 18], [79, REEL_CENTER_Y], [59, REEL_CENTER_Y + 18]], 4);
    ctx.fillStyle = '#d6e8d5';
    ctx.fill();
    ctx.strokeStyle = '#8bab94';
    ctx.lineWidth = 1.7;
    ctx.stroke();
    roundedPolygon(ctx, [[371, REEL_CENTER_Y - 18], [351, REEL_CENTER_Y], [371, REEL_CENTER_Y + 18]], 4);
    ctx.fillStyle = '#d6e8d5';
    ctx.fill();
    ctx.strokeStyle = '#8bab94';
    ctx.lineWidth = 1.7;
    ctx.stroke();
    roundedRect(ctx, 189, REEL_CENTER_Y - 54, 52, 17, 8);
    ctx.fillStyle = '#fdfef3';
    ctx.fill();
    ctx.font = `850 8.3px ${'ui-rounded, sans-serif'}`;
    ctx.fillStyle = '#698771';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MATCH', 215, REEL_CENTER_Y - 45);

    if (this.celebration) {
      const progress = clamp((now - this.celebration.start) / this.celebration.duration);
      if (progress >= 1) this.celebration = null;
      else {
        ctx.save();
        ctx.globalAlpha = Math.sin(Math.PI * progress);
        ctx.translate(215, REEL_CENTER_Y - 2 - progress * 5);
        const scale = 1 + 0.06 * Math.sin(progress * Math.PI);
        ctx.scale(scale, scale);
        ctx.font = `900 29px ${'ui-rounded, sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#3e755b';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.strokeText(this.celebration.text, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.celebration.text, 0, 0);
        ctx.restore();
      }
    }
  }
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
