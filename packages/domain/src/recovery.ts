export type RecoveryState = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'NOT_STARTED' | 'UNKNOWN' | 'RECONCILING';
export type RecoveryObservation = Readonly<{
  status: 'RUNNING' | 'UNAVAILABLE' | 'UNKNOWN';
  events: 'AVAILABLE' | 'GAP' | 'UNAVAILABLE';
  result: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'NOT_STARTED' | 'MISSING';
}>;

export type RecoveryOutcome = Readonly<{ attemptId: string; state: RecoveryState; dispatchAllowed: false; mode: 'READ_ONLY' }>;

/**
 * Reconciliation is deliberately a read-only transition. Only a durable result
 * establishes a terminal state; a missing result leaves the Attempt ambiguous.
 */
export function reconcileAttempt(attempt: Readonly<{ attemptId: string; state: RecoveryState; lastSequence: number }>, observation: RecoveryObservation): RecoveryOutcome {
  const terminal = observation.result === 'SUCCEEDED' || observation.result === 'FAILED' || observation.result === 'CANCELLED';
  if (terminal) return { attemptId: attempt.attemptId, state: observation.result, dispatchAllowed: false, mode: 'READ_ONLY' };
  if (observation.result === 'NOT_STARTED') return { attemptId: attempt.attemptId, state: 'NOT_STARTED', dispatchAllowed: false, mode: 'READ_ONLY' };
  // A status observation can be stale after a restart. Without a matching
  // durable result it is evidence for continued reconciliation, not a state
  // transition or permission to act on the upstream process.
  return { attemptId: attempt.attemptId, state: 'RECONCILING', dispatchAllowed: false, mode: 'READ_ONLY' };
}
