export type ExecutionAttemptState = 'CREATED' | 'DISPATCH_PENDING' | 'DISPATCHED' | 'RUNNING' | 'CANCELLING' | 'CANCELLED' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'RECONCILING' | 'NOT_STARTED';
export type ExecutionEventType = 'DISPATCHED' | 'EXECUTION_STARTED' | 'ACTIVITY_RECORDED' | 'CONNECTION_LOST' | 'RECONCILIATION_STARTED' | 'RECONCILIATION_NOT_STARTED' | 'EXECUTION_SUCCEEDED' | 'EXECUTION_FAILED' | 'CANCEL_REQUESTED' | 'EXECUTION_CANCELLED';
export interface ExecutionAttempt { attemptId: string; workItemId: string; requestId: string; idempotencyKey: string; state: ExecutionAttemptState; lastSequence: number; }

export function createExecutionAttempt(input: Omit<ExecutionAttempt, 'state' | 'lastSequence'>): ExecutionAttempt { return { ...input, state: 'CREATED', lastSequence: 0 }; }
export function canDispatchAttempt(attempt: ExecutionAttempt): boolean { return attempt.state === 'DISPATCH_PENDING'; }
export function applyAttemptEvent(attempt: ExecutionAttempt, event: { sequence: number; type: ExecutionEventType }): ExecutionAttempt {
  if (event.sequence <= attempt.lastSequence) return attempt;
  // A missing event is evidence of an uncertain external outcome. Preserve the
  // last trusted sequence and force reconciliation instead of guessing a state.
  if (event.sequence !== attempt.lastSequence + 1) return { ...attempt, state: 'RECONCILING' };
  const state: ExecutionAttemptState = event.type === 'DISPATCHED' ? 'DISPATCHED'
    : event.type === 'EXECUTION_STARTED' ? 'RUNNING'
      : event.type === 'CONNECTION_LOST' ? 'UNKNOWN'
        : event.type === 'RECONCILIATION_STARTED' ? 'RECONCILING'
          : event.type === 'RECONCILIATION_NOT_STARTED' && attempt.state === 'RECONCILING' ? 'NOT_STARTED'
            : event.type === 'CANCEL_REQUESTED' ? 'CANCELLING'
              : event.type === 'EXECUTION_SUCCEEDED' ? 'SUCCEEDED'
                : event.type === 'EXECUTION_FAILED' ? 'FAILED'
                  : event.type === 'EXECUTION_CANCELLED' ? 'CANCELLED'
                    : attempt.state;
  return { ...attempt, state, lastSequence: event.sequence };
}
