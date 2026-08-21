export type TaskDisplayState = 'QUEUED' | 'RUNNING' | 'RUNNING / RECONCILING' | 'CANCELLING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface TaskProjectionInput {
  taskId: string;
  goal: string;
  projectName: string;
  agentName: string;
  updatedAt: string;
  attemptState: string;
  cancellation: 'NONE' | 'REQUESTED' | 'TERMINATING' | 'LEASE_RELEASING';
  activity: readonly string[];
}

export interface TaskProjection {
  taskId: string;
  goal: string;
  projectName: string;
  agentName: string;
  updatedAt: string;
  state: TaskDisplayState;
  activity: readonly string[];
}

/* eslint-disable no-control-regex -- intentionally strips renderer control characters. */
function safeText(value: string): string {
  return value.replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 4096);
}

function deriveDisplayState(input: TaskProjectionInput): TaskDisplayState {
  if (input.cancellation !== 'NONE' || input.attemptState === 'CANCELLING') return 'CANCELLING';
  if (input.attemptState === 'UNKNOWN' || input.attemptState === 'RECONCILING') return 'RUNNING / RECONCILING';
  if (input.attemptState === 'SUCCEEDED') return 'COMPLETED';
  if (input.attemptState === 'FAILED') return 'FAILED';
  if (input.attemptState === 'CANCELLED') return 'CANCELLED';
  if (input.attemptState === 'CREATED' || input.attemptState === 'NOT_STARTED') return 'QUEUED';
  return 'RUNNING';
}

export function projectTask(input: TaskProjectionInput): TaskProjection {
  return { taskId: input.taskId, goal: safeText(input.goal), projectName: safeText(input.projectName), agentName: safeText(input.agentName), updatedAt: input.updatedAt, state: deriveDisplayState(input), activity: input.activity.slice(-100).map(safeText) };
}
