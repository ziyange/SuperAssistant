import { expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { createProposalVersion } from '@super-assistant/domain';
import { SqliteOutboxRepository, SqliteProposalRepository, createFoundationDatabase } from '@super-assistant/persistence';
import * as recoveryService from '../../src/main/recovery-service.js';
import { reconcileAfterRestart } from '../../src/main/recovery-service.js';

test('keeps dispatch disabled when a restarted adapter has no durable attempt result', async () => {
  const recovery = await reconcileAfterRestart(
    [{ attemptId: 'attempt-1', state: 'UNKNOWN', lastSequence: 2 }],
    { status: async () => 'RUNNING', events: async () => 'AVAILABLE', result: async () => 'MISSING' }
  );

  expect(recovery).toEqual({ mode: 'DEGRADED_READ_ONLY', attempts: [{ attemptId: 'attempt-1', state: 'RECONCILING', dispatchAllowed: false, mode: 'READ_ONLY' }] });
});

test('reports normal read-only diagnostics after a durable terminal result', async () => {
  const recovery = await reconcileAfterRestart(
    [{ attemptId: 'attempt-1', state: 'RECONCILING', lastSequence: 2 }],
    { status: async () => 'UNAVAILABLE', events: async () => 'AVAILABLE', result: async () => 'CANCELLED' }
  );

  expect(recovery).toEqual({ mode: 'NORMAL', attempts: [{ attemptId: 'attempt-1', state: 'CANCELLED', dispatchAllowed: false, mode: 'READ_ONLY' }] });
});

const created = '2026-08-13T00:00:00.000Z';

function seedAttempt(db: Database.Database, workspace: string, id: string, attemptState: string, outboxState: string): void {
  const proposal = `proposal-${id}`;
  const grant = `grant-${id}`;
  const task = `task-${id}`;
  const work = `work-${id}`;
  const project = `project-${workspace}`;
  const agent = `agent-${workspace}`;
  const fn = `function-${workspace}`;
  const reviewed = createProposalVersion({
    proposalVersionId: proposal, workspaceId: workspace, projectId: project, agentId: agent, functionId: fn,
    objective: 'Fixture goal', actions: ['COMMAND'], projectSnapshotVersion: '1', agentVersion: '1', functionVersion: '1',
    capabilityVersion: '1', baselineCommit: '0'.repeat(40), expiresAt: '2026-08-14T00:00:00.000Z', createdAt: created
  });
  new SqliteProposalRepository(db).save(reviewed);
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    grant, proposal, reviewed.digest, workspace === 'local' ? 'local-owner' : 'other-owner', `grant-key-${id}`, '["COMMAND"]',
    'CONSUMED', created, '2026-08-14T00:00:00.000Z'
  );
  db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)').run(task, workspace, project, proposal, grant, 'QUEUED', created);
  db.prepare('INSERT INTO work_items VALUES (?, ?, ?, ?, ?)').run(work, task, agent, fn, 'WAITING');
  db.prepare('INSERT INTO execution_attempts VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, work, `request-${id}`, `attempt-key-${id}`, attemptState, 4, created);
  db.prepare('INSERT INTO outbox (message_id, attempt_id, request_id, idempotency_key, message_type, payload_json, state, created_at, claim_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    `message-${id}`, id, `request-${id}`, `outbox-key-${id}`, 'start', JSON.stringify({ attempt_id: id }), outboxState, created,
    outboxState === 'DISPATCHING' ? `old-token-${id}` : null
  );
  db.prepare('INSERT INTO resource_leases (lease_id, resource_key, attempt_id, fencing_token, state, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    `lease-${id}`, `project:${id}`, id, 1, 'ACTIVE', created
  );
}

test('desktop startup quarantines local interrupted work exactly once and keeps it out of the dispatcher', () => {
  const original = createFoundationDatabase(':memory:');
  let saved: ReturnType<Database.Database['serialize']>;
  try {
    const add = original.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)');
    add.run('local', 'local-owner', 'Local', 'ACTIVE', created, created, 1);
    add.run('foreign', 'other-owner', 'Foreign', 'ACTIVE', created, created, 1);
    for (const scope of ['local', 'foreign']) {
      original.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(`agent-${scope}`, scope, 'Codex', '1', 'UNAVAILABLE', 'PAUSED', null, 1);
      original.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        `project-${scope}`, scope, 'Fixture', `E:/${scope}`, `e:/${scope}`, 'ACTIVE', `agent-${scope}`, 1, created, created, 1
      );
      original.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run(`function-${scope}`, `agent-${scope}`, 'Fixture', '1', 'ACTIVE');
    }
    seedAttempt(original, 'local', 'claimed', 'DISPATCH_PENDING', 'DISPATCHING');
    seedAttempt(original, 'local', 'running', 'RUNNING', 'ACKNOWLEDGED');
    seedAttempt(original, 'local', 'pending', 'DISPATCH_PENDING', 'PENDING');
    seedAttempt(original, 'local', 'terminal', 'SUCCEEDED', 'DISPATCHING');
    seedAttempt(original, 'foreign', 'foreign', 'RUNNING', 'DISPATCHING');
    saved = original.serialize();
  } finally { original.close(); }

  const db = new Database(saved);
  try {
    const attempt = (id: string) => db.prepare('SELECT state, last_sequence FROM execution_attempts WHERE attempt_id = ?').get(id);
    const message = (id: string) => db.prepare('SELECT state, claim_token FROM outbox WHERE attempt_id = ?').get(id);
    const leases = db.prepare('SELECT * FROM resource_leases ORDER BY lease_id');
    const grants = db.prepare('SELECT * FROM authorization_grants ORDER BY grant_id');
    const before = { leases: leases.all(), grants: grants.all() };
    db.prepare("UPDATE workspaces SET status = 'LOCKED' WHERE workspace_id = 'local'").run();
    expect(recoveryService.recoverLocalStartup(db)).toEqual({ orphanedClaims: 0, inFlightAttempts: 0 });
    expect(message('claimed')).toEqual({ state: 'DISPATCHING', claim_token: 'old-token-claimed' });
    db.prepare("UPDATE workspaces SET status = 'ACTIVE', owner_id = 'local-owner'").run();
    expect(recoveryService.recoverLocalStartup(db)).toEqual({ orphanedClaims: 0, inFlightAttempts: 0 });
    expect(message('claimed')).toEqual({ state: 'DISPATCHING', claim_token: 'old-token-claimed' });
    db.prepare("UPDATE workspaces SET owner_id = 'other-owner' WHERE workspace_id = 'foreign'").run();

    expect(recoveryService.recoverLocalStartup(db)).toEqual({ orphanedClaims: 2, inFlightAttempts: 1 });
    expect(attempt('claimed')).toEqual({ state: 'UNKNOWN', last_sequence: 4 });
    expect(attempt('running')).toEqual({ state: 'UNKNOWN', last_sequence: 4 });
    expect(attempt('pending')).toEqual({ state: 'DISPATCH_PENDING', last_sequence: 4 });
    expect(attempt('terminal')).toEqual({ state: 'SUCCEEDED', last_sequence: 4 });
    expect(attempt('foreign')).toEqual({ state: 'RUNNING', last_sequence: 4 });
    expect(message('claimed')).toEqual({ state: 'RECONCILING', claim_token: null });
    expect(message('foreign')).toEqual({ state: 'DISPATCHING', claim_token: 'old-token-foreign' });
    expect(message('running')).toEqual({ state: 'ACKNOWLEDGED', claim_token: null });
    expect(recoveryService.recoverLocalStartup(db)).toEqual({ orphanedClaims: 0, inFlightAttempts: 0 });
    const outbox = new SqliteOutboxRepository(db);
    expect(outbox.acknowledge('message-claimed', 'old-token-claimed')).toBe(false);
    expect(outbox.claimNext()?.attemptId).toBe('pending');
    expect(outbox.claimNext()).toBeNull();
    expect(leases.all()).toEqual(before.leases);
    expect(grants.all()).toEqual(before.grants);
    expect(db.prepare('SELECT COUNT(*) AS count FROM execution_attempts').get()).toEqual({ count: 5 });
  } finally { db.close(); }
});
