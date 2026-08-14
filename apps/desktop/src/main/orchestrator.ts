/* eslint-disable no-unused-vars -- constructor parameter properties are runtime dependencies. */
export class ExecutionOrchestrator {
  constructor(private readonly repository: { create(): { state: string } }, private readonly adapter: { start(): Promise<void> }) {}
  async dispatch(attempt: { attemptId: string; state: string }): Promise<void> {
    if (attempt.state === 'UNKNOWN' || attempt.state === 'RECONCILING') throw new Error('RECONCILIATION_REQUIRED');
    this.repository.create(); await this.adapter.start();
  }
}
