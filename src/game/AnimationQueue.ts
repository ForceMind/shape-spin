/**
 * Owns a bounded sequence of cancelable visual tasks. Game rules are already
 * committed before tasks run; cancellation can never alter rule state.
 */
export class AnimationQueue {
  private token = 0;
  private active = false;

  public get isActive(): boolean {
    return this.active;
  }

  public cancel(): void {
    this.token += 1;
    this.active = false;
  }

  public async run(tasks: readonly (() => Promise<void>)[]): Promise<void> {
    const localToken = ++this.token;
    this.active = true;
    try {
      for (const task of tasks) {
        if (localToken !== this.token) return;
        await task();
      }
    } finally {
      if (localToken === this.token) this.active = false;
    }
  }
}

export function waitForAnimation(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
