import type { LevelDefinition } from '../core/types';
import type { GamePresentation, GameController } from '../game/GameController';
import { t } from '../services/i18n';
import { BaseScreen } from './Screen';

export interface GameScreenOptions {
  readonly controller: GameController;
  readonly locale: () => 'en' | 'zh-CN';
  readonly levelIndex: () => number;
  readonly onPick: (pieceId: string) => void;
  readonly onSpin: () => void;
  readonly onUndo: () => void;
  readonly onRestart: () => void;
  readonly onHelp: () => void;
  readonly onCampaign: () => void;
  readonly onSettings: () => void;
  readonly soundEnabled: () => boolean;
  readonly onSoundToggle: () => void;
}

/** Owns the gameplay HUD and accessible DOM hit layer. */
export class GameScreen extends BaseScreen {
  public readonly id = 'game';
  private mounted = false;

  public constructor(private readonly options: GameScreenOptions) { super(); }

  public mount(): void {
    if (this.mounted) return;
    this.mounted = true;
    byId('spin-button').addEventListener('click', this.options.onSpin);
    byId('undo-button').addEventListener('click', this.options.onUndo);
    byId('restart-button').addEventListener('click', this.options.onRestart);
    byId('help-button').addEventListener('click', this.options.onHelp);
    byId('level-button').addEventListener('click', this.options.onCampaign);
    byId('settings-button').addEventListener('click', this.options.onSettings);
    byId('sound-button').addEventListener('click', this.options.onSoundToggle);
    this.render();
  }

  public render(): void {
    const presentation = this.options.controller.presentation();
    const { level, session, selectablePieceIds, canSpin, remainingPieceCount } = presentation;
    const state = session.state;
    byId('level-number').textContent = String(this.options.levelIndex() + 1).padStart(2, '0');
    const translated = t(level.titleKey);
    byId('level-title').textContent = translated === level.titleKey
      ? (this.options.locale() === 'zh-CN' ? `第 ${String(level.displayNumber || 1).padStart(2, '0')} 关` : `Level ${String(level.displayNumber || 1).padStart(2, '0')}`)
      : translated;
    const fitted = state.targets.reduce((sum, row) => sum + row.filled.filter(Boolean).length, 0);
    byId('fit-count').textContent = `${fitted} / ${level.pieces.length}`;
    byId('fit-progress').style.width = `${fitted / level.pieces.length * 100}%`;
    byId('buffer-count').textContent = `${state.buffer.length} / 5`;
    byId('spin-count').textContent = `${state.spinsRemaining}`;
    (byId('spin-button') as HTMLButtonElement).disabled = !canSpin;
    (byId('undo-button') as HTMLButtonElement).disabled = session.history.length === 0;
    byId('remaining-count').textContent = `${remainingPieceCount} ${t('game.remaining')}`;
    byId('status').textContent = state.phase === 'won' ? t('game.won')
      : state.phase === 'lost' ? t('game.lost')
        : state.buffer.length >= 4 ? t('game.bufferFull') : t('game.firstMove');
    const sound = byId('sound-button');
    sound.classList.toggle('muted', !this.options.soundEnabled());
    sound.setAttribute('aria-pressed', String(this.options.soundEnabled()));
    this.rebuildHitLayer(presentation);
    this.options.controller.render();
  }

  public unmount(): void {
    if (!this.mounted) return;
    this.mounted = false;
    byId('spin-button').removeEventListener('click', this.options.onSpin);
    byId('undo-button').removeEventListener('click', this.options.onUndo);
    byId('restart-button').removeEventListener('click', this.options.onRestart);
    byId('help-button').removeEventListener('click', this.options.onHelp);
    byId('level-button').removeEventListener('click', this.options.onCampaign);
    byId('settings-button').removeEventListener('click', this.options.onSettings);
    byId('sound-button').removeEventListener('click', this.options.onSoundToggle);
    byId('piece-buttons').innerHTML = '';
  }

  private rebuildHitLayer(presentation: GamePresentation): void {
    const { level, session, selectablePieceIds } = presentation;
    const layer = byId('piece-buttons');
    layer.innerHTML = '';
    const geometry = geometryFor(level);
    for (const piece of session.state.board) {
      if (piece.removed) continue;
      const button = document.createElement('button');
      const box = hitBox(piece.row, piece.column, geometry);
      button.className = 'piece-hit';
      button.style.cssText = `left:${box.x}%;top:${box.y}%;width:${box.width}%;height:${box.height}%;`;
      button.dataset.id = piece.pieceId;
      button.disabled = session.state.phase !== 'playing';
      button.setAttribute('aria-disabled', String(!selectablePieceIds.has(piece.pieceId) || session.state.phase !== 'playing'));
      button.setAttribute('aria-label', `${piece.typeId}: ${selectablePieceIds.has(piece.pieceId) ? 'pickable' : 'blocked'}`);
      button.addEventListener('click', () => this.options.onPick(piece.pieceId));
      button.addEventListener('pointerenter', () => this.options.controller.setHover(piece.pieceId));
      button.addEventListener('pointerleave', () => this.options.controller.setHover(null));
      button.addEventListener('focus', () => this.options.controller.setHover(piece.pieceId));
      button.addEventListener('blur', () => this.options.controller.setHover(null));
      layer.appendChild(button);
    }
  }
}

interface Geometry { readonly cell: number; readonly left: number; readonly top: number; }
function geometryFor(level: LevelDefinition): Geometry {
  const rows = Math.max(...level.cells.map((cell) => cell.row)) + 1;
  const columns = Math.max(...level.cells.map((cell) => cell.column)) + 1;
  const cell = Math.min(60, 240 / rows, 330 / columns);
  return { cell, left: (430 - columns * cell) / 2, top: 624 + (240 - rows * cell) / 2 };
}
function hitBox(row: number, column: number, geometry: Geometry): { x: number; y: number; width: number; height: number } {
  return {
    x: (geometry.left + column * geometry.cell) / 430 * 100,
    y: (geometry.top + row * geometry.cell) / 900 * 100,
    width: geometry.cell / 430 * 100,
    height: geometry.cell / 900 * 100,
  };
}
function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required UI element #${id}`);
  return element;
}
