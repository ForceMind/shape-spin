export class ListenerBag {
  private disposers: (() => void)[] = [];

  public listen<K extends keyof WindowEventMap>(target: Window, type: K, listener: (event: WindowEventMap[K]) => void, options?: AddEventListenerOptions): void;
  public listen<K extends keyof DocumentEventMap>(target: Document, type: K, listener: (event: DocumentEventMap[K]) => void, options?: AddEventListenerOptions): void;
  public listen(target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions): void;
  public listen(target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions): void {
    target.addEventListener(type, listener, options);
    this.disposers.push(() => target.removeEventListener(type, listener, options));
  }

  public clear(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
  }
}
