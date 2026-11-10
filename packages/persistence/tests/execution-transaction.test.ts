import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteExecutionRepository } from '../src/repositories/execution-repository.js';
import { SqliteResourceLeaseRepository } from '../src/repositories/resource-lease-repository.js';
import { createProposalVersion } from '@super-assistant/domain';

function seedAuthorizedProposal(db: ReturnType<typeof createFoundationDatabase>, grantStatus: 'ISSUED' | 'CONSUMED', forgedDigest?: string): void {
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace-1', 'owner-1', 'Workspace', 'ACTIVE', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent-1', 'workspace-1', 'Codex', '1.0.0', 'CONNECTED', 'AVAILABLE', null, 1);
  db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project-1', 'workspace-1', 'Project', 'E:/fixture', 'e:/fixture', 'ACTIVE', 'agent-1', 1, '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function-1', 'agent-1', 'implement', '1.0.0', 'ACTIVE');
  const proposal = createProposalVersion({ proposalVersionId: 'proposal-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', objective: 'Test execution', actions: ['COMMAND'], projectSnapshotVersion: '1', agentVersion: '1.0.0', functionVersion: '1.0.0', capabilityVersion: '1.0.0', baselineCommit: 'base', expiresAt: '2026-08-14T00:00:00.000Z', createdAt: '2026-08-12T00:00:00.000Z' });
  const digest = forgedDigest ?? proposal.digest;
  db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(proposal.proposalVersionId, proposal.workspaceId, proposal.projectId, proposal.agentId, proposal.functionId, proposal.objective, JSON.stringify(proposal.actions), proposal.projectSnapshotVersion, proposal.agentVersion, proposal.functionVersion, proposal.capabilityVersion, proposal.baselineCommit, proposal.expiresAt, proposal.createdAt, digest);
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('grant-1', proposal.proposalVersionId, digest, 'owner-1', 'grant-key-1', JSON.stringify(proposal.actions), grantStatus, '2026-08-12T00:00:00.000Z', proposal.expiresAt);
}

test.each([
  ["UPDATE projects SET snapshot_version = 2 WHERE project_id = 'project-1'", 'Project snapshot'],
  ["UPDATE projects SET status = 'PAUSED' WHERE project_id = 'project-1'", 'Project status'],
  ["UPDATE agents SET agent_version = '2.0.0' WHERE agent_id = 'agent-1'", 'Agent version'],
  ["UPDATE agents SET connection = 'UNAVAILABLE', availability = 'PAUSED' WHERE agent_id = 'agent-1'", 'Agent connection'],
  ["UPDATE agents SET availability = 'SATURATED' WHERE agent_id = 'agent-1'", 'Agent availability'],
  ["UPDATE functions SET function_version = '2.0.0' WHERE function_id = 'function-1'", 'Function version'],
  ["UPDATE functions SET lifecycle = 'DISABLED' WHERE function_id = 'function-1'", 'Function lifecycle']
])('new Attempt rejects stale %s (%s) without consuming a Grant', (mutation) => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db, 'ISSUED');
    db.prepare(mutation).run();
    const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
    const repo = new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1');
    expect(() => repo.createAuthorizedExecution(input)).toThrow('EXECUTION_SNAPSHOT_STALE');
    expect(db.prepare('SELECT status FROM authorization_grants').get()).toEqual({ status: 'ISSUED' });
    for (const table of ['tasks', 'execution_attempts', 'resource_leases', 'outbox']) {
      expect(db.prepare(`SELECT count(*) AS count FROM ${table}`).get()).toEqual({ count: 0 });
    }
  } finally { db.close(); }
});

test('atomically creates one Task, WorkItem, Attempt, Lease and Outbox command per confirmation key', () => {
  const db = createFoundationDatabase(':memory:'); const executions = new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1');
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-12T00:00:00.000Z' };
  seedAuthorizedProposal(db, 'ISSUED');
  expect(executions.createAuthorizedExecution(input)).toEqual(expect.objectContaining({ attemptId: 'attempt-1', created: true }));
  expect(db.prepare('SELECT created_at FROM tasks').get()).toEqual({ created_at: '2026-08-13T00:00:00.000Z' });
  expect(db.prepare('SELECT created_at FROM execution_attempts').get()).toEqual({ created_at: '2026-08-13T00:00:00.000Z' });
  expect(executions.createAuthorizedExecution({ ...input, attemptId: 'attempt-2' })).toEqual(expect.objectContaining({ attemptId: 'attempt-1', created: false }));
  expect(db.prepare('select count(*) as count from execution_attempts').get()).toEqual({ count: 1 });
  expect(db.prepare('select count(*) as count from outbox').get()).toEqual({ count: 1 }); db.close();
});

test('a replay after the Project changes returns the prior receipt without a new Attempt', () => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  try {
    const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
    const repository = new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1');
    expect(repository.createAuthorizedExecution(input)).toEqual({ attemptId: 'attempt-1', created: true });
    db.prepare("UPDATE projects SET snapshot_version = 2 WHERE project_id = 'project-1'").run();
    expect(repository.createAuthorizedExecution({ ...input, attemptId: 'attempt-2' })).toEqual({ attemptId: 'attempt-1', created: false });
    expect(db.prepare('SELECT count(*) AS count FROM execution_attempts').get()).toEqual({ count: 1 });
    expect(db.prepare('SELECT count(*) AS count FROM outbox').get()).toEqual({ count: 1 });
  } finally { db.close(); }
});

test.each(['[]', '["READ"]', '["NETWORK"]', '["UNKNOWN"]'])('Grant actions %s cannot differ from the approved Proposal', (actions) => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  try {
    db.prepare("UPDATE authorization_grants SET actions_json = ? WHERE grant_id = 'grant-1'").run(actions);
    const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
    const repository = new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1');
    expect(() => repository.createAuthorizedExecution(input)).toThrow();
    expect(db.prepare('SELECT status FROM authorization_grants').get()).toEqual({ status: 'ISSUED' });
    expect(db.prepare('SELECT count(*) AS count FROM execution_attempts').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT count(*) AS count FROM outbox').get()).toEqual({ count: 0 });
  } finally { db.close(); }
});

test('matching but forged Proposal and Grant digests cannot create an Attempt', () => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED', 'sha256:' + 'a'.repeat(64));
  try {
    const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
    expect(() => new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution(input)).toThrow();
    expect(db.prepare('SELECT status FROM authorization_grants').get()).toEqual({ status: 'ISSUED' });
    expect(db.prepare('SELECT count(*) AS count FROM execution_attempts').get()).toEqual({ count: 0 });
  } finally { db.close(); }
});

test('a Grant expiry extended beyond the Proposal cannot create an Attempt', () => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  try {
    db.prepare("UPDATE authorization_grants SET expires_at = '2026-08-15T00:00:00.000Z' WHERE grant_id = 'grant-1'").run();
    const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
    expect(() => new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution(input)).toThrow();
    expect(db.prepare('SELECT status FROM authorization_grants').get()).toEqual({ status: 'ISSUED' });
    expect(db.prepare('SELECT count(*) AS count FROM execution_attempts').get()).toEqual({ count: 0 });
  } finally { db.close(); }
});

test('consumes a grant with the execution transaction and never creates a partial execution for a spent grant', () => {
  const db = createFoundationDatabase(':memory:'); const executions = new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1');
  seedAuthorizedProposal(db, 'CONSUMED');
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
  expect(() => executions.createAuthorizedExecution(input)).toThrow('GRANT_NOT_CONSUMABLE');
  expect(db.prepare('select count(*) as count from execution_attempts').get()).toEqual({ count: 0 });
  db.close();
});

test.each([
  { workspaceId: 'other-workspace' },
  { projectId: 'other-project' },
  { agentId: 'other-agent' },
  { functionId: 'other-function' }
])('rejects an execution that does not match the approved Proposal: %o', (changed) => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
  expect(() => new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ ...input, ...changed })).toThrow();
  expect(db.prepare('SELECT status FROM authorization_grants').get()).toEqual({ status: 'ISSUED' });
  expect(db.prepare('SELECT count(*) AS count FROM tasks').get()).toEqual({ count: 0 });
  expect(db.prepare('SELECT count(*) AS count FROM outbox').get()).toEqual({ count: 0 });
  db.close();
});

test('rejects a Grant digest mismatch without consuming it', () => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  db.prepare("UPDATE authorization_grants SET proposal_digest = 'sha256:bad'").run();
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
  expect(() => new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution(input)).toThrow();
  expect(db.prepare('SELECT status FROM authorization_grants').get()).toEqual({ status: 'ISSUED' });
  expect(db.prepare('SELECT count(*) AS count FROM tasks').get()).toEqual({ count: 0 });
  db.close();
});

test.each([{ projectId: 'other-project' }, { agentId: 'other-agent' }, { functionId: 'other-function' }, { authorizationGrantId: 'other-grant' }, { resourceKey: 'other-resource' }, { fencingToken: 2 }])('rejects execution-key replay with changed scope: %o', (changed) => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
  const repository = new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1');
  repository.createAuthorizedExecution(input);
  expect(() => repository.createAuthorizedExecution({ ...input, attemptId: 'attempt-2', ...changed })).toThrow();
  expect(db.prepare('SELECT count(*) AS count FROM execution_attempts').get()).toEqual({ count: 1 });
  db.close();
});

test.each(['2026-08-14T00:00:00.000Z', 'invalid-clock'])('trusted time prevents a backdated request from consuming an expired Grant: %s', (now) => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  const repository = Reflect.construct(SqliteExecutionRepository, [db, () => now, () => 'owner-1']) as SqliteExecutionRepository;
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
  expect(() => repository.createAuthorizedExecution(input)).toThrow();
  expect(db.prepare('SELECT status FROM authorization_grants').get()).toEqual({ status: 'ISSUED' });
  expect(db.prepare('SELECT count(*) AS count FROM tasks').get()).toEqual({ count: 0 });
  expect(db.prepare('SELECT count(*) AS count FROM outbox').get()).toEqual({ count: 0 });
  db.close();
});

test('a different local principal cannot consume or replay another owner\'s Grant', () => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
  const intruder = Reflect.construct(SqliteExecutionRepository, [db, () => '2026-08-13T00:00:00.000Z', () => 'intruder']) as SqliteExecutionRepository;
  expect(() => intruder.createAuthorizedExecution(input)).toThrow();
  expect(db.prepare('SELECT status FROM authorization_grants').get()).toEqual({ status: 'ISSUED' });
  const owner = Reflect.construct(SqliteExecutionRepository, [db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1']) as SqliteExecutionRepository;
  owner.createAuthorizedExecution(input);
  expect(() => intruder.createAuthorizedExecution(input)).toThrow();
  db.prepare("UPDATE workspaces SET status = 'LOCKED' WHERE workspace_id = ?").run('workspace-1');
  expect(() => owner.createAuthorizedExecution(input)).toThrow();
  expect(db.prepare('SELECT count(*) AS count FROM execution_attempts').get()).toEqual({ count: 1 });
  db.close();
});

test('a locked Workspace cannot consume a Grant or create an Attempt', () => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  db.prepare("UPDATE workspaces SET status = 'LOCKED' WHERE workspace_id = ?").run('workspace-1');
  const owner = new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1');
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
  expect(() => owner.createAuthorizedExecution(input)).toThrow();
  expect(db.prepare('SELECT status FROM authorization_grants').get()).toEqual({ status: 'ISSUED' });
  expect(db.prepare('SELECT count(*) AS count FROM tasks').get()).toEqual({ count: 0 });
  db.close();
});

test.each([{ resourceKey: 'project:other', fencingToken: 1 }, { resourceKey: 'project:project-1', fencingToken: 0 }, { resourceKey: 'project:project-1', fencingToken: -1 }])('rejects an invalid initial Project lease: %o', (claim) => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  const repository = new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1');
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: claim.resourceKey, fencingToken: claim.fencingToken, createdAt: '2026-08-13T00:00:00.000Z' };
  expect(() => repository.createAuthorizedExecution(input)).toThrow();
  expect(db.prepare('SELECT status FROM authorization_grants').get()).toEqual({ status: 'ISSUED' });
  expect(db.prepare('SELECT count(*) AS count FROM tasks').get()).toEqual({ count: 0 });
  expect(db.prepare('SELECT count(*) AS count FROM outbox').get()).toEqual({ count: 0 });
  db.close();
});

test('an active Project lease blocks a second authorized Attempt without consuming its Grant', () => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  const repository = new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1');
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' };
  repository.createAuthorizedExecution(input);
  db.prepare("INSERT INTO authorization_grants SELECT 'grant-2', proposal_version_id, digest, 'owner-1', 'grant-key-2', actions_json, 'ISSUED', '2026-08-12T00:00:00.000Z', expires_at FROM proposal_versions WHERE proposal_version_id = 'proposal-1'").run();
  const next = { ...input, taskId: 'task-2', workItemId: 'work-2', attemptId: 'attempt-2', leaseId: 'lease-2', requestId: 'request-2', idempotencyKey: 'confirm-2', authorizationGrantId: 'grant-2', fencingToken: 2 };
  expect(() => repository.createAuthorizedExecution(next)).toThrow('RESOURCE_LEASE_BUSY');
  expect(db.prepare("SELECT status FROM authorization_grants WHERE grant_id = 'grant-2'").get()).toEqual({ status: 'ISSUED' });
  expect(db.prepare('SELECT count(*) AS count FROM tasks').get()).toEqual({ count: 1 });
  expect(db.prepare('SELECT count(*) AS count FROM outbox').get()).toEqual({ count: 1 });
  const leases = new SqliteResourceLeaseRepository(db);
  expect(() => leases.acquire({ leaseId: 'direct', resourceKey: input.resourceKey, attemptId: input.attemptId, fencingToken: 3, createdAt: input.createdAt })).toThrow('RESOURCE_LEASE_BUSY');
  expect(() => leases.acquire({ leaseId: 'legacy-direct', resourceKey: 'worktree:project-1', attemptId: input.attemptId, fencingToken: 3, createdAt: input.createdAt })).toThrow('RESOURCE_LEASE_BUSY');
  db.prepare("UPDATE resource_leases SET state = 'QUARANTINED' WHERE lease_id = 'lease-1'").run();
  expect(() => repository.createAuthorizedExecution(next)).toThrow('RESOURCE_LEASE_BUSY');
  db.prepare("UPDATE resource_leases SET state = 'ACTIVE' WHERE lease_id = 'lease-1'").run();
  expect(leases.release('lease-1', 1, '2026-08-13T01:00:00.000Z')).toBe(true);
  expect(() => repository.createAuthorizedExecution({ ...next, fencingToken: 1 })).toThrow('STALE_FENCING_TOKEN');
  expect(repository.createAuthorizedExecution(next)).toEqual({ attemptId: 'attempt-2', created: true });
  db.close();
});

test('legacy Project lease keys remain fenced until reconciled and use a higher successor token', () => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db, 'ISSUED');
  const repository = new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1');
  const input = { taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'confirm-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 5, createdAt: '2026-08-13T00:00:00.000Z' };
  repository.createAuthorizedExecution(input);
  db.prepare("UPDATE resource_leases SET resource_key = 'worktree:project-1' WHERE lease_id = 'lease-1'").run();
  db.prepare("INSERT INTO authorization_grants SELECT 'grant-2', proposal_version_id, digest, 'owner-1', 'grant-key-2', actions_json, 'ISSUED', '2026-08-12T00:00:00.000Z', expires_at FROM proposal_versions WHERE proposal_version_id = 'proposal-1'").run();
  const next = { ...input, taskId: 'task-2', workItemId: 'work-2', attemptId: 'attempt-2', leaseId: 'lease-2', requestId: 'request-2', idempotencyKey: 'confirm-2', authorizationGrantId: 'grant-2', fencingToken: 6 };
  expect(() => repository.createAuthorizedExecution(next)).toThrow('RESOURCE_LEASE_BUSY');
  db.prepare("UPDATE resource_leases SET state = 'RELEASED' WHERE lease_id = 'lease-1'").run();
  expect(() => repository.createAuthorizedExecution({ ...next, fencingToken: 5 })).toThrow('STALE_FENCING_TOKEN');
  expect(repository.createAuthorizedExecution(next)).toEqual({ attemptId: 'attempt-2', created: true });
  db.close();
});
