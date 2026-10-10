import type { GameSession } from '../core/session';
import type { LevelDefinition, Locale } from '../core/types';
import { t } from '../services/i18n';
import { Modal } from '../ui/Modal';
import { BaseScreen } from './Screen';

export interface ResultScreenOptions {
  readonly modal: Modal;
  readonly level: LevelDefinition;
  readonly session: GameSession;
  readonly locale: Locale;
  readonly won: boolean;
  readonly firstClear: boolean;
  readonly elapsedMs: number;
  readonly canGoNext: boolean;
}

export class ResultScreen extends BaseScreen {
  public readonly id = 'result';
  public constructor(private readonly options: ResultScreenOptions) { super(); }

  public mount(): void {
    const { modal, level, session, locale, won, firstClear, elapsedMs, canGoNext } = this.options;
    const seconds = Math.floor(Math.max(0, elapsedMs) / 1000);
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const stars = won ? computeStars(session, level) : 0;
    const icons = [1, 2, 3].map((index) => `<span class="star${index <= stars ? ' earned' : ''}">★</span>`).join('');
    const translated = t(level.titleKey);
    const title = translated === level.titleKey
      ? (locale === 'zh-CN' ? `第 ${String(level.displayNumber || 1).padStart(2, '0')} 关` : `Level ${String(level.displayNumber || 1).padStart(2, '0')}`)
      : translated;
    modal.open(`
      <div class="modal-eyebrow">${won ? t('game.won') : t('game.lost')}</div>
      <h2 id="modal-title">${title}</h2>
      <div class="star-row">${icons}</div>
      <div class="modal-rule"><span class="rule-index">◔</span><div><strong>${t('result.time')}</strong>${time}</div></div>
      <div class="modal-rule"><span class="rule-index">↺</span><div><strong>${t('game.undo')}</strong>${session.audit.undoCount}</div></div>
      <div class="modal-rule"><span class="rule-index">⟳</span><div><strong>SPIN</strong>${session.audit.spinsUsed}</div></div>
      ${won && firstClear ? `<p class="modal-description">${t('result.reward')}: +10</p>` : ''}
      ${won && canGoNext ? `<button class="primary-button" data-action="next-level">${t('result.next')}</button>` : ''}
      <button class="secondary-button" data-action="retry">${t('result.retry')}</button>
      <button class="secondary-button" data-action="show-levels">${t('result.back')}</button>
    `);
  }

  public unmount(): void { this.options.modal.close(); }
}

function computeStars(session: GameSession, level: LevelDefinition): number {
  if (session.audit.undoCount === 0 && session.audit.hintCount === 0 && session.audit.spinsUsed <= level.parSpins) return 3;
  if (session.audit.undoCount <= 2 && session.audit.hintCount <= 1) return 2;
  return 1;
}
