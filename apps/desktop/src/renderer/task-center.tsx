import { TaskDetail, type TaskDetailModel } from './task-detail.js';

export interface TaskCard extends TaskDetailModel { taskId: string; updatedAt: string; }

export function TaskCenter({ tasks }: Readonly<{ tasks: readonly TaskCard[] }>) {
  return <section aria-label="Task Center"><h2>Task Center</h2>{tasks.length === 0 ? <p>No Tasks yet.</p> : tasks.map((task) => <article key={task.taskId}><p>{task.updatedAt}</p><TaskDetail task={task} /></article>)}</section>;
}
