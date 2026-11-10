import { expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteInboxRepository } from '../src/repositories/inbox-repository.js';
import { SqliteOutboxRepository } from '../src/repositories/outbox-repository.js';
import { SqliteExecutionRepository } from '../src/repositories/execution-repository.js';
import { createDecision, createProposalVersion, resolveDecision } from '@super-assistant/domain';
import { SqliteDecisionRepository } from '../src/repositories/decision-repository.js';
import Database from 'better-sqlite3';
import { applyMigrations, foundationMigrations } from '../src/sqlite/migration-runner.js';
import { OutboxDispatcher } from '../../../apps/desktop/src/main/outbox-dispatcher.js';

function seedAuthorizedProposal(db: ReturnType<typeof createFoundationDatabase>): void {
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace-1', 'owner-1', 'Workspace', 'ACTIVE', '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent-1', 'workspace-1', 'Codex', '1.0.0', 'CONNECTED', 'AVAILABLE', null, 1);
  db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project-1', 'workspace-1', 'Project', 'E:/fixture', 'e:/fixture', 'ACTIVE', 'agent-1', 1, '2026-08-12T00:00:00.000Z', '2026-08-12T00:00:00.000Z', 1);
  db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function-1', 'agent-1', 'implement', '1.0.0', 'ACTIVE');
  const proposal = createProposalVersion({ proposalVersionId: 'proposal-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', objective: 'Test execution', actions: ['COMMAND'], projectSnapshotVersion: '1', agentVersion: '1.0.0', functionVersion: '1.0.0', capabilityVersion: '1.0.0', baselineCommit: 'base', expiresAt: '2026-08-14T00:00:00.000Z', createdAt: '2026-08-12T00:00:00.000Z' });
  db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(proposal.proposalVersionId, proposal.workspaceId, proposal.projectId, proposal.agentId, proposal.functionId, proposal.objective, JSON.stringify(proposal.actions), proposal.projectSnapshotVersion, proposal.agentVersion, proposal.functionVersion, proposal.capabilityVersion, proposal.baselineCommit, proposal.expiresAt, proposal.createdAt, proposal.digest);
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('grant-1', proposal.proposalVersionId, proposal.digest, 'owner-1', 'grant-key-1', JSON.stringify(proposal.actions), 'ISSUED', '2026-08-12T00:00:00.000Z', proposal.expiresAt);
}

test('deduplicates an at-least-once event and rejects an ID reused with another digest', () => {
  const db = createFoundationDatabase(':memory:'); const inbox = new SqliteInboxRepository(db);
  expect(inbox.record('adapter-1', 'message-1', 'sha256:aaa')).toBe('APPLIED');
  expect(inbox.record('adapter-1', 'message-1', 'sha256:aaa')).toBe('DUPLICATE');
  expect(() => inbox.record('adapter-1', 'message-1', 'sha256:bbb')).toThrow('IDEMPOTENCY_CONFLICT'); db.close();
});

test('claims a pending command once and retains it as evidence after acknowledgement', () => {
  const db = createFoundationDatabase(':memory:'); seedAuthorizedProposal(db); const outbox = new SqliteOutboxRepository(db); new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
  outbox.enqueue({ messageId: 'outbox-1', attemptId: 'attempt-1', requestId: 'request-1', idempotencyKey: 'key-1', messageType: 'start', payload: '{"attempt_id":"attempt-1"}', createdAt: '2026-08-13T00:00:00.000Z' });
  const first = outbox.claimNext();
  expect(first?.messageId).toBe('outbox:attempt-1');
  expect(outbox.acknowledge(first!.messageId, first!.claimToken)).toBe(true);
  const second = outbox.claimNext();
  expect(second?.messageId).toBe('outbox-1');
  expect(outbox.claimNext()).toBeNull();
  expect(outbox.acknowledge(second!.messageId, second!.claimToken)).toBe(true);
  expect(db.prepare("select state from outbox where message_id = 'outbox-1'").get()).toEqual({ state: 'ACKNOWLEDGED' }); db.close();
});

test('a real claimed SQLite start and resume reach the dispatcher with matching payloads', async () => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    const outbox = new SqliteOutboxRepository(db);
    const received: unknown[] = [];
    const dispatcher = new OutboxDispatcher(outbox, {
      start: async command => { received.push(['start', command]); },
      resume: async command => { received.push(['resume', command]); }
    });
    expect(await dispatcher.dispatchOne()).toEqual({ messageId: 'outbox:attempt-1', dispatched: true });
    db.prepare("UPDATE execution_attempts SET state = 'WAITING_USER' WHERE attempt_id = 'attempt-1'").run();
    const decisions = new SqliteDecisionRepository(db);
    decisions.create(createDecision({ decisionId: 'decision-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-1', question: 'Proceed?', level: 'L3', createdAt: '2026-08-13T00:00:01.000Z' }));
    decisions.resolveAndEnqueueResume('decision-1', { resolutionId: 'resolution-1', idempotencyKey: 'resume-key', actorId: 'owner-1', option: 'ALLOW', resolvedAt: '2026-08-13T00:00:02.000Z' });
    expect(await dispatcher.dispatchOne()).toEqual({ messageId: 'resume:decision-1', dispatched: true });
    expect(received).toEqual([['start', { attemptId: 'attempt-1' }], ['resume', { attemptId: 'attempt-1', decisionId: 'decision-1', resolutionId: 'resolution-1' }]]);
    expect(db.prepare("SELECT state FROM outbox ORDER BY message_id").all()).toEqual([{ state: 'ACKNOWLEDGED' }, { state: 'ACKNOWLEDGED' }]);
  } finally { db.close(); }
});

test.each([
  ['malformed JSON', 'start', '{'],
  ['unknown type', 'other', '{"attempt_id":"attempt-1"}'],
  ['mismatched attempt', 'start', '{"attempt_id":"other"}'],
  ['extra field', 'start', '{"attempt_id":"attempt-1","admin":true}'],
  ['missing resolution', 'resume', '{"attempt_id":"attempt-1","decision_id":"decision-1"}']
])('quarantines %s without invoking an adapter', async (_label, kind, payload) => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    if (kind === 'resume') db.prepare("UPDATE execution_attempts SET state = 'WAITING_USER' WHERE attempt_id = 'attempt-1'").run();
    db.prepare("UPDATE outbox SET message_type = ?, payload_json = ? WHERE message_id = 'outbox:attempt-1'").run(kind, payload);
    const received: unknown[] = [];
    const outbox = new SqliteOutboxRepository(db);
    const dispatcher = new OutboxDispatcher(outbox, { start: async command => { received.push(command); } });
    await expect(dispatcher.dispatchOne()).rejects.toThrow('INVALID_OUTBOX_MESSAGE');
    expect(received).toEqual([]);
    expect(db.prepare("SELECT state FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'RECONCILING' });
    expect(db.prepare("SELECT state FROM execution_attempts WHERE attempt_id = 'attempt-1'").get()).toEqual({ state: 'UNKNOWN' });
    expect(outbox.claimNext()).toBeNull();
  } finally { db.close(); }
});

test('a failed fake dispatch quarantines the claimed SQLite row and its Attempt', async () => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    const outbox = new SqliteOutboxRepository(db);
    const dispatcher = new OutboxDispatcher(outbox, { start: async () => { throw new Error('unknown fake result'); } });
    await expect(dispatcher.dispatchOne()).rejects.toThrow('DISPATCH_OUTCOME_UNKNOWN');
    expect(db.prepare("SELECT state FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'RECONCILING' });
    expect(db.prepare("SELECT state FROM execution_attempts WHERE attempt_id = 'attempt-1'").get()).toEqual({ state: 'UNKNOWN' });
    expect(outbox.claimNext()).toBeNull();
  } finally { db.close(); }
});

test.each(['UNKNOWN', 'RECONCILING'])('does not claim a pending message for an already %s Attempt', async (state) => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    db.prepare("UPDATE execution_attempts SET state = ? WHERE attempt_id = 'attempt-1'").run(state);
    const received: unknown[] = [];
    const outbox = new SqliteOutboxRepository(db);
    const dispatcher = new OutboxDispatcher(outbox, { start: async command => { received.push(command); } });
    expect(await dispatcher.dispatchOne()).toEqual({ dispatched: false });
    expect(received).toEqual([]);
    expect(db.prepare("SELECT state, claim_token FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'RECONCILING', claim_token: null });
    expect(db.prepare("SELECT state FROM execution_attempts WHERE attempt_id = 'attempt-1'").get()).toEqual({ state });
    expect(outbox.claimNext()).toBeNull();
  } finally { db.close(); }
});

test.each(['SUCCEEDED', 'FAILED', 'CANCELLED', 'NOT_STARTED', 'RUNNING', 'CANCELLING', 'WAITING_USER', 'WAITING_INPUT', 'INVALID'])('does not claim start in %s state', async state => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    db.prepare("UPDATE execution_attempts SET state = ? WHERE attempt_id = 'attempt-1'").run(state);
    const effects: unknown[] = [];
    const dispatcher = new OutboxDispatcher(new SqliteOutboxRepository(db), { start: async command => { effects.push(command); } });
    expect(await dispatcher.dispatchOne()).toEqual({ dispatched: false });
    expect(effects).toEqual([]);
    expect(db.prepare("SELECT state FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'RECONCILING' });
    expect(db.prepare("SELECT state FROM execution_attempts WHERE attempt_id = 'attempt-1'").get()).toEqual({ state });
  } finally { db.close(); }
});

test.each(['missing', 'wrong-resolution', 'wrong-work-item', 'wrong-key', 'open'])('rejects resume with %s Decision evidence', async kind => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    db.prepare("UPDATE execution_attempts SET state = 'WAITING_USER' WHERE attempt_id = 'attempt-1'").run();
    const decisions = new SqliteDecisionRepository(db);
    if (kind !== 'missing') {
      const decision = createDecision({ decisionId: 'decision-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: kind === 'wrong-work-item' ? 'other-work' : 'work-1', question: 'Proceed?', level: 'L3', createdAt: '2026-08-13T00:00:01.000Z' });
      decisions.create(decision);
      if (kind !== 'open') decisions.resolve(resolveDecision(decision, { resolutionId: 'resolution-1', idempotencyKey: 'resume-key', actorId: 'owner-1', option: 'ALLOW', resolvedAt: '2026-08-13T00:00:02.000Z' }));
    }
    db.prepare("UPDATE outbox SET message_type = 'resume', idempotency_key = ?, payload_json = ? WHERE message_id = 'outbox:attempt-1'").run(kind === 'wrong-key' ? 'other-key' : 'resume-key', JSON.stringify({ attempt_id: 'attempt-1', decision_id: 'decision-1', resolution_id: kind === 'wrong-resolution' ? 'other' : 'resolution-1' }));
    const effects: unknown[] = [];
    const dispatcher = new OutboxDispatcher(new SqliteOutboxRepository(db), { start: async command => { effects.push(command); }, resume: async command => { effects.push(command); } });
    await expect(dispatcher.dispatchOne()).rejects.toThrow('INVALID_OUTBOX_MESSAGE');
    expect(effects).toEqual([]);
    expect(db.prepare("SELECT state FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'RECONCILING' });
  } finally { db.close(); }
});

test.each(['DISPATCH_PENDING', 'RUNNING', 'SUCCEEDED', 'CANCELLED', 'NOT_STARTED'])('does not claim a resume in %s state', async state => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    db.prepare("UPDATE execution_attempts SET state = ? WHERE attempt_id = 'attempt-1'").run(state);
    db.prepare("UPDATE outbox SET message_type = 'resume', payload_json = ? WHERE message_id = 'outbox:attempt-1'").run('{"attempt_id":"attempt-1","decision_id":"decision-1","resolution_id":"resolution-1"}');
    const effects: unknown[] = [];
    const dispatcher = new OutboxDispatcher(new SqliteOutboxRepository(db), { start: async command => { effects.push(command); }, resume: async command => { effects.push(command); } });
    expect(await dispatcher.dispatchOne()).toEqual({ dispatched: false });
    expect(effects).toEqual([]);
    expect(db.prepare("SELECT state FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'RECONCILING' });
    expect(db.prepare("SELECT state FROM execution_attempts WHERE attempt_id = 'attempt-1'").get()).toEqual({ state });
  } finally { db.close(); }
});

test.each(['recovery', 'uncertain'])('%s preserves the terminal NOT_STARTED Attempt', operation => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    db.prepare("UPDATE execution_attempts SET state = 'NOT_STARTED' WHERE attempt_id = 'attempt-1'").run();
    db.prepare("UPDATE outbox SET state = 'DISPATCHING', claim_token = 'old' WHERE message_id = 'outbox:attempt-1'").run();
    const outbox = new SqliteOutboxRepository(db);
    if (operation === 'recovery') expect(outbox.recoverInterrupted()).toBe(1);
    else expect(outbox.markUncertain('outbox:attempt-1', 'old')).toBe(true);
    expect(db.prepare("SELECT state FROM execution_attempts WHERE attempt_id = 'attempt-1'").get()).toEqual({ state: 'NOT_STARTED' });
  } finally { db.close(); }
});

test('only the winning claimant receives a message during an interleaved race', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    const winner = new SqliteOutboxRepository(db);
    let won: { messageId: string } | null = null;
    const interleaved = {
      prepare(sql: string) {
        const statement = db.prepare(sql);
        if (!sql.startsWith('SELECT message_id FROM outbox')) return statement;
        return { get() { const row = statement.get(); won = winner.claimNext(); return row; } };
      }
    } as unknown as typeof db;
    const loser = new SqliteOutboxRepository(interleaved);
    expect(loser.claimNext()).toBeNull();
    expect(won).toMatchObject({ messageId: 'outbox:attempt-1', claimToken: expect.any(String) });
    expect(db.prepare("SELECT state FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'DISPATCHING' });
  } finally { db.close(); }
});

test('claim tokens fence acknowledgement and uncertain-result transitions', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    const outbox = new SqliteOutboxRepository(db);
    const claimed = outbox.claimNext();
    expect(claimed).not.toBeNull();
    const token = Reflect.get(claimed!, 'claimToken');
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    const acknowledge = Reflect.get(outbox, 'acknowledge');
    expect(acknowledge.call(outbox, claimed!.messageId, 'wrong-token')).toBe(false);
    expect(db.prepare("SELECT state FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'DISPATCHING' });
    const uncertain = Reflect.get(outbox, 'markUncertain');
    expect(typeof uncertain).toBe('function');
    expect(uncertain.call(outbox, claimed!.messageId, 'wrong-token')).toBe(false);
    expect(uncertain.call(outbox, claimed!.messageId, token)).toBe(true);
    expect(db.prepare("SELECT state FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'RECONCILING' });
    expect(db.prepare("SELECT state FROM execution_attempts WHERE attempt_id = 'attempt-1'").get()).toEqual({ state: 'UNKNOWN' });
    expect(acknowledge.call(outbox, claimed!.messageId, token)).toBe(false);
    expect(outbox.claimNext()).toBeNull();
  } finally { db.close(); }
});

test('restart recovery fences interrupted claims and never requeues them', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    const outbox = new SqliteOutboxRepository(db);
    const claimed = outbox.claimNext();
    expect(claimed).not.toBeNull();
    const token = Reflect.get(claimed!, 'claimToken');
    const recover = Reflect.get(outbox, 'recoverInterrupted');
    expect(typeof recover).toBe('function');
    expect(recover.call(outbox)).toBe(1);
    expect(db.prepare("SELECT state FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'RECONCILING' });
    expect(db.prepare("SELECT state FROM execution_attempts WHERE attempt_id = 'attempt-1'").get()).toEqual({ state: 'UNKNOWN' });
    expect(Reflect.get(outbox, 'acknowledge').call(outbox, claimed!.messageId, token)).toBe(false);
    expect(outbox.claimNext()).toBeNull();
  } finally { db.close(); }
});

test('a superseded token cannot acknowledge a newer claim', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    seedAuthorizedProposal(db);
    new SqliteExecutionRepository(db, () => '2026-08-13T00:00:00.000Z', () => 'owner-1').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: '2026-08-13T00:00:00.000Z' });
    const outbox = new SqliteOutboxRepository(db);
    const first = outbox.claimNext()!;
    // Simulate a separately authorized reconciliation; this test does not provide a requeue API.
    db.prepare("UPDATE outbox SET state = 'PENDING', claim_token = NULL WHERE message_id = ?").run(first.messageId);
    const second = outbox.claimNext()!;
    expect(second.claimToken).not.toBe(first.claimToken);
    expect(outbox.acknowledge(first.messageId, first.claimToken)).toBe(false);
    expect(outbox.markUncertain(first.messageId, first.claimToken)).toBe(false);
    expect(outbox.acknowledge(second.messageId, second.claimToken)).toBe(true);
  } finally { db.close(); }
});

test('migration quarantines a legacy in-flight claim for reconciliation', () => {
  const db = new Database(':memory:');
  try {
    db.pragma('foreign_keys = ON');
    applyMigrations(db, foundationMigrations.filter(migration => migration.version <= 18));
    seedAuthorizedProposal(db);
    db.prepare("INSERT INTO tasks VALUES ('task-1', 'workspace-1', 'project-1', 'proposal-1', 'grant-1', 'QUEUED', '2026-08-13T00:00:00.000Z')").run();
    db.prepare("INSERT INTO work_items VALUES ('work-1', 'task-1', 'agent-1', 'function-1', 'WAITING')").run();
    db.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-1', 'request-1', 'initial-key', 'DISPATCH_PENDING', 0, '2026-08-13T00:00:00.000Z')").run();
    db.prepare("INSERT INTO outbox VALUES ('outbox:attempt-1', 'attempt-1', 'request-1', 'initial-key', 'start', '{\"attempt_id\":\"attempt-1\"}', 'PENDING', '2026-08-13T00:00:00.000Z')").run();
    db.prepare("UPDATE outbox SET state = 'DISPATCHING' WHERE message_id = 'outbox:attempt-1'").run();
    applyMigrations(db);
    const outbox = new SqliteOutboxRepository(db);
    expect(outbox.recoverInterrupted()).toBe(1);
    expect(db.prepare("SELECT state, claim_token FROM outbox WHERE message_id = 'outbox:attempt-1'").get()).toEqual({ state: 'RECONCILING', claim_token: null });
    expect(db.prepare("SELECT state FROM execution_attempts WHERE attempt_id = 'attempt-1'").get()).toEqual({ state: 'UNKNOWN' });
    expect(outbox.claimNext()).toBeNull();
  } finally { db.close(); }
});
