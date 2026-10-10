export interface Screen {
  readonly id: string;
  mount(): void;
  pause(): void;
  resume(): void;
  unmount(): void;
}

/** Shared no-op lifecycle defaults for DOM/Canvas screens. */
export abstract class BaseScreen implements Screen {
  public abstract readonly id: string;
  public abstract mount(): void;
  public pause(): void { /* optional */ }
  public resume(): void { /* optional */ }
  public abstract unmount(): void;
}
