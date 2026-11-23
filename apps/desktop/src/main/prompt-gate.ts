export class ExclusivePromptGate {
  private active = false;

  async run<T>(operation: () => Promise<T>, unavailable: T): Promise<T> {
    if (this.active) return unavailable;
    this.active = true;
    try { return await operation(); } finally { this.active = false; }
  }
}

/** Shared by every sensitive prompt created by the desktop main process. */
export const sharedPromptGate = new ExclusivePromptGate();
