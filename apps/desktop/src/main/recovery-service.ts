/* eslint-disable no-unused-vars -- constructor parameter property is a runtime dependency. */
export class RecoveryService {
  constructor(private readonly adapter: { reconcile(): Promise<{ status: 'INDETERMINATE' | 'NOT_STARTED' | 'ACTIVE' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' }> }) {}
  async recover(attempt: { attemptId: string; state: string }): Promise<{ attemptId: string; state: string; redispatch: boolean }> {
    const observation = await this.adapter.reconcile();
    return observation.status === 'INDETERMINATE' ? { attemptId: attempt.attemptId, state: 'RECONCILING', redispatch: false } : { attemptId: attempt.attemptId, state: observation.status, redispatch: false };
  }
}
