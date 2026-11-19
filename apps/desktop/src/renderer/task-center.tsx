/* eslint-disable no-unused-vars -- the callback parameter identifies the persisted Task. */
import { useState } from 'react';
import type { IpcResponse } from '../shared/ipc-contract.js';
import { TaskDetail, type TaskDetailModel } from './task-detail.js';

export interface TaskCard extends TaskDetailModel { taskId: string; updatedAt: string; }

export function TaskCenter({ tasks, onQueuedCancelled, cancelQueuedTask }: Readonly<{ tasks: readonly TaskCard[]; onQueuedCancelled?: (taskId: string) => void; cancelQueuedTask?: ((taskId: string) => Promise<IpcResponse>) | undefined }>) {
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const cancel = onQueuedCancelled && cancelQueuedTask;
  async function cancelQueued(taskId: string) {
    if (!cancel || pending) return;
    setPending(taskId);
    setNotice('');
    try {
      const result = await cancel(taskId);
      if ('queuedCancellation' in result && result.queuedCancellation === 'CANCELLED') {
        onQueuedCancelled?.(taskId);
        setNotice('Queued task cancelled.');
      } else if (!('queuedCancellation' in result) || result.queuedCancellation !== 'DISMISSED') {
        setNotice('Task not cancelled. Its queue state could not be verified.');
      }
    } catch {
      setNotice('Task not cancelled. Its queue state could not be verified.');
    } finally { setPending(null); }
  }
  return <section aria-label="Task Center"><h2>Task Center</h2>{notice && <p role="status">{notice}</p>}{tasks.length === 0
    ? <p>No Tasks yet.</p>
    : tasks.map(task => <article key={task.taskId}><p>{task.updatedAt}</p><TaskDetail task={task} />
        {task.state === 'QUEUED' && cancel && <button type="button" disabled={pending !== null} onClick={() => void cancelQueued(task.taskId)}>Cancel queued task</button>}
      </article>)}</section>;
}
