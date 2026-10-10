import { t } from '../services/i18n';
import { Modal } from '../ui/Modal';
import { BaseScreen } from './Screen';

export interface PracticeScreenOptions {
  readonly modal: Modal;
  readonly seed: number;
  readonly difficulty: number;
}

export class PracticeScreen extends BaseScreen {
  public readonly id = 'practice';
  public constructor(private readonly options: PracticeScreenOptions) { super(); }

  public mount(): void {
    this.options.modal.open(`
      <button class="modal-close" data-action="close" aria-label="Close">×</button>
      <div class="modal-eyebrow">${t('practice.title')}</div>
      <h2 id="modal-title">${t('practice.title')}</h2>
      <div class="modal-rule"><span class="rule-index">#</span><div><strong>${t('practice.seed')}</strong><input type="number" id="practice-seed" value="${this.options.seed}" min="1" max="999999" style="width:100px"></div></div>
      <div class="modal-rule"><span class="rule-index">★</span><div><strong>${t('practice.difficulty')}</strong><input type="range" id="practice-difficulty" min="1" max="10" value="${this.options.difficulty}" style="width:120px"></div></div>
      <button class="primary-button" data-action="practice-start">${t('menu.continue')}</button>
      <button class="secondary-button" data-action="close">${t('menu.settings')}</button>
    `);
  }

  public unmount(): void { this.options.modal.close(); }
}
