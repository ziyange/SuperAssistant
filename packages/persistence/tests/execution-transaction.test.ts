import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteExecutionRepository } from '../src/repositories/execution-repository.js';

function seedAuthorizedProposal(db: ReturnType<typeof createFoundationDatabase>, grantStatus: 'ISSUED' | 'CONSUMED'): void {
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace-1', 'owner-1', 'Workspace', 'ACTIVE', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent-1', 'workspace-1', 'Codex', '1.0.0', 'CONNECTED', 'AVAILABLE', null, 1);
  db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project-1', 'workspace-1', 'Project', 'E:/fixture', 'e:/fixture', 'ACTIVE', 'agent-1', 1, '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function-1', 'agent-1', 'implement', '1.0.0', 'ACTIVE');
  db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('proposal-1', 'workspace-1', 'project-1', 'agent-1', 'function-1', 'Test execution', '[]', '1', '1.0.0', '1.0.0', '1.0.0', 'base', '2026-08-14T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 'sha256:abc');
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('grant-1', 'proposal-1', 'sha256:abc', 'actor-1', 'grant-key-1', '[]', grantStatus, '2026-08-12T00:00:00.000Z', '2026-08-14T00:00:00.000Z');
}

test('atomically creates one Task, WorkItem, Attempt, Lease and Outbox command per confirmation key', () => {
  const db = createFoundationDatabase(':memory:'); const executions = new SqliteExecutionRepository(db);
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'worktree:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
  seedAuthorizedProposal(db, 'ISSUED');
  expect(executions.createAuthorizedExecution(input)).toEqual(expect.objectContaining({ attemptId: 'attempt-1', created: true }));
  expect(executions.createAuthorizedExecution({ ...input, attemptId: 'attempt-2' })).toEqual(expect.objectContaining({ attemptId: 'attempt-1', created: false }));
  expect(db.prepare('select count(*) as count from execution_attempts').get()).toEqual({ count: 1 });
  expect(db.prepare('select count(*) as count from outbox').get()).toEqual({ count: 1 }); db.close();
});

test('consumes a grant with the execution transaction and never creates a partial execution for a spent grant', () => {
  const db = createFoundationDatabase(':memory:'); const executions = new SqliteExecutionRepository(db);
  seedAuthorizedProposal(db, 'CONSUMED');
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'worktree:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
  expect(() => executions.createAuthorizedExecution(input)).toThrow('GRANT_NOT_CONSUMABLE');
  expect(db.prepare('select count(*) as count from execution_attempts').get()).toEqual({ count: 0 });
  db.close();
});
