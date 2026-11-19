import { afterEach, expect, test } from 'vitest';
import { createFoundationDatabase, SqliteExecutionRepository, SqliteTaskProjectionQuery } from '@super-assistant/persistence';
import { createProposalVersion } from '@super-assistant/domain';
import { routeIpc } from '../../src/main/ipc-router.js';
import { QueuedTaskCancellation } from '../../src/main/queued-task-cancellation.js';

const now = '2026-11-19T00:00:00.000Z';
const expiry = '2026-11-20T00:00:00.000Z';
const opened: ReturnType<typeof createFoundationDatabase>[] = [];
afterEach(() => { for (const database of opened.splice(0)) database.close(); });
const getOnboarding = async () => ({ completed: false });
const onboarding = { get: getOnboarding, set: getOnboarding };

function queued() {
  const db = createFoundationDatabase(':memory:');
  opened.push(db);
  const approval = createProposalVersion({
    proposalVersionId: 'approval', workspaceId: 'local', projectId: 'project', agentId: 'agent', functionId: 'function',
    objective: 'Write project document', actions: ['FILE_WRITE'], projectSnapshotVersion: '1', agentVersion: '0.121.0',
    functionVersion: '1.0.0', capabilityVersion: '1.0.0', baselineCommit: 'a'.repeat(40), createdAt: now, expiresAt: expiry
  });
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('local', 'local-owner', 'Local', 'ACTIVE', now, now, 1);
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent', 'local', 'Codex', '0.121.0', 'CONNECTED', 'AVAILABLE', null, 1);
  db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project', 'local', 'Project', 'project-path', 'project-path', 'ACTIVE', 'agent', 1, now, now, 1);
  db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function', 'agent', 'Develop', '1.0.0', 'ACTIVE');
  db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    approval.proposalVersionId, approval.workspaceId, approval.projectId, approval.agentId, approval.functionId, approval.objective,
    JSON.stringify(approval.actions), approval.projectSnapshotVersion, approval.agentVersion, approval.functionVersion, approval.capabilityVersion,
    approval.baselineCommit, expiry, now, approval.digest
  );
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('grant', 'approval', approval.digest, 'local-owner', 'confirm', '["FILE_WRITE"]', 'ISSUED', now, expiry);
  new SqliteExecutionRepository(db, () => now).createAuthorizedExecution({
    taskId: 'task', workItemId: 'work', attemptId: 'attempt', leaseId: 'lease', requestId: 'request',
    idempotencyKey: 'approval', workspaceId: 'local', projectId: 'project', agentId: 'agent', functionId: 'function',
    proposalVersionId: 'approval', authorizationGrantId: 'grant', resourceKey: 'project:project', fencingToken: 1, createdAt: now
  });
  return db;
}

function states(db: ReturnType<typeof queued>) {
  return ['tasks', 'work_items', 'execution_attempts', 'outbox', 'resource_leases'].map(table => db.prepare('SELECT state FROM ' + table).pluck().get());
}

test('withdraws an owned unclaimed start and releases its exact lease in one transaction', async () => {
  const db = queued();
  const prompted: string[] = [];
  const cancellation = new QueuedTaskCancellation(db, async taskId => { prompted.push(taskId); return true; }, () => now);
  const request = { channel: 'task:cancel-queued', payload: { taskId: 'task' } };
  await expect(routeIpc({ ...request, payload: { ...request.payload, verified: true } }, onboarding)).rejects.toThrow();
  const read = new SqliteTaskProjectionQuery(db);
  expect(read.get('task')?.state).toBe('QUEUED');
  expect(await routeIpc(request, onboarding, undefined, read, undefined, undefined, undefined, undefined, undefined,
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, cancellation)).toEqual({ queuedCancellation: 'CANCELLED' });
  expect(await cancellation.cancel('task')).toBe('CANCELLED');
  expect(read.get('task')?.state).toBe('CANCELLED');
  expect(prompted).toEqual(['task']);
  expect(states(db)).toEqual(['CANCELLED', 'CANCELLED', 'CANCELLED', 'CANCELLED', 'RELEASED']);
  expect(db.prepare('SELECT count(*) FROM execution_attempts').pluck().get()).toBe(1);
});

test('does not release anything if the Outbox is claimed while native confirmation is open', async () => {
  const db = queued();
  const cancellation = new QueuedTaskCancellation(db, async () => {
    db.prepare("UPDATE outbox SET state = 'DISPATCHING', claim_token = 'claim'").run();
    return true;
  }, () => now);
  expect(await cancellation.cancel('task')).toBe('NOT_CANCELLABLE');
  expect(states(db)).toEqual(['QUEUED', 'WAITING', 'DISPATCH_PENDING', 'DISPATCHING', 'ACTIVE']);
});

test('leaves the approved queue untouched when dismissed, locked, or linked to an upstream Turn', async () => {
  const db = queued();
  const dismissed = new QueuedTaskCancellation(db, async () => false, () => now);
  expect(await dismissed.cancel('task')).toBe('DISMISSED');
  const neverPrompt = new QueuedTaskCancellation(db, async () => { throw new Error('unexpected dialog'); }, () => now);
  db.prepare("UPDATE workspaces SET status = 'LOCKED'").run();
  expect(await neverPrompt.cancel('task')).toBe('NOT_CANCELLABLE');
  db.prepare("UPDATE workspaces SET status = 'ACTIVE'").run();
  db.prepare("INSERT INTO fixture_attempt_correlations VALUES ('attempt','thread','turn')").run();
  expect(await neverPrompt.cancel('task')).toBe('NOT_CANCELLABLE');
  expect(states(db)).toEqual(['QUEUED', 'WAITING', 'DISPATCH_PENDING', 'PENDING', 'ACTIVE']);
});

test('rolls back withdrawal if its lease cannot be released', async () => {
  const db = queued();
  db.exec("CREATE TRIGGER refuse_lease BEFORE UPDATE ON resource_leases BEGIN SELECT RAISE(ABORT, 'refused'); END;");
  const cancellation = new QueuedTaskCancellation(db, async () => true, () => now);
  expect(await cancellation.cancel('task')).toBe('NOT_CANCELLABLE');
  expect(states(db)).toEqual(['QUEUED', 'WAITING', 'DISPATCH_PENDING', 'PENDING', 'ACTIVE']);
});

test.each(['ACTIVE', 'RELEASED'])('refuses cancellation with a higher %s legacy Project fence from another Attempt', async state => {
  const db = queued();
  db.exec("INSERT INTO tasks SELECT 'other-task', workspace_id, project_id, proposal_version_id, authorization_grant_id, 'RUNNING', created_at FROM tasks WHERE task_id = 'task';");
  db.exec("INSERT INTO work_items VALUES ('other-work', 'other-task', 'agent', 'function', 'RUNNING');");
  db.prepare("INSERT INTO execution_attempts VALUES ('other-attempt', 'other-work', 'another-request', 'other-key', 'UNKNOWN', 0, ?)").run(now);
  db.prepare("INSERT INTO resource_leases (lease_id, resource_key, attempt_id, fencing_token, state, created_at) VALUES ('other-lease', 'worktree:project', 'other-attempt', 2, ?, ?)").run(state, now);
  const cancellation = new QueuedTaskCancellation(db, async () => true, () => now);
  expect(await cancellation.cancel('task')).toBe('NOT_CANCELLABLE');
  expect(db.prepare("SELECT state FROM outbox WHERE attempt_id = 'attempt'").pluck().get()).toBe('PENDING');
  expect(db.prepare("SELECT state FROM resource_leases WHERE lease_id = 'lease'").pluck().get()).toBe('ACTIVE');
});
