import { describe, expect, test } from 'vitest';
import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { applyMigrations } from '../../../../packages/persistence/src/sqlite/migration-runner.js';
import { createFoundationDatabase } from '../../../../packages/persistence/src/sqlite/database.js';
import { ProtectedPayloadStore, type ProtectedKeyProvider } from '../../src/main/protected-payload-store.js';

class TestKeys implements ProtectedKeyProvider {
  keys = new Map<string, Buffer>();
  reads = 0;
  async create(): Promise<{ keyRef: string; key: Buffer }> {
    const keyRef = 'pkey-' + randomBytes(32).toString('hex');
    const key = randomBytes(32);
    this.keys.set(keyRef, Buffer.from(key));
    return { keyRef, key };
  }
  async read(ref: string): Promise<Buffer | null> {
    this.reads++;
    const key = this.keys.get(ref);
    return key ? Buffer.from(key) : null;
  }
}
function fixture() {
  const db = new Database(':memory:');
  applyMigrations(db);
  db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO projects VALUES ('p','w','Project','E:/fixture','e:/fixture','ACTIVE',NULL,1,'2026','2026',1)").run();
  const keys = new TestKeys();
  return { db, keys, store: new ProtectedPayloadStore(db, keys) };
}
const scope = { workspaceId: 'w', projectId: 'p', recordId: 'record-1', kind: 'GOAL' as const };
describe('authenticated protected payloads', () => {
  test('reopens an on-disk SQLite database without persisting plaintext or key bytes', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'sa-protected-payload-'));
    const path = join(folder, 'test.sqlite');
    const keys = new TestKeys();
    let db: Database.Database | undefined;
    try {
      db = createFoundationDatabase(path);
      applyMigrations(db);
      db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1)").run();
      db.prepare("INSERT INTO projects VALUES ('p','w','Project','E:/fixture','e:/fixture','ACTIVE',NULL,1,'2026','2026',1)").run();
      const text = 'unique disposable on-disk fixture content';
      await new ProtectedPayloadStore(db, keys).create(scope, text);
      db.close(); db = undefined;
      const bytes = readFileSync(path);
      expect(bytes.includes(Buffer.from(text))).toBe(false);
      expect(bytes.includes([...keys.keys.values()][0]!)).toBe(false);
      db = new Database(path);
      expect(await new ProtectedPayloadStore(db, keys).read(scope)).toBe(text);
    } finally {
      db?.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });
  test('round trips after reopen and stores no plaintext or key bytes', async () => {
    const { db, keys, store } = fixture();
    const secret = 'unique synthetic business goal 42';
    await store.create(scope, secret);
    const bytes = db.serialize();
    const key = [...keys.keys.values()][0]!;
    expect(bytes.includes(Buffer.from(secret))).toBe(false);
    expect(bytes.includes(key)).toBe(false);
    const reopened = new Database(bytes);
    expect(await new ProtectedPayloadStore(reopened, keys).read(scope)).toBe(secret);
    reopened.close(); db.close();
  });
  test('rejects duplicate and replacement and never changes immutable rows', async () => {
    const { db, store } = fixture();
    await store.create(scope, 'original');
    await expect(store.create(scope, 'replacement')).rejects.toThrow();
    expect(() => db.prepare("UPDATE protected_payloads SET created_at='x'").run()).toThrow();
    expect(() => db.prepare('DELETE FROM protected_payloads').run()).toThrow();
    expect(() => db.exec('INSERT OR REPLACE INTO protected_payloads SELECT * FROM protected_payloads')).toThrow();
    expect(await store.read(scope)).toBe('original');
    db.close();
  });
  test.each(['ciphertext', 'auth_tag', 'nonce', 'created_at'] as const)('rejects tampering with %s', async (column) => {
    const { db, store } = fixture();
    await store.create(scope, 'sensitive');
    db.exec('DROP TRIGGER protected_payloads_no_update');
    if (column === 'created_at') db.prepare("UPDATE protected_payloads SET created_at='2026-01-01T00:00:00.000Z'").run();
    else {
      const row = db.prepare(`SELECT ${column} AS value FROM protected_payloads`).get() as { value: Buffer };
      const value = Buffer.from(row.value); value[0] = value[0]! ^ 1;
      db.prepare(`UPDATE protected_payloads SET ${column}=?`).run(value);
    }
    await expect(store.read(scope)).rejects.toThrow();
    db.close();
  });
  test('checks scope before vault access, and fails closed for missing or wrong keys', async () => {
    const { db, keys, store } = fixture();
    await store.create(scope, 'sensitive');
    keys.reads = 0;
    await expect(store.read({ ...scope, workspaceId: 'other' })).rejects.toThrow();
    expect(keys.reads).toBe(0);
    const ref = [...keys.keys.keys()][0]!;
    keys.keys.delete(ref);
    await expect(store.read(scope)).rejects.toThrow();
    keys.keys.set(ref, randomBytes(32));
    await expect(store.read(scope)).rejects.toThrow();
    db.close();
  });
  test('rejects malformed metadata and oversized or empty plaintext before creating keys', async () => {
    const { db, keys, store } = fixture();
    await expect(store.create({ ...scope, recordId: '../unsafe' }, 'text')).rejects.toThrow();
    await expect(store.create(scope, '')).rejects.toThrow();
    await expect(store.create(scope, 'x'.repeat(65537))).rejects.toThrow();
    expect(keys.keys.size).toBe(0);
    db.close();
  });
  test('rechecks authority after asynchronous key retrieval before releasing plaintext', async () => {
    const { db, keys, store } = fixture();
    await store.create(scope, 'sensitive');
    const originalRead = keys.read.bind(keys);
    keys.read = async (ref) => {
      const key = await originalRead(ref);
      db.prepare("UPDATE workspaces SET status='LOCKED' WHERE workspace_id='w'").run();
      return key;
    };
    await expect(store.read(scope)).rejects.toThrow();
    db.close();
  });
  test('rejects a project outside the workspace before accessing keys', async () => {
    const { db, keys, store } = fixture();
    await expect(store.create({ ...scope, projectId: 'other' }, 'sensitive')).rejects.toThrow();
    expect(keys.keys.size).toBe(0);
    db.close();
  });
  test('reused key references cannot replace a previous record', async () => {
    const { db, keys, store } = fixture();
    await store.create(scope, 'original');
    const existingRef = [...keys.keys.keys()][0]!;
    keys.create = async () => ({ keyRef: existingRef, key: randomBytes(32) });
    await expect(store.create({ ...scope, recordId: 'other' }, 'replacement')).rejects.toThrow();
    expect(await store.read(scope)).toBe('original');
    db.close();
  });
  test('captures scope before awaiting the key provider', async () => {
    const { db, keys, store } = fixture();
    const input = { ...scope };
    const originalCreate = keys.create.bind(keys);
    keys.create = async () => {
      input.recordId = 'changed-after-approval';
      return originalCreate();
    };
    await store.create(input, 'original');
    expect(await store.read(scope)).toBe('original');
    expect(db.prepare('SELECT record_id FROM protected_payloads').get()).toEqual({ record_id: scope.recordId });
    db.close();
  });
  test('does not persist when the provider cannot read back the created key', async () => {
    const { db, keys, store } = fixture();
    keys.read = async () => null;
    await expect(store.create(scope, 'sensitive')).rejects.toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM protected_payloads').get()).toEqual({ n: 0 });
    db.close();
  });
  test('does not persist when the provider reads back different key bytes', async () => {
    const { db, keys, store } = fixture();
    keys.read = async () => randomBytes(32);
    await expect(store.create(scope, 'sensitive')).rejects.toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM protected_payloads').get()).toEqual({ n: 0 });
    db.close();
  });
  test('never exposes provider exceptions to callers', async () => {
    const { db, keys, store } = fixture();
    keys.create = async () => { throw new Error('secret-provider-error'); };
    await expect(store.create(scope, 'sensitive')).rejects.not.toThrow('secret-provider-error');
    db.close();
  });
  test.each([123, true, null, { toString: () => 'valid' }])('rejects non-string identifiers: %s', async (value) => {
    const { db, keys, store } = fixture();
    for (const field of ['workspaceId', 'projectId', 'recordId'] as const) {
      await expect(store.create({ ...scope, [field]: value as unknown as string }, 'text')).rejects.toThrow();
    }
    expect(keys.keys.size).toBe(0);
    db.close();
  });
  test('rejects non-string key references before persistence', async () => {
    const { db, keys, store } = fixture();
    keys.create = async () => ({ keyRef: { toString: () => 'pkey-' + 'a'.repeat(64) } as unknown as string, key: randomBytes(32) });
    await expect(store.create(scope, 'text')).rejects.toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM protected_payloads').get()).toEqual({ n: 0 });
    db.close();
  });
  test('separates working key from aliased provider buffers', async () => {
    const { db, keys, store } = fixture();
    const shared = randomBytes(32);
    const persisted = Buffer.from(shared);
    const ref = 'pkey-' + 'a'.repeat(64);
    keys.create = async () => ({ keyRef: ref, key: shared });
    let reads = 0;
    keys.read = async () => ++reads === 1 ? shared.subarray(0) : Buffer.from(persisted);
    await store.create(scope, 'original');
    expect(await store.read(scope)).toBe('original');
    db.close();
  });
  test('rejects malformed Unicode rather than silently changing user content', async () => {
    const { db, keys, store } = fixture();
    await expect(store.create(scope, String.fromCharCode(0xd800))).rejects.toThrow();
    expect(keys.keys.size).toBe(0);
    db.close();
  });
});
