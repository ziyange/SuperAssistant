/* eslint-disable no-unused-vars -- parameter names are part of this public port contract. */
import { reconcileAttempt, type RecoveryObservation, type RecoveryOutcome, type RecoveryState } from '@super-assistant/domain';

export interface RecoveryAdapterPort {
  status(attemptId: string): Promise<RecoveryObservation['status']>;
  events(attemptId: string): Promise<RecoveryObservation['events']>;
  result(attemptId: string): Promise<RecoveryObservation['result']>;
}

export async function reconcileAfterRestart(attempts: readonly Readonly<{ attemptId: string; state: RecoveryState; lastSequence: number }>[], adapter: RecoveryAdapterPort): Promise<Readonly<{ mode: 'NORMAL' | 'DEGRADED_READ_ONLY'; attempts: readonly RecoveryOutcome[] }>> {
  const outcomes = await Promise.all(attempts.map(async (attempt) => reconcileAttempt(attempt, {
    status: await adapter.status(attempt.attemptId),
    events: await adapter.events(attempt.attemptId),
    result: await adapter.result(attempt.attemptId)
  })));
  return { mode: outcomes.some((outcome) => outcome.state === 'RECONCILING') ? 'DEGRADED_READ_ONLY' : 'NORMAL', attempts: outcomes };
}
