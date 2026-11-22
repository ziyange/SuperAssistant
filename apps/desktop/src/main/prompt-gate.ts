export class ExclusivePromptGate {
  private active = false;

  async run<T>(operation: () => Promise<T>, unavailable: T): Promise<T> {
    if (this.active) return unavailable;
    this.active = true;
    try { return await operation(); } finally { this.active = false; }
  }
}
