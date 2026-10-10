import type { RenderSnapshot } from './RenderSnapshot';
import { drawToken, roundedRect } from './RenderPrimitives';

export interface BoardGeometry {
  readonly rows: number;
  readonly columns: number;
  readonly cell: number;
  readonly left: number;
  readonly top: number;
}

export function boardGeometry(snapshot: RenderSnapshot): BoardGeometry {
  const rows = Math.max(...snapshot.level.cells.map((cell) => cell.row)) + 1;
  const columns = Math.max(...snapshot.level.cells.map((cell) => cell.column)) + 1;
  const cell = Math.min(60, 240 / rows, 330 / columns);
  return { rows, columns, cell, left: (430 - columns * cell) / 2, top: 624 + (240 - rows * cell) / 2 };
}

/** Original Demo board cells, exits, highlights and blocked-piece shake. */
export class BoardRenderer {
  private shaking: { readonly pieceId: string; readonly start: number } | null = null;
  private hoveredPieceId: string | null = null;

  public setHovered(pieceId: string | null): void {
    this.hoveredPieceId = pieceId;
  }

  public shake(pieceId: string, now: number): void {
    this.shaking = { pieceId, start: now };
  }

  public draw(ctx: CanvasRenderingContext2D, snapshot: RenderSnapshot, now: number): BoardGeometry {
    const geometry = boardGeometry(snapshot);
    const { cell, left, top } = geometry;
    for (const position of snapshot.level.cells) {
      const x = left + position.column * cell;
      const y = top + position.row * cell;
      roundedRect(ctx, x - 3, y + 1, cell + 6, cell + 7, 10);
      ctx.fillStyle = '#a4c3aa';
      ctx.fill();
    }

    for (const position of snapshot.level.cells) {
      const piece = snapshot.state.board.find((entry) => entry.row === position.row && entry.column === position.column);
      const x = left + position.column * cell;
      const y = top + position.row * cell;
      const removed = !piece || piece.removed;
      const face = ctx.createLinearGradient(x, y, x + cell * 0.2, y + cell);
      face.addColorStop(0, removed ? '#d9e8d5' : '#f5f8ef');
      face.addColorStop(1, removed ? '#d2e2cd' : '#dce8d6');
      roundedRect(ctx, x + 1, y + 1, cell - 2, cell - 2, 8);
      ctx.fillStyle = face;
      ctx.fill();
      ctx.strokeStyle = removed ? '#b8cfb4' : '#fdfef5';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (removed || !piece) {
        ctx.beginPath();
        ctx.ellipse(x + cell / 2, y + cell / 2, 1.8, 1.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#a1bca439';
        ctx.fill();
        continue;
      }
      const selectable = snapshot.selectablePieceIds.has(piece.pieceId);
      const hovered = this.hoveredPieceId === piece.pieceId;
      let offsetX = 0;
      if (this.shaking?.pieceId === piece.pieceId) {
        const elapsed = now - this.shaking.start;
        if (elapsed > 260) this.shaking = null;
        else offsetX = Math.sin(elapsed * 0.09) * 3.5 * (1 - elapsed / 260);
      }
      if (hovered && selectable) {
        roundedRect(ctx, x + 3, y + 3, cell - 6, cell - 6, 8);
        ctx.strokeStyle = '#8bab79a0';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const centerX = left + (position.column + 0.5) * cell;
      const centerY = top + (position.row + 0.5) * cell - 1;
      drawToken(ctx, centerX + offsetX, centerY + (selectable ? -3 : 0), cell * 0.68, piece.typeId, {
        outlined: selectable,
        alpha: selectable ? 1 : 0.83,
        scale: hovered && selectable ? 1.04 : 1,
      });
      if (selectable) {
        ctx.beginPath();
        ctx.ellipse(centerX + cell * 0.29, centerY - cell * 0.3, 1.5, 1.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fffefa';
        ctx.fill();
      }
    }

    const exits = snapshot.level.exits?.length ? snapshot.level.exits : snapshot.level.cells.filter((cellDef) => cellDef.row === 0);
    for (const exit of exits) {
      const x = left + (exit.column + 0.5) * cell;
      const y = top - 7;
      ctx.beginPath();
      ctx.moveTo(x - 3, y + 1);
      ctx.lineTo(x, y - 2);
      ctx.lineTo(x + 3, y + 1);
      ctx.strokeStyle = '#8cab90';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    return geometry;
  }

  public static centerOf(geometry: BoardGeometry, row: number, column: number): { readonly x: number; readonly y: number } {
    return { x: geometry.left + (column + 0.5) * geometry.cell, y: geometry.top + (row + 0.5) * geometry.cell - 1 };
  }
}
