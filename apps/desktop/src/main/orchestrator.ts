/* eslint-disable no-unused-vars -- legacy signatures remain temporarily for compatibility. */
export class ExecutionOrchestrator {
  constructor(_repository: { create(): { state: string } }, _adapter: { start(): Promise<void> }) {}
  async dispatch(_attempt: { attemptId: string; state: string }): Promise<void> {
    throw new Error('DIRECT_DISPATCH_DISABLED');
  }
}
