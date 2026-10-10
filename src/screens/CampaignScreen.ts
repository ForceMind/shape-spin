import type { LevelDefinition, Locale } from '../core/types';
import { t } from '../services/i18n';
import { Modal } from '../ui/Modal';
import { BaseScreen } from './Screen';

export interface CampaignScreenOptions {
  readonly modal: Modal;
  readonly levels: readonly LevelDefinition[];
  readonly completedIndexes: ReadonlySet<number>;
  readonly currentIndex: number;
  readonly locale: Locale;
}

export class CampaignScreen extends BaseScreen {
  public readonly id = 'campaign';

  public constructor(private readonly options: CampaignScreenOptions) { super(); }

  public mount(): void {
    const { modal, levels, completedIndexes, currentIndex, locale } = this.options;
    const cards = levels.map((level, index) => {
      const current = index === currentIndex ? ' active' : '';
      const done = completedIndexes.has(index) ? '<span class="done">✓</span>' : '';
      const translated = t(level.titleKey);
      const name = translated === level.titleKey
        ? (locale === 'zh-CN' ? `第 ${String(level.displayNumber).padStart(2, '0')} 关` : `Level ${String(level.displayNumber).padStart(2, '0')}`)
        : translated;
      return `<button class="level-card${current}" data-action="level" data-level="${index}"><span class="num">${String(index + 1).padStart(2, '0')}</span><span class="name">${name}</span><span class="small">${level.pieces.length} · ${level.initialSpins} SPIN</span>${done}</button>`;
    }).join('');
    modal.open(`
      <button class="modal-close" data-action="close" aria-label="Close">×</button>
      <div class="modal-eyebrow">${t('levels.title')}</div>
      <h2 id="modal-title">${t('menu.campaign')}</h2>
      <p class="modal-description">${completedIndexes.size} / ${levels.length}</p>
      <div class="modal-actions">
        <button class="secondary-button" data-action="daily-start">${t('menu.daily')}</button>
        <button class="secondary-button" data-action="practice-open">${t('menu.practice')}</button>
      </div>
      <div class="level-grid">${cards}</div>
      <button class="secondary-button" data-action="close">${t('menu.continue')}</button>
    `);
  }

  public unmount(): void {
    this.options.modal.close();
  }
}
