import type { Screen } from '../screens/Screen';

/**
 * Owns one active screen and guarantees pause/unmount before replacement.
 * This is the native-DOM equivalent of Arrow Flow's Phaser scene lifecycle.
 */
export class AppRouter {
  private active: Screen | null = null;

  public get activeId(): string | null {
    return this.active?.id ?? null;
  }

  public replace(next: Screen): void {
    if (this.active === next) return;
    this.active?.pause();
    this.active?.unmount();
    this.active = next;
    next.mount();
  }

  public pause(): void {
    this.active?.pause();
  }

  public resume(): void {
    this.active?.resume();
  }

  public destroy(): void {
    this.active?.unmount();
    this.active = null;
  }
}
