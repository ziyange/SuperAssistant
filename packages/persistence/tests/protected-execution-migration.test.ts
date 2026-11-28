import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, expect, test, vi } from 'vitest';
import { createFoundationDatabase, createFoundationDatabaseAsync } from '../src/sqlite/database.js';
import { applyMigrations, foundationMigrations, hashMigrationBackup } from '../src/sqlite/migration-runner.js';

const folders: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
function folderFor() { const folder = mkdtempSync(join(tmpdir(), 'sa-protected-migration-')); folders.push(folder); return folder; }
function v32() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  applyMigrations(db, foundationMigrations.filter(item => item.version <= 32));
  db.exec(`INSERT INTO workspaces VALUES ('w','local-owner','Local','ACTIVE','2026','2026',1);
    INSERT INTO agents VALUES ('a','w','Agent','1','CONNECTED','AVAILABLE',NULL,1);
    INSERT INTO projects VALUES ('p','w','Project','E:/fixture','e:/fixture','ACTIVE','a',1,'2026','2026',1);
    INSERT INTO functions VALUES ('f','a','Function','1','ACTIVE');
    CREATE TABLE user_notes(value BLOB);
    INSERT INTO user_notes(rowid,value) VALUES (101,X'00FF42');`);
  db.prepare('INSERT INTO proposal_versions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('proposal','w','p','a','f','legacy goal','["FILE_WRITE"]','1','1','1','1','base','2027','2026','sha256:' + 'a'.repeat(64));
  db.exec(`INSERT INTO authorization_grants VALUES ('grant','proposal','sha256:${'a'.repeat(64)}','local-owner','confirm','["FILE_WRITE"]','CONSUMED','2026','2027');
    INSERT INTO tasks VALUES ('task','w','p','proposal','grant','QUEUED','2026');
    INSERT INTO work_items VALUES ('work','task','a','f','WAITING');
    INSERT INTO execution_attempts VALUES ('attempt','work','request','attempt-key','UNKNOWN',0,'2026');
    UPDATE authorization_grants SET rowid=303;
    UPDATE tasks SET rowid=707;`);
  return db;
}
async function persistentV32(folder: string) {
  const path = join(folder, 'control.sqlite'), db = v32();
  try { await db.backup(path); } finally { db.close(); }
  return path;
}
function content(db: Database.Database) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
  return tables.filter(row => row.name !== 'schema_migrations').map(({ name }) => ({ name,
    rows: db.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '"').all() }));
}
function schema(db: Database.Database) { return db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY type,name').all(); }

test('the default database can persist protected receipts without a fixture-installed migration', () => {
  const db = createFoundationDatabase(':memory:');
  try {
    expect(db.prepare('SELECT count(*) AS n FROM protected_start_receipts').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM protected_execution_bindings').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
  } finally { db.close(); }
});

test('production async opening upgrades v32 with a restorable backup and no new execution', async () => {
  const folder = folderFor(), path = await persistentV32(folder);
  const before = new Database(path, { readonly: true });
  const rows = content(before); before.close();
  const db = await createFoundationDatabaseAsync(path);
  try {
    expect(db.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 33 });
    expect(content(db).filter(row => rows.some(old => old.name === row.name))).toEqual(rows);
    expect(db.prepare('SELECT rowid FROM tasks').get()).toEqual({ rowid: 707 });
    expect(db.prepare('SELECT rowid FROM authorization_grants').get()).toEqual({ rowid: 303 });
    expect(db.prepare('SELECT rowid,hex(value) AS value FROM user_notes').get()).toEqual({ rowid: 101, value: '00FF42' });
    expect(db.prepare('SELECT state FROM execution_attempts').all()).toEqual([{ state: 'UNKNOWN' }]);
    expect(db.prepare('SELECT count(*) AS n FROM outbox').get()).toEqual({ n: 0 });
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  } finally { db.close(); }
  const backups = readdirSync(folder).filter(name => name.startsWith('control.sqlite.pre-migration-'));
  expect(backups).toHaveLength(1);
  const backup = join(folder, backups[0]!, 'backup.sqlite'), digest = hashMigrationBackup(backup);
  const reopened = await createFoundationDatabaseAsync(path);
  try {
    expect(reopened.prepare('SELECT count(*) AS n FROM schema_migrations WHERE version=33').get()).toEqual({ n: 1 });
    expect(reopened.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
    expect(readdirSync(folder).filter(name => name.startsWith('control.sqlite.pre-migration-'))).toEqual(backups);
  } finally { reopened.close(); }
  const restoredPath = join(folder, 'restored.sqlite'); copyFileSync(backup, restoredPath);
  const restored = new Database(restoredPath, { readonly: true });
  try {
    expect(restored.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 32 });
    expect(content(restored)).toEqual(rows);
  } finally { restored.close(); }
  const upgraded = await createFoundationDatabaseAsync(restoredPath);
  try { expect(upgraded.prepare('SELECT count(*) AS n FROM protected_start_receipts').get()).toEqual({ n: 0 }); }
  finally { upgraded.close(); }
  expect(hashMigrationBackup(backup)).toBe(digest);
});

test('direct persistent v33 upgrade requires a verified backup before changing anything', async () => {
  const path = await persistentV32(folderFor()), db = new Database(path);
  try {
    const before = schema(db);
    expect(() => applyMigrations(db)).toThrow('MIGRATION_BACKUP_REQUIRED');
    expect(schema(db)).toEqual(before);
    expect(db.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 32 });
  } finally { db.close(); }
});

test('a wrong but valid backup cannot authorize the standalone v33 upgrade', async () => {
  const path = await persistentV32(folderFor());
  let opened: Database.Database | undefined;
  try {
    expect(() => { opened = createFoundationDatabase(path, { backup(_source, target) {
      const unrelated = new Database(target);
      try { unrelated.exec('CREATE TABLE unrelated(value TEXT)'); } finally { unrelated.close(); }
    } }); }).toThrow('MIGRATION_BACKUP_MISMATCH');
    const original = new Database(path, { readonly: true });
    try { expect(original.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 32 }); }
    finally { original.close(); }
  } finally { opened?.close(); }
});

test.each(['name', 'sql', 'mode', 'missing predecessor'])('rejects a substituted reserved v33 plan: %s', kind => {
  const db = v32();
  try {
    const before = schema(db);
    const plan = foundationMigrations.map(item => item.version !== 33 ? { ...item }
      : kind === 'name' ? { ...item, name: 'forged' }
      : kind === 'sql' ? { ...item, sql: 'DROP TABLE user_notes;' } : { ...item })
      .filter(item => kind !== 'missing predecessor' || item.version !== 31);
    if (kind === 'mode') {
      const item = plan.find(item => item.version === 33);
      if (!item) throw new Error('missing v33');
      item.mode = 'controlled-rebuild';
    }
    expect(() => applyMigrations(db, plan)).toThrow('MIGRATION_PLAN_INVALID');
    expect(schema(db)).toEqual(before);
    expect(db.prepare('SELECT hex(value) AS value FROM user_notes').get()).toEqual({ value: '00FF42' });
  } finally { db.close(); }
});

test('standalone v33 keeps foreign keys enabled during the actual migration', async () => {
  const path = await persistentV32(folderFor()), execute = Database.prototype.exec;
  const observed: unknown[] = [];
  vi.spyOn(Database.prototype, 'exec').mockImplementation(function (this: Database.Database, sql: string) {
    if (sql.includes('CREATE TABLE protected_execution_bindings')) observed.push(this.pragma('foreign_keys', { simple: true }));
    return execute.call(this, sql);
  });
  const db = await createFoundationDatabaseAsync(path);
  try { expect(observed).toEqual([1]); } finally { db.close(); }
});

test('a late v33 trigger conflict rolls back all earlier DDL and retains the backup', async () => {
  const folder = folderFor(), path = await persistentV32(folder);
  const source = new Database(path);
  source.exec('CREATE TRIGGER protected_start_state_guard BEFORE UPDATE ON outbox BEGIN SELECT 1; END');
  const before = schema(source), rows = content(source); source.close();
  await expect(createFoundationDatabaseAsync(path)).rejects.toThrow('already exists');
  const original = new Database(path, { readonly: true });
  try {
    expect(schema(original)).toEqual(before); expect(content(original)).toEqual(rows);
    expect(original.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 32 });
    expect(original.pragma('integrity_check', { simple: true })).toBe('ok');
  } finally { original.close(); }
  const backups = readdirSync(folder).filter(name => name.startsWith('control.sqlite.pre-migration-'));
  expect(backups).toHaveLength(1);
  const backup = new Database(join(folder, backups[0]!, 'backup.sqlite'), { readonly: true });
  try { expect(schema(backup)).toEqual(before); expect(content(backup)).toEqual(rows); }
  finally { backup.close(); }
});

test('a concurrent commit after the v32 backup rejects upgrade without overwriting newer data', async () => {
  const path = await persistentV32(folderFor()), backup = Database.prototype.backup;
  vi.spyOn(Database.prototype, 'backup').mockImplementation(async function (this: Database.Database, ...args) {
    const result = await backup.apply(this, args), other = new Database(path);
    try { other.exec("INSERT INTO user_notes(rowid,value) VALUES (202,X'ABCD')"); } finally { other.close(); }
    return result;
  });
  await expect(createFoundationDatabaseAsync(path)).rejects.toThrow('MIGRATION_DATABASE_CHANGED');
  const source = new Database(path, { readonly: true });
  try {
    expect(source.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 32 });
    expect(source.prepare('SELECT rowid,hex(value) AS value FROM user_notes ORDER BY rowid').all())
      .toEqual([{ rowid: 101, value: '00FF42' }, { rowid: 202, value: 'ABCD' }]);
  } finally { source.close(); }
});

test('v33 preserves legacy Grant validation and rejects an unbound protected identity', () => {
  const db = v32();
  try {
    applyMigrations(db);
    db.prepare("INSERT INTO proposal_authority_refs VALUES ('protected','w','p','PROTECTED',1,'2026')").run();
    expect(() => db.prepare("INSERT INTO authorization_grants VALUES ('evil','protected','sha256:a','local-owner','evil','[]','ISSUED','2026','2027')").run()).toThrow();
    expect(() => db.prepare("UPDATE authorization_grants SET proposal_digest='sha256:forged' WHERE grant_id='grant'").run()).toThrow();
    expect(() => db.prepare("UPDATE tasks SET proposal_version_id='protected' WHERE task_id='task'").run()).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('a canonical v33 history marker before v32 is rejected without partially upgrading', () => {
  const db = new Database(':memory:');
  try {
    applyMigrations(db, foundationMigrations.filter(item => item.version <= 31));
    db.exec("INSERT INTO schema_migrations VALUES (33,'protected-execution','2026'); CREATE TABLE preserved(value TEXT); INSERT INTO preserved VALUES ('keep')");
    const before = schema(db), rows = content(db);
    expect(() => applyMigrations(db)).toThrow('MIGRATION_HISTORY_INVALID');
    expect(schema(db)).toEqual(before); expect(content(db)).toEqual(rows);
  } finally { db.close(); }
});

test('a manually installed v33 without its history record is preserved and refused, not silently adopted', async () => {
  const folder = folderFor(), path = await persistentV32(folder), source = new Database(path);
  const migration = foundationMigrations.find(item => item.version === 33);
  if (!migration) { source.close(); throw new Error('missing canonical v33'); }
  source.exec(migration.sql);
  const before = schema(source), rows = content(source); source.close();
  await expect(createFoundationDatabaseAsync(path)).rejects.toThrow('already exists');
  const original = new Database(path, { readonly: true });
  try {
    expect(schema(original)).toEqual(before); expect(content(original)).toEqual(rows);
    expect(original.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 32 });
  } finally { original.close(); }
});
