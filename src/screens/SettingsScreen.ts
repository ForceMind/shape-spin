import type { Locale } from '../core/types';
import { t } from '../services/i18n';
import { Modal } from '../ui/Modal';
import { BaseScreen } from './Screen';

export interface SettingsScreenOptions {
  readonly modal: Modal;
  readonly locale: Locale;
  readonly soundEnabled: boolean;
  readonly reducedMotion: boolean;
}

export class SettingsScreen extends BaseScreen {
  public readonly id = 'settings';
  public constructor(private readonly options: SettingsScreenOptions) { super(); }

  public mount(): void {
    const { modal, locale, soundEnabled, reducedMotion } = this.options;
    modal.open(`
      <button class="modal-close" data-action="close" aria-label="Close">×</button>
      <div class="modal-eyebrow">${t('settings.title')}</div>
      <h2 id="modal-title">${t('app.title')}</h2>
      <div class="modal-rule"><span class="rule-index">◈</span><div><strong>${t('settings.language')}</strong><span>${locale === 'zh-CN' ? '简体中文' : 'English'}</span></div></div>
      <button class="secondary-button" data-action="toggle-lang">${locale === 'zh-CN' ? 'Switch to English' : '切换为中文'}</button>
      <div class="modal-rule"><span class="rule-index">♪</span><div><strong>${t('settings.sound')}</strong><span>${soundEnabled ? (locale === 'zh-CN' ? '开' : 'On') : (locale === 'zh-CN' ? '关' : 'Off')}</span></div></div>
      <button class="secondary-button" data-action="toggle-sound">${soundEnabled ? (locale === 'zh-CN' ? '关闭音效' : 'Mute') : (locale === 'zh-CN' ? '开启音效' : 'Unmute')}</button>
      <div class="modal-rule"><span class="rule-index">◉</span><div><strong>${t('settings.reducedMotion')}</strong><span>${reducedMotion ? (locale === 'zh-CN' ? '开' : 'On') : (locale === 'zh-CN' ? '关' : 'Off')}</span></div></div>
      <button class="secondary-button" data-action="toggle-motion">${reducedMotion ? (locale === 'zh-CN' ? '关闭减少动效' : 'Disable reduced motion') : (locale === 'zh-CN' ? '开启减少动效' : 'Enable reduced motion')}</button>
      <hr style="border:none;border-top:1px solid #ccc;margin:12px 0">
      <button class="secondary-button" data-action="export-save">${t('settings.export')}</button>
      <button class="secondary-button" data-action="import-save">${t('settings.import')}</button>
      <button class="primary-button" data-action="close">${t('menu.continue')}</button>
    `);
  }

  public unmount(): void { this.options.modal.close(); }
}
