import type { Locale } from '../core/types';
import { t } from '../services/i18n';
import { Modal } from '../ui/Modal';
import { BaseScreen } from './Screen';

export interface HelpScreenOptions {
  readonly modal: Modal;
  readonly locale: () => Locale;
}

export class HelpScreen extends BaseScreen {
  public readonly id = 'help';

  public constructor(private readonly options: HelpScreenOptions) { super(); }

  public mount(): void {
    const { modal, locale } = this.options;
    modal.open(`
      <button class="modal-close" data-action="close" aria-label="Close">×</button>
      <div class="modal-eyebrow">${t('help.title')}</div>
      <h2 id="modal-title">${t('app.tagline')}</h2>
      <div class="modal-rule"><span class="rule-index">01</span><div><strong>${t('help.rule1.title')}</strong>${t('help.rule1.body')}</div></div>
      <div class="modal-rule"><span class="rule-index">02</span><div><strong>${t('help.rule2.title')}</strong>${t('help.rule2.body')}</div></div>
      <div class="modal-rule"><span class="rule-index">03</span><div><strong>${t('help.rule3.title')}</strong>${t('help.rule3.body')}</div></div>
      <div class="modal-rule"><span class="rule-index">04</span><div><strong>${t('help.rule4.title')}</strong>${t('help.rule4.body')}</div></div>
      <button class="secondary-button" data-action="lang">${locale() === 'zh-CN' ? 'Switch to English' : '切换为中文'}</button>
      <button class="primary-button" data-action="close">${t('menu.continue')}</button>
    `);
  }

  public unmount(): void {
    this.options.modal.close();
  }
}
