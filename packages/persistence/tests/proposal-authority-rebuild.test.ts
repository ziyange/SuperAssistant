import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { expect, test, vi } from 'vitest';
import { createFoundationDatabase, createFoundationDatabaseAsync, reserveMigrationBackup } from '../src/sqlite/database.js';
import { applyMigrations, foundationMigrations, hashMigrationBackup } from '../src/sqlite/migration-runner.js';

function legacy(path = ':memory:') {
  const db = new Database(path);
  db.pragma('foreign_keys = ON');
  applyMigrations(db, foundationMigrations.filter(item => item.version <= 31));
  db.prepare("INSERT INTO workspaces VALUES ('w','local-owner','W','ACTIVE','2026','2026',1)").run();
  db.prepare("INSERT INTO agents VALUES ('a','w','A','1','CONNECTED','AVAILABLE',NULL,1)").run();
  db.prepare("INSERT INTO projects VALUES ('p','w','P','E:/p','e:/p','ACTIVE','a',1,'2026','2026',1)").run();
  db.prepare("INSERT INTO functions VALUES ('f','a','F','1','ACTIVE')").run();
  db.prepare('INSERT INTO proposal_versions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('proposal','w','p','a','f','goal','["FILE_WRITE"]','1','1','1','1','base','2027','2026','sha256:' + 'a'.repeat(64));
  db.prepare('INSERT INTO authorization_grants VALUES (?,?,?,?,?,?,?,?,?)').run('grant','proposal','sha256:' + 'a'.repeat(64),'local-owner','confirm','["FILE_WRITE"]','CONSUMED','2026','2027');
  db.prepare("INSERT INTO authorization_confirmation_keys VALUES ('local-owner','confirm','grant')").run();
  db.prepare("INSERT INTO tasks VALUES ('task','w','p','proposal','grant','QUEUED','2026')").run();
  db.prepare("INSERT INTO work_items VALUES ('work','task','a','f','WAITING')").run();
  db.prepare("INSERT INTO execution_attempts VALUES ('attempt','work','request','attempt-key','WAITING_USER',0,'2026')").run();
  db.prepare("INSERT INTO artifact_versions VALUES ('artifact-version','artifact','task','work','attempt','p','base','grant','result','text/plain',1,'sha256:a','opaque-ref','2026')").run();
  return db;
}
function parent(db: Database.Database, table: string): string | undefined {
  return (db.pragma(`foreign_key_list(${table})`) as { from: string; table: string }[]).find(row => row.from === 'proposal_version_id')?.table;
}

test('rebuilds Proposal foreign keys without losing legacy data or child references', () => {
  const db = legacy();
  try {
    const grants = db.prepare('SELECT * FROM authorization_grants').all();
    const tasks = db.prepare('SELECT * FROM tasks').all();
    const children = db.prepare('SELECT * FROM work_items').all();
    const confirmations = db.prepare('SELECT * FROM authorization_confirmation_keys').all();
    const artifacts = db.prepare('SELECT * FROM artifact_versions').all();
    applyMigrations(db);
    expect(parent(db, 'authorization_grants')).toBe('proposal_authority_refs');
    expect(parent(db, 'tasks')).toBe('proposal_authority_refs');
    expect(db.prepare('SELECT * FROM authorization_grants').all()).toEqual(grants);
    expect(db.prepare('SELECT * FROM tasks').all()).toEqual(tasks);
    expect(db.prepare('SELECT * FROM work_items').all()).toEqual(children);
    expect(db.prepare('SELECT * FROM authorization_confirmation_keys').all()).toEqual(confirmations);
    expect(db.prepare('SELECT * FROM artifact_versions').all()).toEqual(artifacts);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('foreign_key_check')).toEqual([]);
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok');
    expect(() => db.prepare("INSERT INTO tasks VALUES ('second','w','p','proposal','grant','QUEUED','2026')").run()).toThrow();
    expect(db.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 33 });
  } finally { db.close(); }
});

test('preserves sparse rowids and rowid-dependent custom views', () => {
  const db = legacy();
  try {
    db.prepare("UPDATE authorization_grants SET rowid=202 WHERE grant_id='grant'").run();
    db.prepare("UPDATE tasks SET rowid=101 WHERE task_id='task'").run();
    db.exec('CREATE VIEW user_legacy_rowids AS SELECT task_id,rowid AS task_rowid FROM tasks');
    const before = db.prepare('SELECT * FROM user_legacy_rowids').all();
    applyMigrations(db);
    expect(db.prepare('SELECT * FROM user_legacy_rowids').all()).toEqual(before);
    expect(db.prepare("SELECT rowid AS id FROM authorization_grants WHERE grant_id='grant'").get()).toEqual({ id: 202 });
    expect(db.prepare("SELECT rowid AS id FROM tasks WHERE task_id='task'").get()).toEqual({ id: 101 });
  } finally { db.close(); }
});

test('direct migration of an empty persistent database also requires a backup', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const db = new Database(path);
  try {
    expect(() => applyMigrations(db)).toThrow();
    expect(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get()).toEqual({ n: 0 });
  } finally { db.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('direct on-disk rebuild without verified backup is refused and changes nothing', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const db = legacy(path);
  try {
    expect(() => applyMigrations(db)).toThrow();
    expect(db.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 });
    expect(parent(db, 'tasks')).toBe('proposal_versions');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 1 });
  } finally { db.close(); rmSync(folder, { recursive: true, force: true }); }
});

test.each(['missing mode', 'wrong SQL', 'wrong name', 'incomplete plan'])('rejects a tampered reserved rebuild plan: %s', kind => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const db = legacy(path);
  try {
    const plan = foundationMigrations.map(item => {
      if (item.version !== 32) return item;
      if (kind === 'missing mode') return { version: item.version, name: item.name, sql: item.sql };
      if (kind === 'wrong SQL') return { ...item, sql: 'DROP TABLE tasks' };
      if (kind === 'wrong name') return { ...item, name: 'different' };
      return item;
    }).filter(item => kind !== 'incomplete plan' || item.version !== 30);
    db.pragma('foreign_keys = OFF');
    expect(() => applyMigrations(db, plan)).toThrow('MIGRATION_PLAN_INVALID');
    expect(db.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 });
    expect(parent(db, 'tasks')).toBe('proposal_versions');
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 1 });
    expect(db.pragma('foreign_keys', { simple: true })).toBe(0);
  } finally { db.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('a gap in applied migration history blocks the controlled rebuild', () => {
  const db = legacy();
  try {
    db.prepare('DELETE FROM schema_migrations WHERE version=30').run();
    expect(() => applyMigrations(db)).toThrow('MIGRATION_HISTORY_INVALID');
    expect(parent(db, 'tasks')).toBe('proposal_versions');
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('a modified earlier pending migration cannot delete unrelated user data', () => {
  const db = new Database(':memory:');
  try {
    applyMigrations(db, foundationMigrations.filter(item => item.version <= 30));
    db.exec("CREATE TABLE user_notes (note TEXT); INSERT INTO user_notes VALUES ('keep')");
    const plan = foundationMigrations.map(item => item.version === 31
      ? { ...item, sql: `${item.sql}\nDELETE FROM user_notes;` }
      : item);
    expect(() => applyMigrations(db, plan)).toThrow('MIGRATION_PLAN_INVALID');
    expect(db.prepare('SELECT * FROM user_notes').all()).toEqual([{ note: 'keep' }]);
    expect(db.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 30 });
  } finally { db.close(); }
});

test('unknown newer migration history cannot be opened as an older schema', () => {
  const db = legacy();
  try {
    db.prepare("INSERT INTO schema_migrations VALUES (33,'unknown','2026')").run();
    expect(() => applyMigrations(db)).toThrow('MIGRATION_HISTORY_INVALID');
    expect(parent(db, 'tasks')).toBe('proposal_versions');
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('a completed v32 database with a newer unknown migration is rejected', () => {
  const db = legacy();
  try {
    applyMigrations(db, foundationMigrations.filter(item => item.version <= 32));
    db.prepare("INSERT INTO schema_migrations VALUES (33,'unknown','2026')").run();
    expect(() => applyMigrations(db)).toThrow('MIGRATION_HISTORY_INVALID');
  } finally { db.close(); }
});

test('cannot apply a future migration while omitting the required controlled rebuild', () => {
  const db = legacy();
  try {
    expect(() => applyMigrations(db, [{ version: 33, name: 'bypass', sql: 'DROP TABLE tasks' }])).toThrow('MIGRATION_PLAN_INVALID');
    expect(parent(db, 'tasks')).toBe('proposal_versions');
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('opening a persistent v31 database creates a backup and migrates without losing history', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const original = legacy(path); original.close();
  let migrated: Database.Database | undefined;
  let backup: Database.Database | undefined;
  try {
    migrated = createFoundationDatabase(path);
    const names = readdirSync(folder).filter(name => name.startsWith('db.sqlite.pre-migration-') && name.endsWith('.sqlite'));
    expect(names).toHaveLength(1);
    backup = new Database(join(folder, names[0]!), { readonly: true });
    expect(backup.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 });
    expect(backup.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 1 });
    expect(migrated.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 33 });
    expect(parent(migrated, 'tasks')).toBe('proposal_authority_refs');
    expect(migrated.pragma('foreign_key_check')).toEqual([]);
  } finally { backup?.close(); migrated?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('the verified backup bytes remain unchanged through migration', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const original = legacy(path); original.close();
  let backupPath = '';
  let before = '';
  let migrated: Database.Database | undefined;
  try {
    migrated = createFoundationDatabase(path, { backup(source, destination) {
      source.prepare('VACUUM INTO ?').run(destination);
      backupPath = destination;
      before = hashMigrationBackup(destination);
    } });
    expect(before).toMatch(/^[a-f0-9]{64}$/);
    expect(hashMigrationBackup(backupPath)).toBe(before);
  } finally { migrated?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('persistent migration and its backup both preserve sparse Grant and Task rowids', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const original = legacy(path);
  original.prepare("UPDATE authorization_grants SET rowid=202 WHERE grant_id='grant'").run();
  original.prepare("UPDATE tasks SET rowid=101 WHERE task_id='task'").run();
  original.close();
  let migrated: Database.Database | undefined;
  let backup: Database.Database | undefined;
  try {
    migrated = createFoundationDatabase(path);
    const names = readdirSync(folder).filter(name => name.startsWith('db.sqlite.pre-migration-') && name.endsWith('.sqlite'));
    expect(names).toHaveLength(1);
    backup = new Database(join(folder, names[0]!), { readonly: true });
    for (const db of [migrated, backup]) {
      expect(db.prepare("SELECT rowid AS id FROM authorization_grants WHERE grant_id='grant'").get()).toEqual({ id: 202 });
      expect(db.prepare("SELECT rowid AS id FROM tasks WHERE task_id='task'").get()).toEqual({ id: 101 });
    }
  } finally { backup?.close(); migrated?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('online backup preserves a sparse rowid in an unindexed custom table during persistent migration', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const original = legacy(path);
  original.exec("CREATE TABLE user_notes(value TEXT); INSERT INTO user_notes(rowid,value) VALUES (101,'keep')");
  original.close();
  let migrated: Database.Database | undefined;
  let backup: Database.Database | undefined;
  try {
    migrated = await createFoundationDatabaseAsync(path);
    const names = readdirSync(folder).filter(name => name.startsWith('db.sqlite.pre-migration-'));
    expect(names).toHaveLength(1);
    backup = new Database(join(folder, names[0]!, 'backup.sqlite'), { readonly: true });
    for (const db of [migrated, backup]) expect(db.prepare('SELECT rowid,value FROM user_notes').all()).toEqual([{ rowid: 101, value: 'keep' }]);
    expect(migrated.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 33 });
    expect(backup.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 });
  } finally { backup?.close(); migrated?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('backup reservation never overwrites an existing destination', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-reserve-'));
  const target = join(folder, 'backup.sqlite');
  try {
    writeFileSync(target, 'existing file', { flag: 'wx' });
    expect(() => reserveMigrationBackup(folder)).toThrow();
    expect(readFileSync(target, 'utf8')).toBe('existing file');
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('a writer committing after the online backup blocks migration and keeps the newer data', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const original = legacy(path); original.close();
  const backupMethod = Database.prototype.backup;
  const spy = vi.spyOn(Database.prototype, 'backup').mockImplementation(async function (this: Database.Database, ...args) {
    const result = await backupMethod.apply(this, args);
    const other = new Database(path);
    try { other.prepare("UPDATE workspaces SET name='newer' WHERE workspace_id='w'").run(); }
    finally { other.close(); }
    return result;
  });
  let opened: Database.Database | undefined;
  try {
    await expect(createFoundationDatabaseAsync(path).then(db => { opened = db; })).rejects.toThrow('MIGRATION_DATABASE_CHANGED');
    const current = new Database(path, { readonly: true });
    try {
      expect(current.prepare("SELECT name FROM workspaces WHERE workspace_id='w'").get()).toEqual({ name: 'newer' });
      expect(current.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 });
      expect(parent(current, 'tasks')).toBe('proposal_versions');
    } finally { current.close(); }
  } finally { spy.mockRestore(); opened?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('a writer changing and restoring data after online backup still blocks migration', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const original = legacy(path); original.close();
  const backupMethod = Database.prototype.backup;
  const spy = vi.spyOn(Database.prototype, 'backup').mockImplementation(async function (this: Database.Database, ...args) {
    const result = await backupMethod.apply(this, args);
    const other = new Database(path);
    try {
      other.prepare("UPDATE workspaces SET name='temporary' WHERE workspace_id='w'").run();
      other.prepare("UPDATE workspaces SET name='W' WHERE workspace_id='w'").run();
    } finally { other.close(); }
    return result;
  });
  let opened: Database.Database | undefined;
  try {
    await expect(createFoundationDatabaseAsync(path).then(db => { opened = db; })).rejects.toThrow('MIGRATION_DATABASE_CHANGED');
    const current = new Database(path, { readonly: true });
    try {
      expect(current.prepare("SELECT name FROM workspaces WHERE workspace_id='w'").get()).toEqual({ name: 'W' });
      expect(current.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 });
      expect(parent(current, 'tasks')).toBe('proposal_versions');
    } finally { current.close(); }
  } finally { spy.mockRestore(); opened?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('reports post-commit WAL configuration failure without claiming a rollback and reopens safely', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const original = legacy(path); original.close();
  let opened: Database.Database | undefined;
  let reopened: Database.Database | undefined;
  try {
    expect(() => { opened = createFoundationDatabase(path, { configureJournalMode() { throw new Error('injected WAL failure'); } }); }).toThrow('MIGRATION_COMMITTED_CONFIGURATION_FAILED');
    const check = new Database(path, { readonly: true });
    try {
      expect(check.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 33 });
      expect(check.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 1 });
      expect(parent(check, 'tasks')).toBe('proposal_authority_refs');
    } finally { check.close(); }
    const backups = readdirSync(folder).filter(name => name.startsWith('db.sqlite.pre-migration-') && name.endsWith('.sqlite'));
    expect(backups).toHaveLength(1);
    const backup = new Database(join(folder, backups[0]!), { readonly: true });
    try { expect(backup.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 }); }
    finally { backup.close(); }
    reopened = createFoundationDatabase(path);
    expect(reopened.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 33 });
    expect(reopened.pragma('foreign_key_check')).toEqual([]);
  } finally { opened?.close(); reopened?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test('rejects an unrelated but structurally valid backup without touching the original', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const original = legacy(path); original.close();
  let opened: Database.Database | undefined;
  try {
    expect(() => { opened = createFoundationDatabase(path, { backup(_source, destination) {
      const unrelated = new Database(destination);
      try { unrelated.exec('CREATE TABLE unrelated(value TEXT)'); } finally { unrelated.close(); }
    } }); }).toThrow();
    const current = new Database(path, { readonly: true });
    try {
      expect(current.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 });
      expect(current.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 1 });
      expect(parent(current, 'tasks')).toBe('proposal_versions');
    } finally { current.close(); }
  } finally { opened?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test.each(['sqliteX table', 'user_version', 'application_id'])('rejects a backup changed in %s', kind => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-rebuild-'));
  const path = join(folder, 'db.sqlite');
  const original = legacy(path);
  original.exec("CREATE TABLE sqliteXnotes(value TEXT); INSERT INTO sqliteXnotes VALUES ('original')");
  original.pragma('user_version = 17');
  original.pragma('application_id = 1234');
  original.close();
  let opened: Database.Database | undefined;
  try {
    expect(() => { opened = createFoundationDatabase(path, { backup(source, destination) {
      source.prepare('VACUUM INTO ?').run(destination);
      const backup = new Database(destination);
      try {
        if (kind === 'sqliteX table') backup.exec("UPDATE sqliteXnotes SET value='changed'");
        if (kind === 'user_version') backup.pragma('user_version = 18');
        if (kind === 'application_id') backup.pragma('application_id = 1235');
      } finally { backup.close(); }
    } }); }).toThrow('MIGRATION_BACKUP_MISMATCH');
    const current = new Database(path, { readonly: true });
    try {
      expect(current.prepare('SELECT * FROM sqliteXnotes').all()).toEqual([{ value: 'original' }]);
      expect(current.pragma('user_version', { simple: true })).toBe(17);
      expect(current.pragma('application_id', { simple: true })).toBe(1234);
      expect(current.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 });
    } finally { current.close(); }
  } finally { opened?.close(); rmSync(folder, { recursive: true, force: true }); }
});

test.each(['duplicate task', 'unknown index', 'unknown trigger', 'changed index', 'digest mismatch', 'orphan'])('rolls back %s and restores foreign keys', kind => {
  const db = legacy();
  try {
    if (kind === 'duplicate task') db.prepare("INSERT INTO tasks VALUES ('second','w','p','proposal','grant','QUEUED','2026')").run();
    if (kind === 'unknown index') db.exec('CREATE INDEX user_custom_task ON tasks(state)');
    if (kind === 'unknown trigger') db.exec('CREATE TRIGGER user_custom_task BEFORE UPDATE ON tasks BEGIN SELECT 1; END');
    if (kind === 'changed index') db.exec("DROP INDEX authorization_grants_one_issued_per_proposal; CREATE UNIQUE INDEX authorization_grants_one_issued_per_proposal ON authorization_grants(actor_id,proposal_version_id) WHERE status='CONSUMED'");
    if (kind === 'digest mismatch') db.prepare("UPDATE authorization_grants SET proposal_digest='sha256:wrong' WHERE grant_id='grant'").run();
    if (kind === 'orphan') {
      db.pragma('foreign_keys = OFF');
      db.prepare("INSERT INTO work_items VALUES ('orphan','missing','a','f','WAITING')").run();
      db.pragma('foreign_keys = ON');
    }
    expect(() => applyMigrations(db)).toThrow();
    expect(parent(db, 'tasks')).toBe('proposal_versions');
    expect(db.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 });
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.prepare("SELECT count(*) AS n FROM tasks WHERE task_id='task'").get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('rejects caller-owned transactions without changing foreign-key enforcement', () => {
  const db = legacy();
  try {
    db.exec('BEGIN');
    expect(() => applyMigrations(db)).toThrow();
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    db.exec('ROLLBACK');
    expect(parent(db, 'tasks')).toBe('proposal_versions');
  } finally { if (db.inTransaction) db.exec('ROLLBACK'); db.close(); }
});

test('restores an originally disabled foreign-key setting after an in-memory rebuild', () => {
  const db = legacy();
  try {
    db.pragma('foreign_keys = OFF');
    applyMigrations(db);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(0);
    expect(db.pragma('foreign_key_check')).toEqual([]);
  } finally { db.close(); }
});

test('restores an originally enabled legacy alter setting after rebuild', () => {
  const db = legacy();
  try {
    db.pragma('legacy_alter_table = ON');
    applyMigrations(db);
    expect(db.pragma('legacy_alter_table', { simple: true })).toBe(1);
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  } finally { db.close(); }
});

test('restores originally disabled foreign keys after a failed rebuild', () => {
  const db = legacy();
  try {
    db.prepare("INSERT INTO tasks VALUES ('second','w','p','proposal','grant','QUEUED','2026')").run();
    db.pragma('foreign_keys = OFF');
    expect(() => applyMigrations(db)).toThrow();
    expect(db.pragma('foreign_keys', { simple: true })).toBe(0);
    expect(parent(db, 'tasks')).toBe('proposal_versions');
  } finally { db.close(); }
});

test('reports a foreign-key restoration failure after commit as committed, not rolled back', () => {
  const db = legacy();
  const original = db.pragma.bind(db);
  const spy = vi.spyOn(db, 'pragma').mockImplementation((...args) => {
    if (args[0] === 'foreign_keys = 1') throw new Error('injected restore failure');
    return original(...args);
  });
  try {
    expect(() => applyMigrations(db)).toThrow('MIGRATION_COMMITTED_CONFIGURATION_FAILED');
    expect(db.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 33 });
    expect(parent(db, 'tasks')).toBe('proposal_authority_refs');
  } finally { spy.mockRestore(); db.pragma('foreign_keys = ON'); db.close(); }
});

test('still restores foreign keys if legacy alter restoration fails after commit', () => {
  const db = legacy();
  const original = db.pragma.bind(db);
  const spy = vi.spyOn(db, 'pragma').mockImplementation((...args) => {
    if (args[0] === 'legacy_alter_table = 0') throw new Error('injected restore failure');
    return original(...args);
  });
  try {
    expect(() => applyMigrations(db)).toThrow('MIGRATION_COMMITTED_CONFIGURATION_FAILED');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 33 });
  } finally { spy.mockRestore(); db.pragma('legacy_alter_table = OFF'); db.close(); }
});

test('protected identities cannot be used to insert or retarget Grants or Tasks', () => {
  const db = legacy();
  try {
    applyMigrations(db);
    db.prepare("INSERT INTO proposal_authority_refs VALUES ('protected','w','p','PROTECTED',1,'2026')").run();
    expect(() => db.prepare("INSERT INTO authorization_grants VALUES ('g2','protected','sha256:a','local-owner','new','[]','ISSUED','2026','2027')").run()).toThrow();
    expect(() => db.prepare("UPDATE authorization_grants SET proposal_version_id='protected' WHERE grant_id='grant'").run()).toThrow();
    expect(() => db.prepare("UPDATE authorization_grants SET proposal_digest='sha256:wrong' WHERE grant_id='grant'").run()).toThrow();
    expect(() => db.prepare("INSERT INTO authorization_grants VALUES ('g3','proposal','sha256:wrong','local-owner','other','[]','ISSUED','2026','2027')").run()).toThrow();
    expect(() => db.prepare("INSERT INTO tasks VALUES ('t2','w','p','protected','grant','QUEUED','2026')").run()).toThrow();
    expect(() => db.prepare("UPDATE tasks SET proposal_version_id='protected' WHERE task_id='task'").run()).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('preserves custom unrelated tables, indexes, views and triggers', () => {
  const db = legacy();
  try {
    db.exec('CREATE TABLE user_notes(id INTEGER PRIMARY KEY, value TEXT); CREATE INDEX user_notes_value ON user_notes(value); CREATE VIEW user_notes_view AS SELECT * FROM user_notes; CREATE TRIGGER user_notes_trigger AFTER INSERT ON user_notes BEGIN UPDATE user_notes SET value=NEW.value WHERE id=NEW.id; END');
    db.prepare("INSERT INTO user_notes VALUES (1,'preserve')").run();
    const before = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name LIKE 'user_notes%' ORDER BY type,name").all();
    applyMigrations(db);
    expect(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name LIKE 'user_notes%' ORDER BY type,name").all()).toEqual(before);
    expect(db.prepare('SELECT * FROM user_notes').all()).toEqual([{ id: 1, value: 'preserve' }]);
  } finally { db.close(); }
});

test('a later failing pending migration rolls back the rebuild and all pending versions', () => {
  const db = legacy();
  try {
    const bad = { version: 34, name: 'intentional-failure', sql: 'CREATE TABLE invalid ( ;' };
    expect(() => applyMigrations(db, [...foundationMigrations, bad])).toThrow();
    expect(db.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 31 });
    expect(parent(db, 'tasks')).toBe('proposal_versions');
    expect(db.prepare('SELECT count(*) AS n FROM tasks').get()).toEqual({ n: 1 });
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  } finally { db.close(); }
});
