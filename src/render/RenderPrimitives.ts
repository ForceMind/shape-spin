import { PIECE_TYPES } from '../content/pieceTypes';
import type { ShapeId } from '../core/types';

export const DESIGN_WIDTH = 430;
export const DESIGN_HEIGHT = 900;
export const CANVAS_FONT = 'ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

export interface VisualType {
  readonly shape: ShapeId;
  readonly color: string;
  readonly light: string;
  readonly dark: string;
}

const PALETTE: Readonly<Record<string, Omit<VisualType, 'shape'>>> = {
  yellow: { color: '#f4c64b', light: '#ffe88c', dark: '#ba7c23' },
  pink: { color: '#ec91b2', light: '#ffd2e1', dark: '#b5507a' },
  cyan: { color: '#62cad3', light: '#b8eff0', dark: '#277e93' },
  coral: { color: '#f57661', light: '#ffbba1', dark: '#b23f39' },
  red: { color: '#ec7258', light: '#ffb394', dark: '#b44333' },
  blue: { color: '#479ddc', light: '#a2d6f7', dark: '#23679e' },
  green: { color: '#9cc956', light: '#deedac', dark: '#587e35' },
  orange: { color: '#f3aa50', light: '#ffe0a4', dark: '#b96d2e' },
  lilac: { color: '#9b97dc', light: '#d7cffb', dark: '#625b9d' },
};

export function visualType(typeId: string): VisualType {
  const source = Object.values(PIECE_TYPES).find((entry) => entry.typeId === typeId);
  if (!source) return { shape: 'circle', color: '#d8dfb7', light: '#eef2d4', dark: '#a8b390' };
  const palette = PALETTE[source.colorId] ?? { color: '#f4c64b', light: '#ffe88c', dark: '#ba7c23' };
  return { shape: source.shapeId, color: palette.color, light: palette.light, dark: palette.dark };
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

export function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - clamp(progress), 3);
}

export function hexMix(from: string, to: string, progress: number): string {
  const a = Number.parseInt(from.replace('#', ''), 16);
  const b = Number.parseInt(to.replace('#', ''), 16);
  return `#${[16, 8, 0].map((shift) => Math.round(lerp((a >> shift) & 255, (b >> shift) & 255, progress)).toString(16).padStart(2, '0')).join('')}`;
}

export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function roundedPolygon(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[], rounding: number): void {
  ctx.beginPath();
  points.forEach((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    if (!previous || !next) return;
    const da = Math.hypot(previous[0] - point[0], previous[1] - point[1]);
    const db = Math.hypot(next[0] - point[0], next[1] - point[1]);
    const radius = Math.min(rounding, da * 0.38, db * 0.38);
    const a: [number, number] = [point[0] + (previous[0] - point[0]) * radius / da, point[1] + (previous[1] - point[1]) * radius / da];
    const b: [number, number] = [point[0] + (next[0] - point[0]) * radius / db, point[1] + (next[1] - point[1]) * radius / db];
    if (index === 0) ctx.moveTo(...a); else ctx.lineTo(...a);
    ctx.quadraticCurveTo(point[0], point[1], b[0], b[1]);
  });
  ctx.closePath();
}

export function shapePath(ctx: CanvasRenderingContext2D, shape: ShapeId, x: number, y: number, radius: number): void {
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.88, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }
  if (shape === 'square') {
    roundedRect(ctx, x - radius * 0.84, y - radius * 0.84, radius * 1.68, radius * 1.68, radius * 0.23);
    return;
  }
  let points: [number, number][] = [];
  if (shape === 'triangle') points = [[0, -1.04], [1, 0.82], [-1, 0.82]];
  else if (shape === 'diamond') points = [[0, -1.05], [1.02, 0], [0, 1.05], [-1.02, 0]];
  else if (shape === 'hexagon') points = Array.from({ length: 6 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 3;
    return [Math.cos(angle), Math.sin(angle)] as [number, number];
  });
  else if (shape === 'star') points = Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const scale = index % 2 ? 0.48 : 1.05;
    return [Math.cos(angle) * scale, Math.sin(angle) * scale] as [number, number];
  });
  roundedPolygon(ctx, points.map(([px, py]) => [x + px * radius, y + py * radius] as [number, number]), radius * (shape === 'star' ? 0.13 : 0.19));
}

export function softEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, radiusX: number, radiusY: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(radiusX, radiusY);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, '#00000000');
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

export interface TokenOptions {
  readonly alpha?: number;
  readonly angle?: number;
  readonly scale?: number;
  readonly outlined?: boolean;
  readonly shadow?: boolean;
}

/** Ported from the original Demo: side depth, highlight stroke and soft shadow. */
export function drawToken(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, typeId: string, options: TokenOptions = {}): void {
  const { alpha = 1, angle = 0, scale = 1, outlined = false, shadow = true } = options;
  const type = visualType(typeId);
  const radius = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  if (shadow) softEllipse(ctx, 0, radius * 0.73 + 7, radius * 0.9, 7, '#1a473637');
  shapePath(ctx, type.shape, 0, 5, radius);
  ctx.fillStyle = type.dark;
  ctx.fill();
  if (outlined) {
    ctx.strokeStyle = hexMix(type.dark, '#183c30', 0.45);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const gradient = ctx.createLinearGradient(-radius, -radius, radius * 0.4, radius);
  gradient.addColorStop(0, type.light);
  gradient.addColorStop(0.4, hexMix(type.color, type.light, 0.22));
  gradient.addColorStop(1, type.color);
  shapePath(ctx, type.shape, 0, 0, radius);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = outlined ? 1.7 : 1;
  ctx.strokeStyle = outlined ? hexMix(type.dark, '#315343', 0.18) : hexMix(type.dark, type.color, 0.6);
  ctx.stroke();
  ctx.save();
  shapePath(ctx, type.shape, 0, 0, radius);
  ctx.clip();
  shapePath(ctx, type.shape, 0, 1, radius * 0.91);
  ctx.strokeStyle = '#ffffff5f';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** Ported recessed target socket. */
export function drawHole(ctx: CanvasRenderingContext2D, x: number, y: number, typeId: string, scaleY: number, filled: boolean): void {
  const type = visualType(typeId);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, Math.max(0.04, scaleY));
  const radius = 18.5;
  if (filled) {
    shapePath(ctx, type.shape, 0, 0, radius);
    ctx.fillStyle = '#ffffff07';
    ctx.fill();
    ctx.strokeStyle = '#ffffff12';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  } else {
    shapePath(ctx, type.shape, 0, 1.3, radius + 1);
    ctx.fillStyle = hexMix(type.color, '#ffffff', 0.3);
    ctx.fill();
    shapePath(ctx, type.shape, 0, 0, radius);
    const gradient = ctx.createLinearGradient(0, -radius, 0, radius);
    gradient.addColorStop(0, hexMix(type.dark, '#041712', 0.7));
    gradient.addColorStop(0.47, hexMix(type.dark, '#051912', 0.55));
    gradient.addColorStop(1, hexMix(type.dark, '#081e15', 0.19));
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = hexMix(type.dark, '#071b13', 0.35);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.save();
    shapePath(ctx, type.shape, 0, 0, radius);
    ctx.clip();
    shapePath(ctx, type.shape, 0, 5, radius * 0.96);
    const floor = ctx.createLinearGradient(0, -radius, 0, radius);
    floor.addColorStop(0, hexMix(type.dark, '#041712', 0.46));
    floor.addColorStop(1, hexMix(type.dark, '#081e15', 0.19));
    ctx.fillStyle = floor;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, DESIGN_HEIGHT);
  gradient.addColorStop(0, '#f0f5eb');
  gradient.addColorStop(0.44, '#e9f2e7');
  gradient.addColorStop(1, '#dceedd');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let y = 157; y < 464; y += 27) for (let x = 17; x < DESIGN_WIDTH; x += 27) {
    ctx.beginPath();
    ctx.ellipse(x, y, 0.65, 0.65, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#759781';
    ctx.fill();
  }
  ctx.restore();
  const glow = ctx.createRadialGradient(213, 299, 20, 213, 299, 205);
  glow.addColorStop(0, '#ffffff75');
  glow.addColorStop(1, '#ffffff00');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 130, DESIGN_WIDTH, 340);
}
