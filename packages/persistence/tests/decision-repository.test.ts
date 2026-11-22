/* global URL */
import { expect, test } from 'vitest';
import { Worker } from 'node:worker_threads';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDecision, resolveDecision, createProposalVersion } from '@super-assistant/domain';
import { SqliteDecisionRepository } from '../src/repositories/decision-repository.js';
import { SqliteExecutionRepository } from '../src/repositories/execution-repository.js';
import { createFoundationDatabase } from '../src/sqlite/database.js';

const input = { decisionId: 'decision-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-item-1', question: 'Grant network access?', level: 'L3' as const, createdAt: '2026-08-21T00:00:00.000Z' };

function scopedDecisionFixture(path = ':memory:', owner = 'user-1', attemptId = 'attempt-1') {
  const db = createFoundationDatabase(path);
  const created = '2026-08-21T00:00:00.000Z', expiry = '2026-08-22T00:00:00.000Z';
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace-1', owner, 'Workspace', 'ACTIVE', created, created, 1);
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent-1', 'workspace-1', 'Codex', '1.0.0', 'CONNECTED', 'AVAILABLE', null, 1);
  db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project-1', 'workspace-1', 'Project', 'E:/fixture', 'e:/fixture', 'ACTIVE', 'agent-1', 1, created, created, 1);
  db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function-1', 'agent-1', 'implement', '1.0.0', 'ACTIVE');
  const proposal = createProposalVersion({ proposalVersionId: 'proposal-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', objective: 'Synthetic task', actions: ['COMMAND'], projectSnapshotVersion: '1', agentVersion: '1.0.0', functionVersion: '1.0.0', capabilityVersion: '1.0.0', baselineCommit: 'base', expiresAt: expiry, createdAt: created });
  db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(proposal.proposalVersionId, proposal.workspaceId, proposal.projectId, proposal.agentId, proposal.functionId, proposal.objective, JSON.stringify(proposal.actions), proposal.projectSnapshotVersion, proposal.agentVersion, proposal.functionVersion, proposal.capabilityVersion, proposal.baselineCommit, proposal.expiresAt, proposal.createdAt, proposal.digest);
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('grant-1', proposal.proposalVersionId, proposal.digest, owner, 'grant-key', JSON.stringify(proposal.actions), 'ISSUED', created, expiry);
  new SqliteExecutionRepository(db, () => created, () => owner).createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-item-1', attemptId, leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'execution-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: created });
  db.prepare("UPDATE execution_attempts SET state='WAITING_USER' WHERE attempt_id=?").run(attemptId);
  return db;
}

const validResolution = { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW' as const, resolvedAt: '2026-08-21T00:01:00.000Z' };

test('direct resolution cannot bypass the atomic resume transaction', () => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); const decision = createDecision(input); repo.create(decision);
    expect(() => repo.resolve(resolveDecision(decision, validResolution))).toThrow();
    expect(repo.get(input.decisionId)?.status).toBe('OPEN');
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(0);
  } finally { db.close(); }
});

test.each([{ workspaceId: 'other' }, { projectId: 'other' }, { taskId: 'other' }])('rejects a Decision outside the Attempt scope %#', changed => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision({ ...input, ...changed }));
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow();
    expect(repo.get(input.decisionId)?.status).toBe('OPEN');
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(0);
  } finally { db.close(); }
});

test('rejects a non-owner before resolving a local Decision', () => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, { ...validResolution, actorId: 'attacker' })).toThrow();
    expect(repo.get(input.decisionId)?.status).toBe('OPEN');
  } finally { db.close(); }
});

test('does not trust a caller-supplied owner identity without an authenticated principal', () => {
  const db = scopedDecisionFixture(':memory:', 'local-owner');
  try {
    const repo = new SqliteDecisionRepository(db); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, { ...validResolution, actorId: 'local-owner' })).toThrow();
    expect(repo.get(input.decisionId)?.status).toBe('OPEN');
  } finally { db.close(); }
});

test.each(['', 'x'.repeat(129), ' whitespace '])('rejects an invalid historical Attempt identifier %#', attemptId => {
  const db = scopedDecisionFixture(':memory:', 'user-1', attemptId);
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow();
    expect(repo.get(input.decisionId)?.status).toBe('OPEN');
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(0);
  } finally { db.close(); }
});

test('does not resolve against a cancelled Task with a stale waiting Attempt', () => {
  const db = scopedDecisionFixture();
  try {
    db.prepare("UPDATE tasks SET state='CANCELLED' WHERE task_id='task-1'").run();
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow();
    expect(repo.get(input.decisionId)?.status).toBe('OPEN');
  } finally { db.close(); }
});

test.each([{ resolutionId: '' }, { resolutionId: 'x'.repeat(129) }, { idempotencyKey: ' ' }, { actorId: '' }, { resolvedAt: 'bad-time' }])('rejects malformed resolution fields before changing SQLite %#', change => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, { ...validResolution, ...change })).toThrow();
    expect(repo.get(input.decisionId)?.status).toBe('OPEN');
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(0);
  } finally { db.close(); }
});

test('a resolved historical Decision without its original resume is not reported as a successful retry', () => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    repo.resolveAndEnqueueResume(input.decisionId, validResolution);
    db.prepare("DELETE FROM outbox WHERE message_id='resume:decision-1'").run();
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow();
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(0);
  } finally { db.close(); }
});

test.each([
  ['payload decision', '{"attempt_id":"attempt-1","decision_id":"other","resolution_id":"resolution-1"}'],
  ['payload resolution', '{"attempt_id":"attempt-1","decision_id":"decision-1","resolution_id":"other"}'],
  ['payload extra field', '{"attempt_id":"attempt-1","decision_id":"decision-1","resolution_id":"resolution-1","extra":true}'],
  ['malformed payload', '{']
])('rejects a duplicate when its durable resume evidence has %s', (_label, payload) => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    repo.resolveAndEnqueueResume(input.decisionId, validResolution);
    db.prepare("UPDATE outbox SET payload_json=? WHERE message_id='resume:decision-1'").run(payload);
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow('DECISION_EVIDENCE_MISSING');
    expect(db.prepare("SELECT payload_json FROM outbox WHERE message_id='resume:decision-1'").pluck().get()).toBe(payload);
  } finally { db.close(); }
});

test('a duplicate resolution rejects additional ambiguous resume evidence', () => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    repo.resolveAndEnqueueResume(input.decisionId, validResolution);
    db.prepare("INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES ('duplicate','attempt-1','request-1','other-key','resume',?,'PENDING',?)")
      .run('{"attempt_id":"attempt-1","decision_id":"decision-1","resolution_id":"resolution-1"}', validResolution.resolvedAt);
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow('DECISION_EVIDENCE_MISSING');
  } finally { db.close(); }
});

test('does not resolve an open Decision with a preexisting conflicting resume', () => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    db.prepare("INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES ('other','attempt-1','request-1','other-key','resume',?,'PENDING',?)")
      .run('{"attempt_id":"attempt-1","decision_id":"decision-1","resolution_id":"other"}', validResolution.resolvedAt);
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow();
    expect(repo.get(input.decisionId)?.status).toBe('OPEN');
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(1);
  } finally { db.close(); }
});

test('a duplicate rejects conflicting Decision evidence on another Attempt of the same WorkItem', () => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    repo.resolveAndEnqueueResume(input.decisionId, validResolution);
    db.prepare("INSERT INTO execution_attempts VALUES ('other', 'work-item-1', 'req2', 'key2', 'FAILED', 0, '2026-08-21T00:00:00.000Z')").run();
    db.prepare("INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES ('duplicate','other','req2','other-key','resume',?,'PENDING',?)")
      .run('{"attempt_id":"other","decision_id":"decision-1","resolution_id":"other"}', validResolution.resolvedAt);
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow('DECISION_EVIDENCE_MISSING');
  } finally { db.close(); }
});

test.each([
  '{"decision_id":"other"}',
  '{"attempt_id":"wrong","decision_id":"other","resolution_id":"res"}',
  '{"attempt_id":"attempt-1","decision_id":"other","resolution_id":"res","extra":true}'
])('rejects malformed resume evidence belonging to another Decision %#', payload => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    db.prepare("INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES ('other','attempt-1','request-1','other-key','resume',?,'PENDING',?)").run(payload, validResolution.resolvedAt);
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow('DECISION_EVIDENCE_MISSING');
    expect(repo.get(input.decisionId)?.status).toBe('OPEN');
  } finally { db.close(); }
});

test.each(['', 'x'.repeat(129)])('rejects a historical resolved Decision with an invalid stored resolution ID %#', storedId => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    db.prepare("UPDATE decisions SET status='RESOLVED',resolution_id=?,resolution_key='resolve-key-1',resolution_actor_id='user-1',resolution_option='ALLOW',resolved_at=? WHERE decision_id='decision-1'").run(storedId, validResolution.resolvedAt);
    db.prepare("INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES ('resume:decision-1','attempt-1','request-1','resolve-key-1','resume',?,'PENDING',?)")
      .run(JSON.stringify({ attempt_id: 'attempt-1', decision_id: 'decision-1', resolution_id: storedId }), validResolution.resolvedAt);
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow('DECISION_EVIDENCE_MISSING');
  } finally { db.close(); }
});

test('allows a distinct, fully linked historical Decision on the same WorkItem', () => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1');
    repo.create(createDecision(input));
    repo.create(createDecision({ ...input, decisionId: 'other-decision', question: 'Other approved question?' }));
    db.prepare("UPDATE decisions SET status='RESOLVED',resolution_id='other-res',resolution_key='other-key',resolution_actor_id='user-1',resolution_option='DENY',resolved_at=? WHERE decision_id='other-decision'").run(validResolution.resolvedAt);
    db.prepare("INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES ('resume:other-decision','attempt-1','request-1','other-key','resume',?,'ACKNOWLEDGED',?)")
      .run('{"attempt_id":"attempt-1","decision_id":"other-decision","resolution_id":"other-res"}', validResolution.resolvedAt);
    expect(repo.resolveAndEnqueueResume(input.decisionId, validResolution).resumeEnqueued).toBe(true);
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(2);
  } finally { db.close(); }
});

test.each([{ actor: '', time: '2026-08-21T00:01:00.000Z' }, { actor: 'user-1', time: 'invalid' }])('rejects malformed fields on another linked historical Decision %#', history => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1');
    repo.create(createDecision(input));
    repo.create(createDecision({ ...input, decisionId: 'other-decision', question: 'Other question?' }));
    db.prepare("UPDATE decisions SET status='RESOLVED',resolution_id='other-res',resolution_key='other-key',resolution_actor_id=?,resolution_option='DENY',resolved_at=? WHERE decision_id='other-decision'").run(history.actor, history.time);
    db.prepare("INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES ('resume:other-decision','attempt-1','request-1','other-key','resume',?,'ACKNOWLEDGED',?)")
      .run('{"attempt_id":"attempt-1","decision_id":"other-decision","resolution_id":"other-res"}', validResolution.resolvedAt);
    expect(() => repo.resolveAndEnqueueResume(input.decisionId, validResolution)).toThrow('DECISION_EVIDENCE_MISSING');
    expect(repo.get(input.decisionId)?.status).toBe('OPEN');
  } finally { db.close(); }
});

test('stores one open Decision for the same fingerprint and persists its resolution', () => {
  const database = createFoundationDatabase(':memory:');
  const decisions = new SqliteDecisionRepository(database, () => 'user-1');
  const first = createDecision(input);
  decisions.create(first);
  expect(decisions.findOpenByFingerprint(first.fingerprint)).toEqual(first);
  expect(decisions.listForTask('task-1')).toEqual([first]);
  expect(() => decisions.create(createDecision({ ...input, decisionId: 'decision-2', question: ' grant network access? ' }))).toThrow(/UNIQUE/i);
  const resolved = resolveDecision(first, { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' });
  expect(() => decisions.resolve(resolved)).toThrow('ATOMIC_DECISION_RESOLUTION_REQUIRED');
  expect(decisions.get('decision-1')).toEqual(first);
  database.close();
});

test('atomically records the first resolution and emits one resume command', () => {
  const database = scopedDecisionFixture();
  const decisions = new SqliteDecisionRepository(database, () => 'user-1');
  const first = createDecision(input);
  decisions.create(first);
  const resolution = { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW' as const, resolvedAt: '2026-08-21T00:01:00.000Z' };

  expect(decisions.resolveAndEnqueueResume(first.decisionId, resolution)).toEqual({ decision: resolveDecision(first, resolution), resumeEnqueued: true });
  expect(decisions.resolveAndEnqueueResume(first.decisionId, resolution)).toEqual({ decision: resolveDecision(first, resolution), resumeEnqueued: false });
  expect(database.prepare("SELECT message_type, payload_json FROM outbox WHERE attempt_id = 'attempt-1' AND message_type='resume'").all()).toEqual([{ message_type: 'resume', payload_json: '{"attempt_id":"attempt-1","decision_id":"decision-1","resolution_id":"resolution-1"}' }]);
  database.close();
});

test.each(['UNKNOWN', 'RECONCILING'])('refuses an ambiguous %s Attempt without resolving the Decision', (state) => {
  const database = scopedDecisionFixture();
  database.prepare("UPDATE execution_attempts SET state=? WHERE attempt_id='attempt-1'").run(state);
  const decisions = new SqliteDecisionRepository(database, () => 'user-1'); decisions.create(createDecision(input));
  expect(() => decisions.resolveAndEnqueueResume('decision-1', { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' })).toThrow('ATTEMPT_RECONCILIATION_REQUIRED');
  expect(decisions.get('decision-1')?.status).toBe('OPEN'); database.close();
});

test('rejects conflicting duplicate resolution without changing its existing outbox', () => {
  const db = scopedDecisionFixture();
  try {
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    const resolution = { resolutionId: 'resolution-1', idempotencyKey: 'key-1', actorId: 'user-1', option: 'ALLOW' as const, resolvedAt: '2026-08-21T00:01:00.000Z' };
    repo.resolveAndEnqueueResume('decision-1', resolution);
    expect(() => repo.resolveAndEnqueueResume('decision-1', { ...resolution, option: 'DENY' })).toThrow('IDEMPOTENCY_CONFLICT');
    expect(() => repo.resolveAndEnqueueResume('decision-1', { ...resolution, actorId: 'other' })).toThrow();
    expect(repo.get('decision-1')?.resolution?.option).toBe('ALLOW');
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(1);
  } finally { db.close(); }
});

test.each(['RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'])('does not resolve or enqueue against a non-waiting %s Attempt', state => {
  const db = scopedDecisionFixture();
  try {
    db.prepare("UPDATE execution_attempts SET state=? WHERE attempt_id='attempt-1'").run(state);
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume('decision-1', { resolutionId: 'res', idempotencyKey: 'key', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' })).toThrow();
    expect(repo.get('decision-1')?.status).toBe('OPEN');
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(0);
  } finally { db.close(); }
});

test('does not guess the originating Attempt from timestamps when multiple Attempts exist', () => {
  const db = scopedDecisionFixture();
  try {
    db.prepare("UPDATE execution_attempts SET state='FAILED' WHERE attempt_id='attempt-1'").run();
    db.prepare("INSERT INTO execution_attempts VALUES ('new', 'work-item-1', 'req2', 'key2', 'WAITING_USER', 0, '2026-08-21T00:00:00.000Z')").run();
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume('decision-1', { resolutionId: 'res', idempotencyKey: 'resolve', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' })).toThrow();
    expect(repo.get('decision-1')?.status).toBe('OPEN');
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(0);
  } finally { db.close(); }
});

test('rolls back the Decision when a conflicting resume outbox key already exists', () => {
  const db = scopedDecisionFixture();
  try {
    db.prepare("INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES ('other','attempt-1','request-1','resolve','resume','{}','PENDING','2026-08-21T00:00:00.000Z')").run();
    const repo = new SqliteDecisionRepository(db, () => 'user-1'); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume('decision-1', { resolutionId: 'res', idempotencyKey: 'resolve', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' })).toThrow();
    expect(repo.get('decision-1')?.status).toBe('OPEN');
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(1);
  } finally { db.close(); }
});

test('concurrent conflicting resolutions on independent SQLite connections produce one decision and one outbox', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-decision-race-'));
  const file = join(dir, 'control.sqlite');
  const db = scopedDecisionFixture(file);
  try {
    new SqliteDecisionRepository(db, () => 'user-1').create(createDecision(input));
    const gate = new SharedArrayBuffer(4);
    const moduleFile = fileURLToPath(new URL('../dist/repositories/decision-repository.js', import.meta.url));
    const script = `
      const { parentPort, workerData } = require('node:worker_threads');
      const { pathToFileURL } = require('node:url');
      const Database = require('better-sqlite3');
      (async () => {
        const { SqliteDecisionRepository } = await import(pathToFileURL(workerData.moduleFile).href);
        const db = new Database(workerData.file);
        db.pragma('foreign_keys = ON'); db.pragma('busy_timeout = 5000');
        const gate = new Int32Array(workerData.gate);
        if (Atomics.add(gate, 0, 1) === 0) Atomics.wait(gate, 0, 1, 5000);
        else Atomics.notify(gate, 0, 1);
        try {
          new SqliteDecisionRepository(db, () => 'user-1').resolveAndEnqueueResume('decision-1', {
            resolutionId: 'res-' + workerData.option, idempotencyKey: 'same-key', actorId: 'user-1',
            option: workerData.option, resolvedAt: '2026-08-21T00:01:00.000Z'
          });
          parentPort.postMessage('accepted');
        } catch (error) { parentPort.postMessage(error.message); }
        finally { db.close(); }
      })().catch(error => { throw error; });
    `;
    const run = (actor: string, option: string) => new Promise<string>((resolve, reject) => {
      const worker = new Worker(script, { eval: true, workerData: { moduleFile, file, gate, actor, option } });
      worker.once('message', resolve); worker.once('error', reject);
    });
    const result = await Promise.all([run('alice', 'ALLOW'), run('bob', 'DENY')]);
    expect(result.slice().sort()).toEqual(['IDEMPOTENCY_CONFLICT', 'accepted']);
    expect(db.prepare("SELECT count(*) FROM outbox WHERE message_type='resume'").pluck().get()).toBe(1);
    const stored = new SqliteDecisionRepository(db, () => 'user-1').get('decision-1');
    expect(stored?.status).toBe('RESOLVED');
    expect(['user-1:ALLOW', 'user-1:DENY']).toContain(stored?.resolution?.actorId + ':' + stored?.resolution?.option);
  } finally { db.close(); rmSync(dir, { recursive: true }); }
}, 15000);
