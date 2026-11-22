/* global URL */
import { expect, test } from 'vitest';
import { Worker } from 'node:worker_threads';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDecision, resolveDecision } from '@super-assistant/domain';
import { SqliteDecisionRepository } from '../src/repositories/decision-repository.js';
import { createFoundationDatabase } from '../src/sqlite/database.js';

const input = { decisionId: 'decision-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-item-1', question: 'Grant network access?', level: 'L3' as const, createdAt: '2026-08-21T00:00:00.000Z' };

test('stores one open Decision for the same fingerprint and persists its resolution', () => {
  const database = createFoundationDatabase(':memory:');
  const decisions = new SqliteDecisionRepository(database);
  const first = createDecision(input);
  decisions.create(first);
  expect(decisions.findOpenByFingerprint(first.fingerprint)).toEqual(first);
  expect(decisions.listForTask('task-1')).toEqual([first]);
  expect(() => decisions.create(createDecision({ ...input, decisionId: 'decision-2', question: ' grant network access? ' }))).toThrow(/UNIQUE/i);
  const resolved = resolveDecision(first, { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' });
  decisions.resolve(resolved);
  expect(decisions.get('decision-1')).toEqual(resolved);
  database.close();
});

test('atomically records the first resolution and emits one resume command', () => {
  const database = createFoundationDatabase(':memory:');
  database.prepare('PRAGMA foreign_keys = OFF').run();
  database.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-item-1', 'request-1', 'attempt-key-1', 'WAITING_USER', 0, '2026-08-21T00:00:00.000Z')").run();
  database.prepare('PRAGMA foreign_keys = ON').run();
  const decisions = new SqliteDecisionRepository(database);
  const first = createDecision(input);
  decisions.create(first);
  const resolution = { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW' as const, resolvedAt: '2026-08-21T00:01:00.000Z' };

  expect(decisions.resolveAndEnqueueResume(first.decisionId, resolution)).toEqual({ decision: resolveDecision(first, resolution), resumeEnqueued: true });
  expect(decisions.resolveAndEnqueueResume(first.decisionId, resolution)).toEqual({ decision: resolveDecision(first, resolution), resumeEnqueued: false });
  expect(database.prepare("SELECT message_type, payload_json FROM outbox WHERE attempt_id = 'attempt-1'").all()).toEqual([{ message_type: 'resume', payload_json: '{"attempt_id":"attempt-1","decision_id":"decision-1","resolution_id":"resolution-1"}' }]);
  database.close();
});

test.each(['UNKNOWN', 'RECONCILING'])('refuses an ambiguous %s Attempt without resolving the Decision', (state) => {
  const database = createFoundationDatabase(':memory:');
  database.prepare('PRAGMA foreign_keys = OFF').run();
  database.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-item-1', 'request-1', 'attempt-key-1', ?, 0, '2026-08-21T00:00:00.000Z')").run(state);
  database.prepare('PRAGMA foreign_keys = ON').run();
  const decisions = new SqliteDecisionRepository(database); decisions.create(createDecision(input));
  expect(() => decisions.resolveAndEnqueueResume('decision-1', { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' })).toThrow('ATTEMPT_RECONCILIATION_REQUIRED');
  expect(decisions.get('decision-1')?.status).toBe('OPEN'); database.close();
});

test('rejects conflicting duplicate resolution without changing its existing outbox', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-item-1', 'req', 'attempt-key', 'WAITING_USER', 0, '2026-08-21T00:00:00.000Z')").run();
    db.pragma('foreign_keys = ON');
    const repo = new SqliteDecisionRepository(db); repo.create(createDecision(input));
    const resolution = { resolutionId: 'resolution-1', idempotencyKey: 'key-1', actorId: 'owner', option: 'ALLOW' as const, resolvedAt: '2026-08-21T00:01:00.000Z' };
    repo.resolveAndEnqueueResume('decision-1', resolution);
    expect(() => repo.resolveAndEnqueueResume('decision-1', { ...resolution, option: 'DENY' })).toThrow('IDEMPOTENCY_CONFLICT');
    expect(() => repo.resolveAndEnqueueResume('decision-1', { ...resolution, actorId: 'other' })).toThrow('IDEMPOTENCY_CONFLICT');
    expect(repo.get('decision-1')?.resolution?.option).toBe('ALLOW');
    expect(db.prepare('SELECT count(*) FROM outbox').pluck().get()).toBe(1);
  } finally { db.close(); }
});

test.each(['RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'])('does not resolve or enqueue against a non-waiting %s Attempt', state => {
  const db = createFoundationDatabase(':memory:');
  try {
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-item-1', 'req', 'attempt-key', ?, 0, '2026-08-21T00:00:00.000Z')").run(state);
    db.pragma('foreign_keys = ON');
    const repo = new SqliteDecisionRepository(db); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume('decision-1', { resolutionId: 'res', idempotencyKey: 'key', actorId: 'owner', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' })).toThrow();
    expect(repo.get('decision-1')?.status).toBe('OPEN');
    expect(db.prepare('SELECT count(*) FROM outbox').pluck().get()).toBe(0);
  } finally { db.close(); }
});

test('does not guess the originating Attempt from timestamps when multiple Attempts exist', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    db.pragma('foreign_keys = OFF');
    const add = db.prepare("INSERT INTO execution_attempts VALUES (?, 'work-item-1', ?, ?, ?, 0, ?)");
    add.run('old', 'req1', 'key1', 'FAILED', '2026-08-20T00:00:00.000Z');
    add.run('new', 'req2', 'key2', 'WAITING_USER', '2026-08-21T00:00:00.000Z');
    db.pragma('foreign_keys = ON');
    const repo = new SqliteDecisionRepository(db); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume('decision-1', { resolutionId: 'res', idempotencyKey: 'resolve', actorId: 'owner', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' })).toThrow();
    expect(repo.get('decision-1')?.status).toBe('OPEN');
    expect(db.prepare('SELECT count(*) FROM outbox').pluck().get()).toBe(0);
  } finally { db.close(); }
});

test('rolls back the Decision when a conflicting resume outbox key already exists', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-item-1', 'req', 'attempt-key', 'WAITING_USER', 0, '2026-08-21T00:00:00.000Z')").run();
    db.prepare("INSERT INTO outbox (message_id,attempt_id,request_id,idempotency_key,message_type,payload_json,state,created_at) VALUES ('other','attempt-1','req','resolve','resume','{}','PENDING','2026-08-21T00:00:00.000Z')").run();
    db.pragma('foreign_keys = ON');
    const repo = new SqliteDecisionRepository(db); repo.create(createDecision(input));
    expect(() => repo.resolveAndEnqueueResume('decision-1', { resolutionId: 'res', idempotencyKey: 'resolve', actorId: 'owner', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' })).toThrow();
    expect(repo.get('decision-1')?.status).toBe('OPEN');
    expect(db.prepare('SELECT count(*) FROM outbox').pluck().get()).toBe(1);
  } finally { db.close(); }
});

test('concurrent conflicting resolutions on independent SQLite connections produce one decision and one outbox', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sa-decision-race-'));
  const file = join(dir, 'control.sqlite');
  const db = createFoundationDatabase(file);
  try {
    db.pragma('foreign_keys = OFF');
    db.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-item-1', 'req', 'attempt-key', 'WAITING_USER', 0, '2026-08-21T00:00:00.000Z')").run();
    db.pragma('foreign_keys = ON');
    new SqliteDecisionRepository(db).create(createDecision(input));
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
          new SqliteDecisionRepository(db).resolveAndEnqueueResume('decision-1', {
            resolutionId: 'res-' + workerData.actor, idempotencyKey: 'same-key', actorId: workerData.actor,
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
    expect(db.prepare('SELECT count(*) FROM outbox').pluck().get()).toBe(1);
    const stored = new SqliteDecisionRepository(db).get('decision-1');
    expect(stored?.status).toBe('RESOLVED');
    expect(['alice:ALLOW', 'bob:DENY']).toContain(stored?.resolution?.actorId + ':' + stored?.resolution?.option);
  } finally { db.close(); rmSync(dir, { recursive: true }); }
}, 15000);
