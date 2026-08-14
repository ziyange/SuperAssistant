import { expect, test } from 'vitest';
import { deriveTaskState } from '../src/task.js';
import { createRequiredWorkItem, remediationWorkItem } from '../src/work-item.js';

test('an uncertain Attempt prevents Task completion', () => {
  expect(deriveTaskState(['SUCCEEDED', 'UNKNOWN'])).toBe('RUNNING');
  expect(deriveTaskState(['SUCCEEDED', 'RECONCILING'])).toBe('RUNNING');
  expect(deriveTaskState(['SUCCEEDED'])).toBe('ACCEPTANCE_PENDING');
  expect(deriveTaskState(['SUCCEEDED'], true)).toBe('COMPLETED');
});

test('uses a remediation Work Item beneath the original Task after failed acceptance', () => {
  expect(remediationWorkItem({ workItemId: 'work-2', taskId: 'task-1', agentId: 'agent-1', functionId: 'fix', responsibilityVersion: '1.0.0' })).toEqual(expect.objectContaining({ taskId: 'task-1', state: 'READY', required: true }));
  expect(createRequiredWorkItem({ workItemId: 'work-1', taskId: 'task-1', agentId: 'agent-1', functionId: 'implement', responsibilityVersion: '1.0.0' })).toEqual(expect.objectContaining({ state: 'WAITING', required: true }));
});
