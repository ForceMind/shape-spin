import { ListenerBag } from '../app/ListenerBag';

export type ModalActionHandler = (action: string, element: HTMLElement, event: MouseEvent) => void;

/**
 * Owns modal DOM lifecycle, focus, inert background and delegated actions.
 * Content builders remain in screens until they are split into dedicated screen
 * classes; main.ts no longer needs to manage backdrop mechanics directly.
 */
export class Modal {
  private readonly listeners = new ListenerBag();
  private actionHandler: ModalActionHandler | null = null;
  private closeHandler: (() => void) | null = null;
  private previousFocus: HTMLElement | null = null;

  public constructor(
    private readonly backdrop: HTMLElement,
    private readonly card: HTMLElement,
    private readonly interfaceLayer: HTMLElement | null,
  ) {
    this.listeners.listen(this.card, 'click', ((event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const actionElement = target.closest<HTMLElement>('[data-action]');
      if (!actionElement) return;
      const action = actionElement.dataset.action;
      if (!action) return;
      if (action === 'close') this.close();
      this.actionHandler?.(action, actionElement, event);
    }) as EventListener);
    this.listeners.listen(this.backdrop, 'click', ((event: MouseEvent) => {
      if (event.target === this.backdrop) this.close();
    }) as EventListener);
    this.listeners.listen(document, 'keydown', ((event: KeyboardEvent) => {
      if (!this.isOpen || event.key !== 'Escape') return;
      event.preventDefault();
      this.close();
    }) as EventListener);
  }

  public get isOpen(): boolean {
    return !this.backdrop.hidden;
  }

  public setActionHandler(handler: ModalActionHandler): void {
    this.actionHandler = handler;
  }

  public setCloseHandler(handler: () => void): void {
    this.closeHandler = handler;
  }

  public open(html: string): void {
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.card.innerHTML = html;
    this.backdrop.hidden = false;
    if (this.interfaceLayer) {
      this.interfaceLayer.setAttribute('inert', '');
      this.interfaceLayer.style.pointerEvents = 'none';
    }
    this.card.focus({ preventScroll: true });
  }

  public close(): void {
    if (!this.isOpen) return;
    this.backdrop.hidden = true;
    if (this.interfaceLayer) {
      this.interfaceLayer.removeAttribute('inert');
      this.interfaceLayer.style.pointerEvents = '';
    }
    this.previousFocus?.focus({ preventScroll: true });
    this.previousFocus = null;
    this.closeHandler?.();
  }

  public destroy(): void {
    this.close();
    this.listeners.clear();
    this.actionHandler = null;
  }
}
