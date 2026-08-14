import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteInboxRepository } from '../src/repositories/inbox-repository.js';
import { SqliteOutboxRepository } from '../src/repositories/outbox-repository.js';
import { SqliteExecutionRepository } from '../src/repositories/execution-repository.js';

function seedAuthorizedProposal(db: ReturnType<typeof createFoundationDatabase>): void {
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace-1', 'owner-1', 'Workspace', 'ACTIVE', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent-1', 'workspace-1', 'Codex', '1.0.0', 'CONNECTED', 'AVAILABLE', null, 1);
  db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project-1', 'workspace-1', 'Project', 'E:/fixture', 'e:/fixture', 'ACTIVE', 'agent-1', 1, '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function-1', 'agent-1', 'implement', '1.0.0', 'ACTIVE');
  db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('proposal-1', 'workspace-1', 'project-1', 'agent-1', 'function-1', 'Test execution', '[]', '1', '1.0.0', '1.0.0', '1.0.0', 'base', '2026-08-14T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 'sha256:abc');
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('grant-1', 'proposal-1', 'sha256:abc', 'actor-1', 'grant-key-1', '[]', 'ISSUED', '2026-08-12T00:00:00.000Z', '2026-08-14T00:00:00.000Z');
}

test('deduplicates an at-least-once event and rejects an ID reused with another digest', () => {
  const db = createFoundationDatabase(':memory:'); const inbox = new SqliteInboxRepository(db);
  expect(inbox.record('adapter-1', 'message-1', 'sha256:aaa')).toBe('APPLIED');
  expect(inbox.record('adapter-1', 'message-1', 'sha256:aaa')).toBe('DUPLICATE');
  expect(() => inbox.record('adapter-1', 'message-1', 'sha256:bbb')).toThrow('IDEMPOTENCY_CONFLICT'); db.close();
});

test('claims a pending command once and retains it as evidence after acknowledgement', () => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db); const outbox = new SqliteOutboxRepository(db); new SqliteExecutionRepository(db).createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'worktree:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
  outbox.enqueue({ messageId: 'outbox-1', attemptId: 'attempt-1', requestId: 'request-1', idempotencyKey: 'key-1', messageType: 'start', payload: '{}', createdAt: '2026-08-13T00:00:00.000Z' });
  expect(outbox.claimNext()?.messageId).toBe('outbox:attempt-1');
  outbox.acknowledge('outbox:attempt-1');
  expect(outbox.claimNext()?.messageId).toBe('outbox-1');
  expect(outbox.claimNext()).toBeNull();
  outbox.acknowledge('outbox-1');
  expect(db.prepare("select state from outbox where message_id = 'outbox-1'").get()).toEqual({ state: 'ACKNOWLEDGED' }); db.close();
});
