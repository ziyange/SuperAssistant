export type TaskState = 'QUEUED' | 'RUNNING' | 'ACCEPTANCE_PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export function deriveTaskState(attemptStates: readonly string[], requiredWorkItemsAccepted = false): TaskState {
  if (attemptStates.some((state) => state === 'UNKNOWN' || state === 'RECONCILING' || state === 'RUNNING' || state === 'CANCELLING' || state === 'DISPATCH_PENDING' || state === 'DISPATCHED')) return 'RUNNING';
  if (attemptStates.some((state) => state === 'FAILED')) return 'FAILED';
  if (attemptStates.length > 0 && attemptStates.every((state) => state === 'CANCELLED')) return 'CANCELLED';
  if (attemptStates.some((state) => state === 'SUCCEEDED')) return requiredWorkItemsAccepted ? 'COMPLETED' : 'ACCEPTANCE_PENDING';
  return 'QUEUED';
}
