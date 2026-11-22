import { Buffer } from 'node:buffer';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { expect, test, vi } from 'vitest';
import { applyMigrations } from '../../../../packages/persistence/src/sqlite/migration-runner.js';
import { ProtectedKeyReservations } from '../../src/main/protected-key-reservations.js';
import { ReservedPayloadService, type ReservedVault } from '../../src/main/reserved-payload-service.js';

const scope = { workspaceId: 'w', projectId: 'p', recordId: 'r', kind: 'GOAL' as const };
class TestVault implements ReservedVault {
  values = new Map<string, Buffer>();
  writes = 0;
  failAfterWrite = false;
  badRead = false;
  async create(ref: string): Promise<Buffer> {
    if (this.values.has(ref)) throw new Error('would overwrite');
    this.writes++;
    const key = randomBytes(32);
    this.values.set(ref, Buffer.from(key));
    if (this.failAfterWrite) throw new Error('synthetic secret transport error');
    return key;
  }
  async read(ref: string): Promise<Buffer | null> {
    if (this.badRead) return randomBytes(32);
    const key = this.values.get(ref);
    return key ? Buffer.from(key) : null;
  }
}
function fixture() {
  const db = new Database(':memory:'); applyMigrations(db);
  db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO projects VALUES ('p','w','P','E:/fixture','e:/fixture','ACTIVE',NULL,1,'2026','2026',1)").run();
  const journal = new ProtectedKeyReservations(db); const vault = new TestVault();
  return { db, journal, vault, service: new ReservedPayloadService(db, journal, vault) };
}
test('stores encrypted content using exactly the reserved reference and refuses duplicate effects', async () => {
  const { db, journal, vault, service } = fixture();
  try {
    await service.create(scope, 'sensitive business content');
    expect(journal.inspect(scope)).toBe('LINKED');
    const row = db.prepare('SELECT key_ref FROM protected_payloads').get() as { key_ref: string };
    const reservation = db.prepare('SELECT key_ref FROM protected_key_reservations').get();
    expect(reservation).toEqual(row); expect(vault.values.has(row.key_ref)).toBe(true);
    expect(await service.read(scope)).toBe('sensitive business content');
    expect(db.serialize().includes(Buffer.from('sensitive business content'))).toBe(false);
    await expect(service.create(scope, 'another')).rejects.toThrow();
    expect(vault.writes).toBe(1);
  } finally { db.close(); }
});
test('a lost vault response becomes uncertain and cannot create a second key', async () => {
  const { db, journal, vault, service } = fixture(); vault.failAfterWrite = true;
  try {
    await expect(service.create(scope, 'text')).rejects.not.toThrow('synthetic secret');
    expect(journal.inspect(scope)).toBe('UNCERTAIN');
    expect(vault.writes).toBe(1);
    await expect(service.create(scope, 'text')).rejects.toThrow();
    expect(vault.writes).toBe(1);
    expect(db.prepare('SELECT count(*) AS n FROM protected_payloads').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});
test('wrong vault readback is uncertain and does not persist plaintext or payload', async () => {
  const { db, journal, vault, service } = fixture(); vault.badRead = true;
  try {
    await expect(service.create(scope, 'text')).rejects.toThrow();
    expect(journal.inspect(scope)).toBe('UNCERTAIN');
    expect(db.prepare('SELECT count(*) AS n FROM protected_payloads').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});
test('commit followed by link failure preserves original payload for observation without redispatch', async () => {
  const { db, journal, vault, service } = fixture();
  vi.spyOn(journal, 'markLinked').mockImplementation(() => { throw new Error('injected link interruption'); });
  try {
    await expect(service.create(scope, 'text')).rejects.toThrow();
    expect(journal.inspect(scope)).toBe('PAYLOAD_PRESENT_UNCONFIRMED');
    expect(vault.writes).toBe(1);
    await expect(service.create(scope, 'text')).rejects.toThrow();
    expect(vault.writes).toBe(1);
  } finally { vi.restoreAllMocks(); db.close(); }
});
test('invalid user content is rejected before reserving or writing any key', async () => {
  const { db, journal, vault, service } = fixture();
  try {
    await expect(service.create(scope, String.fromCharCode(0xd800))).rejects.toThrow();
    expect(journal.inspect(scope)).toBe('ABSENT');
    expect(vault.writes).toBe(0);
  } finally { db.close(); }
});
test('separates working key from aliased vault readback buffers', async () => {
  const { db, vault, service } = fixture();
  const shared = randomBytes(32);
  const persisted = Buffer.from(shared);
  let reads = 0;
  vault.create = async ref => { vault.values.set(ref, Buffer.from(persisted)); return shared; };
  vault.read = async () => ++reads === 1 ? shared.subarray(0) : Buffer.from(persisted);
  try {
    await service.create(scope, 'text');
    expect(await service.read(scope)).toBe('text');
  } finally { db.close(); }
});
test('authority revoked after vault write preserves a non-retryable reservation', async () => {
  const { db, journal, vault, service } = fixture();
  const originalCreate = vault.create.bind(vault);
  vault.create = async ref => {
    const key = await originalCreate(ref);
    db.prepare("UPDATE workspaces SET status='LOCKED' WHERE workspace_id='w'").run();
    return key;
  };
  try {
    await expect(service.create(scope, 'text')).rejects.toThrow();
    expect(db.prepare('SELECT state FROM protected_key_reservations').get()).toEqual({ state: 'RESERVED' });
    expect(db.prepare('SELECT count(*) AS n FROM protected_payloads').get()).toEqual({ n: 0 });
    db.prepare("UPDATE workspaces SET status='ACTIVE' WHERE workspace_id='w'").run();
    expect(journal.inspect(scope)).toBe('RESERVED');
    await expect(service.create(scope, 'text')).rejects.toThrow();
    expect(vault.writes).toBe(1);
  } finally { db.close(); }
});
test('reopened database reads the same linked payload and rejects ciphertext tampering', async () => {
  const { db, vault, service } = fixture();
  let reopened: Database.Database | undefined;
  try {
    await service.create(scope, 'text');
    reopened = new Database(db.serialize());
    const reader = new ReservedPayloadService(reopened, new ProtectedKeyReservations(reopened), vault);
    expect(await reader.read(scope)).toBe('text');
    reopened.exec('DROP TRIGGER protected_payloads_no_update');
    reopened.prepare("UPDATE protected_payloads SET ciphertext=x'00'").run();
    await expect(reader.read(scope)).rejects.toThrow();
  } finally { reopened?.close(); db.close(); }
});
test('a vault returning its stored buffer remains usable after repeated reads', async () => {
  const { db, vault, service } = fixture();
  vault.create = async ref => { const value = randomBytes(32); vault.values.set(ref, value); return value; };
  vault.read = async ref => vault.values.get(ref) ?? null;
  try {
    await service.create(scope, 'text');
    expect(await service.read(scope)).toBe('text');
    expect(await service.read(scope)).toBe('text');
  } finally { db.close(); }
});
test('timed-out vault writes remain uncertain even if a late write eventually completes', async () => {
  const { db, journal, vault, service } = fixture();
  vi.useFakeTimers();
  let finish: (() => void) | undefined;
  vault.create = async ref => new Promise<Buffer>(resolve => {
    vault.writes++;
    finish = () => { const key = randomBytes(32); vault.values.set(ref, Buffer.from(key)); resolve(key); };
  });
  try {
    const result = service.create(scope, 'text');
    const rejected = expect(result).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10_001);
    await rejected;
    expect(journal.inspect(scope)).toBe('UNCERTAIN');
    finish?.();
    await vi.advanceTimersByTimeAsync(1);
    expect(db.prepare('SELECT count(*) AS n FROM protected_payloads').get()).toEqual({ n: 0 });
    await expect(service.create(scope, 'text')).rejects.toThrow();
    expect(vault.writes).toBe(1);
  } finally { vi.useRealTimers(); db.close(); }
});
test('limits underlying vault calls even after callers have timed out', async () => {
  const { db, vault, service } = fixture();
  vi.useFakeTimers();
  const completions: Array<() => void> = [];
  const originalCreate = vault.create.bind(vault);
  vault.create = async ref => new Promise<Buffer>(resolve => {
    vault.writes++;
    completions.push(() => { const key = randomBytes(32); vault.values.set(ref, Buffer.from(key)); resolve(key); });
  });
  try {
    const attempts = Array.from({ length: 5 }, (_, i) => service.create({ ...scope, recordId: 'r' + i }, 'text').then(() => 'ok', () => 'rejected'));
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await Promise.all(attempts)).toEqual(['rejected', 'rejected', 'rejected', 'rejected', 'rejected']);
    expect(vault.writes).toBe(4);
    completions.forEach(finish => finish());
    await vi.advanceTimersByTimeAsync(1);
    expect(db.prepare('SELECT count(*) AS n FROM protected_payloads').get()).toEqual({ n: 0 });
    vault.create = originalCreate;
    await expect(service.create({ ...scope, recordId: 'fresh' }, 'text')).resolves.toBeUndefined();
  } finally { vi.useRealTimers(); db.close(); }
});
test('late rejection releases capacity without permitting a retry of the uncertain record', async () => {
  const { db, vault, service } = fixture();
  vi.useFakeTimers();
  const originalCreate = vault.create.bind(vault);
  let finish: (() => void) | undefined;
  vault.create = async () => new Promise<Buffer>((_resolve, reject) => { finish = () => reject(new Error('late failure')); });
  try {
    const rejected = expect(service.create(scope, 'text')).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10_001); await rejected;
    finish?.(); await vi.advanceTimersByTimeAsync(1);
    vault.create = originalCreate;
    await expect(service.create(scope, 'text')).rejects.toThrow();
    await expect(service.create({ ...scope, recordId: 'fresh' }, 'text')).resolves.toBeUndefined();
  } finally { vi.useRealTimers(); db.close(); }
});
test('a vault read timeout does not mutate a linked payload or retry its key', async () => {
  const { db, journal, vault, service } = fixture();
  try {
    await service.create(scope, 'text');
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const key = Buffer.from([...vault.values.values()][0]!);
    vault.read = async () => new Promise<Buffer>(resolve => { finish = () => resolve(key); });
    const rejected = expect(service.read(scope)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10_001); await rejected;
    expect(journal.inspect(scope)).toBe('LINKED');
    finish?.(); await vi.advanceTimersByTimeAsync(1);
    expect(vault.writes).toBe(1);
  } finally { vi.useRealTimers(); db.close(); }
});
test('releases owned vault buffers after successful creation and reading', async () => {
  const { db, vault, service } = fixture();
  const owned = new Set<Buffer>(); const returned: Buffer[] = [];
  const originalCreate = vault.create.bind(vault); const originalRead = vault.read.bind(vault);
  const tracked: ReservedVault = vault;
  tracked.release = value => { if (owned.delete(value)) value.fill(0); };
  vault.create = async ref => { const value = await originalCreate(ref); owned.add(value); returned.push(value); return value; };
  vault.read = async ref => { const value = await originalRead(ref); if (value) { owned.add(value); returned.push(value); } return value; };
  try {
    await service.create(scope, 'text');
    expect(await service.read(scope)).toBe('text');
    expect(returned.length).toBeGreaterThanOrEqual(3);
    for (const value of returned) expect(value).toEqual(Buffer.alloc(32));
    expect(owned.size).toBe(0);
  } finally { db.close(); }
});
test('releases an owned key delivered after a timed-out write without erasing borrowed storage', async () => {
  const { db, journal, vault, service } = fixture();
  vi.useFakeTimers();
  const stored = Buffer.alloc(32, 77);
  const late = Buffer.from(stored);
  let finish: (() => void) | undefined;
  const tracked: ReservedVault = vault;
  tracked.release = value => { if (value === late) value.fill(0); };
  vault.create = async ref => new Promise<Buffer>(resolve => {
    vault.values.set(ref, stored);
    finish = () => resolve(late);
  });
  try {
    const rejected = expect(service.create(scope, 'text')).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10_001); await rejected;
    expect(journal.inspect(scope)).toBe('UNCERTAIN');
    finish?.(); await vi.advanceTimersByTimeAsync(1);
    expect(late).toEqual(Buffer.alloc(32));
    expect(stored).toEqual(Buffer.alloc(32, 77));
    expect(db.prepare('SELECT count(*) AS n FROM protected_payloads').get()).toEqual({ n: 0 });
  } finally { vi.useRealTimers(); db.close(); }
});
test('releases an owned key delivered after a timed-out read', async () => {
  const { db, vault, service } = fixture();
  try {
    await service.create(scope, 'text');
    vi.useFakeTimers();
    const late = Buffer.from([...vault.values.values()][0]!);
    let finish: (() => void) | undefined;
    const tracked: ReservedVault = vault;
    tracked.release = value => { if (value === late) value.fill(0); };
    vault.read = async () => new Promise<Buffer>(resolve => { finish = () => resolve(late); });
    const rejected = expect(service.read(scope)).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(10_001); await rejected;
    finish?.(); await vi.advanceTimersByTimeAsync(1);
    expect(late).toEqual(Buffer.alloc(32));
  } finally { vi.useRealTimers(); db.close(); }
});
test('zeroes its copied key if a vault release callback fails', async () => {
  const { db, vault, service } = fixture();
  try {
    await service.create(scope, 'text');
    const borrowed = Buffer.from([...vault.values.values()][0]!);
    vault.read = async () => borrowed;
    const tracked: ReservedVault = vault;
    tracked.release = () => { throw new Error('release failed'); };
    const original = Buffer.from;
    let captured: Buffer | undefined;
    vi.spyOn(Buffer, 'from').mockImplementation(((...args: unknown[]) => {
      const result = Reflect.apply(original, Buffer, args) as Buffer;
      if (args[0] === borrowed) captured = result;
      return result;
    }) as typeof Buffer.from);
    await expect(service.read(scope)).rejects.toThrow();
    expect(captured).toBeDefined();
    expect(captured).toEqual(Buffer.alloc(32));
  } finally { vi.restoreAllMocks(); db.close(); }
});
test('zeroes the creation copy if releasing the original vault key fails', async () => {
  const { db, journal, vault, service } = fixture();
  const originalKey = Buffer.alloc(32, 91);
  vault.create = async ref => { vault.values.set(ref, Buffer.from(originalKey)); return originalKey; };
  const tracked: ReservedVault = vault;
  tracked.release = value => { if (value === originalKey) throw new Error('release failed'); };
  const original = Buffer.from;
  const captured: Buffer[] = [];
  vi.spyOn(Buffer, 'from').mockImplementation(((...args: unknown[]) => {
    const result = Reflect.apply(original, Buffer, args) as Buffer;
    if (args[0] === originalKey) captured.push(result);
    return result;
  }) as typeof Buffer.from);
  try {
    await expect(service.create(scope, 'text')).rejects.toThrow();
    expect(captured).toHaveLength(2);
    expect(captured[0]).toEqual(Buffer.alloc(32, 91));
    expect(captured[1]).toEqual(Buffer.alloc(32));
    expect(journal.inspect(scope)).toBe('UNCERTAIN');
  } finally { vi.restoreAllMocks(); db.close(); }
});
