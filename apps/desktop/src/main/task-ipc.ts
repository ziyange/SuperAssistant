/* eslint-disable no-unused-vars -- port parameter names are interface contracts. */
import type { TaskProjection } from '@super-assistant/domain';

export interface TaskReadPort { get(taskId: string): TaskProjection | null; list?(): readonly TaskProjection[]; }

export function projectTaskForRenderer(port: TaskReadPort, input: { taskId: string }): TaskProjection {
  const task = port.get(input.taskId);
  if (!task) throw new Error('TASK_NOT_FOUND');
  return task;
}

export function listTasksForRenderer(port: TaskReadPort): readonly TaskProjection[] {
  if (!port.list) throw new Error('TASK_LIST_UNAVAILABLE');
  return port.list();
}
