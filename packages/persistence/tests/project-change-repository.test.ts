import { expect, test } from 'vitest';
import { createCompensatingProjectChange, createProjectChange } from '@super-assistant/domain';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteProjectChangeRepository } from '../src/repositories/project-change-repository.js';

test('adds a scoped compensating ProjectChange without altering the original', () => {
  const database = createFoundationDatabase(':memory:'); const changes = new SqliteProjectChangeRepository(database);
  const original = createProjectChange({ changeId: 'change-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', agentId: 'agent-1', authorizationGrantId: 'grant-1', resourceKey: 'worktree:project-1', baselineRevision: 'base', resultRevision: 'result', status: 'APPLIED', createdAt: '2026-08-21T00:00:00.000Z' });
  changes.append(original); changes.append(createCompensatingProjectChange(original, { changeId: 'change-2', resultRevision: 'rollback', createdAt: '2026-08-21T00:01:00.000Z' }));
  expect(changes.listForProject({ workspaceId: 'workspace-1', projectId: 'project-1' })).toMatchObject([{ changeId: 'change-1' }, { changeId: 'change-2', originalChangeId: 'change-1' }]);
  expect(changes.listForProject({ workspaceId: 'workspace-2', projectId: 'project-1' })).toEqual([]);
  expect(() => database.prepare("DELETE FROM project_changes WHERE change_id = 'change-1'").run()).toThrow(/append-only/);
  database.close();
});
