import { t } from '../services/i18n';
import { Modal } from '../ui/Modal';
import { BaseScreen } from './Screen';

export interface HomeScreenOptions {
  readonly modal: Modal;
  readonly hasSavedRun: boolean;
  readonly devMode?: boolean;
}

/** Lightweight first-entry screen; primary action starts/continues immediately. */
export class HomeScreen extends BaseScreen {
  public readonly id = 'home';
  public constructor(private readonly options: HomeScreenOptions) { super(); }

  public mount(): void {
    const { modal, hasSavedRun } = this.options;
    modal.open(`
      <div class="modal-eyebrow">SHAPE SPIN</div>
      <h2 id="modal-title">${t('app.tagline')}</h2>
      <p class="modal-description">${t('help.rule2.body')}</p>
      <button class="primary-button" data-action="home-start">${hasSavedRun ? t('menu.continue') : t('menu.campaign')}</button>
      <button class="secondary-button" data-action="show-levels">${t('levels.title')}</button>
      <button class="secondary-button" data-action="daily-start">${t('menu.daily')}</button>
      <button class="secondary-button" data-action="practice-open">${t('menu.practice')}</button>
      ${this.options.devMode ? `<button class="secondary-button" data-action="editor-open">${t('editor.title')}</button>` : ''}
      <button class="plain-button" data-action="home-help">${t('menu.help')}</button>
    `);
  }

  public unmount(): void { this.options.modal.close(); }
}
