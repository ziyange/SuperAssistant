import type { ExecutionAttempt } from './execution-attempt.js';

export function applyDshSequence(attempt: ExecutionAttempt, sequence: number): ExecutionAttempt {
  if (sequence <= attempt.lastSequence) return attempt;
  if (sequence !== attempt.lastSequence + 1) return { ...attempt, state: 'RECONCILING' };
  return { ...attempt, lastSequence: sequence };
}

export function canRedispatchDsh(attempt: ExecutionAttempt): false {
  void attempt;
  return false;
}
