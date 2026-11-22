import { Buffer } from 'node:buffer';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { Worker } from 'node:worker_threads';
import Database from 'better-sqlite3';
import { expect, test } from 'vitest';
import { applyMigrations } from '../../../../packages/persistence/src/sqlite/migration-runner.js';
import { createFoundationDatabase } from '../../../../packages/persistence/src/sqlite/database.js';
import { ProtectedKeyReservations } from '../../src/main/protected-key-reservations.js';

const scope = { workspaceId: 'w', projectId: 'p', recordId: 'r' };
function setup(db: Database.Database): void {
  applyMigrations(db);
  db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO projects VALUES ('p','w','P','E:/fixture','e:/fixture','ACTIVE',NULL,1,'2026','2026',1)").run();
}
function insertPayload(db: Database.Database, keyRef: string): void {
  db.prepare(`INSERT INTO protected_payloads VALUES ('r','w','p','GOAL',1,?,?,?,?,?)`)
    .run(keyRef, Buffer.alloc(12), Buffer.from([1]), Buffer.alloc(16), '2026-01-01T00:00:00.000Z');
}
test('reserves once across connections and persists only a token digest', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-reservation-'));
  const path = join(folder, 'journal.sqlite');
  const db = createFoundationDatabase(path); let second: Database.Database | undefined;
  try {
    setup(db);
    const first = new ProtectedKeyReservations(db);
    const result = first.reserve(scope);
    second = new Database(path);
    const competitor = new ProtectedKeyReservations(second);
    expect(() => competitor.reserve(scope)).toThrow();
    expect(competitor.inspect(scope)).toBe('RESERVED');
    expect(db.serialize().includes(Buffer.from(result.ownerToken))).toBe(false);
    expect(db.prepare('SELECT count(*) AS n FROM protected_key_reservations').get()).toEqual({ n: 1 });
  } finally { second?.close(); db.close(); rmSync(folder, { recursive: true, force: true }); }
});
test('two simultaneous worker connections cannot reserve the same record twice', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-reservation-race-'));
  const path = join(folder, 'journal.sqlite');
  const initial = createFoundationDatabase(path);
  setup(initial); initial.close();
  const gate = new SharedArrayBuffer(4);
  const moduleUrl = pathToFileURL(join(process.cwd(), 'apps/desktop/dist/main/protected-key-reservations.js')).href;
  const code = `
    const { parentPort, workerData } = require('node:worker_threads');
    const Database = require('better-sqlite3');
    (async () => {
      const { ProtectedKeyReservations } = await import(workerData.moduleUrl);
      const db = new Database(workerData.path);
      db.pragma('busy_timeout=5000');
      const gate = new Int32Array(workerData.gate);
      if (Atomics.add(gate, 0, 1) === 0) Atomics.wait(gate, 0, 1, 5000);
      else Atomics.notify(gate, 0, 1);
      let result;
      try { new ProtectedKeyReservations(db).reserve({ workspaceId: 'w', projectId: 'p', recordId: 'r' }); result = 'reserved'; }
      catch { result = 'rejected'; }
      finally { db.close(); }
      parentPort.postMessage(result);
    })().catch(error => { throw error; });
  `;
  const run = () => new Promise<string>((resolve, reject) => {
    const worker = new Worker(code, { eval: true, workerData: { path, gate, moduleUrl } });
    worker.once('message', resolve); worker.once('error', reject);
  });
  try {
    expect((await Promise.all([run(), run()])).sort()).toEqual(['rejected', 'reserved']);
    const check = new Database(path, { readonly: true });
    try { expect(check.prepare('SELECT count(*) AS n FROM protected_key_reservations').get()).toEqual({ n: 1 }); }
    finally { check.close(); }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
test('wrong owner and revoked local authority cannot advance state', () => {
  const db = new Database(':memory:');
  try {
    setup(db); const journal = new ProtectedKeyReservations(db); const item = journal.reserve(scope);
    expect(() => journal.confirmStored(scope, 'a'.repeat(64))).toThrow();
    expect(journal.inspect(scope)).toBe('RESERVED');
    db.prepare("UPDATE workspaces SET status='LOCKED' WHERE workspace_id='w'").run();
    expect(() => journal.confirmStored(scope, item.ownerToken)).toThrow();
    expect(() => journal.inspect(scope)).toThrow();
  } finally { db.close(); }
});
test('unknown key write survives restart and is never retried automatically', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-reservation-')); const path = join(folder, 'journal.sqlite');
  let db = createFoundationDatabase(path);
  try {
    setup(db); const journal = new ProtectedKeyReservations(db); const item = journal.reserve(scope);
    journal.markUncertain(scope, item.ownerToken);
    db.close(); db = new Database(path);
    const reopened = new ProtectedKeyReservations(db);
    expect(reopened.inspect(scope)).toBe('UNCERTAIN');
    expect(() => reopened.reserve(scope)).toThrow();
    expect(() => reopened.confirmStored(scope, item.ownerToken)).toThrow();
  } finally { db.close(); rmSync(folder, { recursive: true, force: true }); }
});
test('cannot link until the exact durable payload exists', () => {
  const db = new Database(':memory:');
  try {
    setup(db); const journal = new ProtectedKeyReservations(db); const item = journal.reserve(scope);
    journal.confirmStored(scope, item.ownerToken);
    expect(() => journal.markLinked(scope, item.ownerToken)).toThrow();
    insertPayload(db, item.keyRef);
    expect(journal.inspect(scope)).toBe('PAYLOAD_PRESENT_UNCONFIRMED');
    journal.markLinked(scope, item.ownerToken);
    expect(journal.inspect(scope)).toBe('LINKED');
    const linked = db.prepare('SELECT updated_at FROM protected_key_reservations').get();
    journal.markLinked(scope, item.ownerToken);
    expect(db.prepare('SELECT updated_at FROM protected_key_reservations').get()).toEqual(linked);
    expect(() => journal.markLinked(scope, 'a'.repeat(64))).toThrow();
    expect(() => journal.markUncertain(scope, item.ownerToken)).toThrow();
  } finally { db.close(); }
});
test('detects conflicting durable payload and refuses linkage', () => {
  const db = new Database(':memory:');
  try {
    setup(db); const journal = new ProtectedKeyReservations(db); const item = journal.reserve(scope);
    journal.confirmStored(scope, item.ownerToken);
    insertPayload(db, 'pkey-' + 'a'.repeat(64));
    expect(journal.inspect(scope)).toBe('CONFLICT');
    expect(() => journal.markLinked(scope, item.ownerToken)).toThrow();
  } finally { db.close(); }
});
test('rejects malformed scope and malformed owner tokens', () => {
  const db = new Database(':memory:');
  try {
    setup(db); const journal = new ProtectedKeyReservations(db);
    expect(() => journal.reserve({ ...scope, recordId: '../x' })).toThrow();
    const item = journal.reserve(scope);
    expect(() => journal.confirmStored(scope, item.ownerToken + 'x')).toThrow();
    expect(journal.inspect(scope)).toBe('RESERVED');
  } finally { db.close(); }
});
