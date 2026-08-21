import { expect, test } from 'vitest';
import { createCompensatingProjectChange, createProjectChange } from '../src/project-change.js';

const applied = createProjectChange({ changeId: 'change-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', agentId: 'agent-1', authorizationGrantId: 'grant-1', resourceKey: 'worktree:project-1', baselineRevision: 'base', resultRevision: 'result', status: 'APPLIED', createdAt: '2026-08-21T00:00:00.000Z' });

test('creates a linked compensating change instead of altering original history', () => {
  const compensation = createCompensatingProjectChange(applied, { changeId: 'change-2', resultRevision: 'rollback-result', createdAt: '2026-08-21T00:01:00.000Z' });
  expect(compensation.originalChangeId).toBe('change-1');
  expect(compensation.status).toBe('APPLIED');
  expect(applied.originalChangeId).toBeUndefined();
});

test('does not compensate an unapplied change', () => {
  expect(() => createCompensatingProjectChange({ ...applied, status: 'FAILED' }, { changeId: 'change-2', resultRevision: 'rollback-result', createdAt: '2026-08-21T00:01:00.000Z' })).toThrow('CHANGE_NOT_COMPENSABLE');
});
