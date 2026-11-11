import { afterEach, describe, expect, test } from 'vitest';
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { applyMigrations, foundationMigrations } from '../src/sqlite/migration-runner.js';
import { createFoundationDatabase } from '../src/sqlite/database.js';

const folders: string[] = [];
afterEach(() => folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true })));
function pathFor(name: string): string { const folder = mkdtempSync(join(tmpdir(), 'sa-migration-')); folders.push(folder); return join(folder, name); }

describe('migration runner', () => {

  test('backs up a newly created disk database before its first migration', () => {
    const file = pathFor('fresh.sqlite');
    const opened = createFoundationDatabase(file);
    try {
      expect(opened.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 21 });
      const backups = readdirSync(dirname(file)).filter(name => name.startsWith('fresh.sqlite.pre-migration-') && name.endsWith('.sqlite'));
      expect(backups).toHaveLength(1);
      const backup = new Database(join(dirname(file), backups[0]!), { readonly: true, fileMustExist: true });
      try {
        expect(backup.prepare("SELECT name FROM sqlite_master WHERE name = 'schema_migrations'").get()).toBeUndefined();
        expect(backup.pragma('integrity_check', { simple: true })).toBe('ok');
      } finally { backup.close(); }
    } finally { opened.close(); }
  });

  test('an existing WAL database migrates with a consistent backup', () => {
    const file = pathFor('wal.sqlite');
    const original = new Database(file);
    original.pragma('journal_mode = WAL');
    applyMigrations(original, foundationMigrations.filter(migration => migration.version <= 18));
    original.prepare("INSERT INTO workspaces VALUES ('w', 'owner', 'WAL', 'ACTIVE', '2026', '2026', 1)").run();
    original.close();
    const upgraded = createFoundationDatabase(file);
    try {
      expect(upgraded.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 21 });
      expect(upgraded.prepare("SELECT name FROM workspaces WHERE workspace_id = 'w'").get()).toEqual({ name: 'WAL' });
      const backups = readdirSync(dirname(file)).filter(name => name.startsWith('wal.sqlite.pre-migration-') && name.endsWith('.sqlite'));
      expect(backups).toHaveLength(1);
      const backup = new Database(join(dirname(file), backups[0]!), { readonly: true, fileMustExist: true });
      try { expect(backup.prepare("SELECT name FROM workspaces WHERE workspace_id = 'w'").get()).toEqual({ name: 'WAL' }); }
      finally { backup.close(); }
    } finally { upgraded.close(); }
  });

  test('an intervening commit after backup prevents migration and preserves newer data', () => {
    const file = pathFor('concurrent.sqlite');
    const original = new Database(file);
    applyMigrations(original, foundationMigrations.filter(migration => migration.version <= 18));
    original.prepare("INSERT INTO workspaces VALUES ('w', 'owner', 'Before', 'ACTIVE', '2026', '2026', 1)").run();
    original.close();
    let opened: Database.Database | undefined;
    try {
      expect(() => {
        opened = createFoundationDatabase(file, { backup(source, destination) {
          source.prepare('VACUUM INTO ?').run(destination);
          const other = new Database(file);
          try { other.prepare("UPDATE workspaces SET name = 'After' WHERE workspace_id = 'w'").run(); }
          finally { other.close(); }
        } });
      }).toThrow('MIGRATION_DATABASE_CHANGED');
    } finally { opened?.close(); }
    const current = new Database(file, { readonly: true, fileMustExist: true });
    try {
      expect(current.prepare("SELECT name FROM workspaces WHERE workspace_id = 'w'").get()).toEqual({ name: 'After' });
      expect(current.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 18 });
    } finally { current.close(); }
    const backups = readdirSync(dirname(file)).filter(name => name.startsWith('concurrent.sqlite.pre-migration-') && name.endsWith('.sqlite'));
    expect(backups).toHaveLength(1);
    const backup = new Database(join(dirname(file), backups[0]!), { readonly: true, fileMustExist: true });
    try { expect(backup.prepare("SELECT name FROM workspaces WHERE workspace_id = 'w'").get()).toEqual({ name: 'Before' }); }
    finally { backup.close(); }
  });

  test('backs up an existing database before applying migration 019', () => {
    const file = pathFor('existing.sqlite');
    const original = new Database(file);
    applyMigrations(original, foundationMigrations.filter(migration => migration.version <= 18));
    original.prepare("INSERT INTO workspaces VALUES ('w', 'owner', 'Before', 'ACTIVE', '2026', '2026', 1)").run();
    original.close();
    const upgraded = createFoundationDatabase(file);
    try {
      const backups = readdirSync(dirname(file)).filter(name => name.startsWith('existing.sqlite.pre-migration-') && name.endsWith('.sqlite'));
      expect(backups).toHaveLength(1);
      const backup = new Database(join(dirname(file), backups[0]!), { readonly: true, fileMustExist: true });
      try {
        expect(backup.prepare("SELECT name FROM workspaces WHERE workspace_id = 'w'").get()).toEqual({ name: 'Before' });
        expect(backup.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 18 });
      } finally { backup.close(); }
      expect(upgraded.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 21 });
      expect(upgraded.prepare("SELECT name FROM workspaces WHERE workspace_id = 'w'").get()).toEqual({ name: 'Before' });
    } finally { upgraded.close(); }
    const reopened = createFoundationDatabase(file);
    try {
      const backups = readdirSync(dirname(file)).filter(name => name.startsWith('existing.sqlite.pre-migration-') && name.endsWith('.sqlite'));
      expect(backups).toHaveLength(1);
      expect(reopened.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 21 });
    } finally { reopened.close(); }
  });

  test('backup failure leaves the existing database unmigrated', () => {
    const file = pathFor('blocked.sqlite');
    const original = new Database(file);
    applyMigrations(original, foundationMigrations.filter(migration => migration.version <= 18));
    original.close();
    // eslint-disable-next-line no-unused-vars -- parameter names document the test-only injection.
    const open = createFoundationDatabase as unknown as (path: string, options: { backup: () => never }) => Database.Database;
    let unexpectedlyOpened: Database.Database | undefined;
    try { expect(() => { unexpectedlyOpened = open(file, { backup: () => { throw new Error('backup failure'); } }); }).toThrow('backup failure'); }
    finally { unexpectedlyOpened?.close(); }
    const check = new Database(file, { readonly: true, fileMustExist: true });
    try { expect(check.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 18 }); }
    finally { check.close(); }
  });

  test('a failed migration preserves the original and a restorable backup', () => {
    const file = pathFor('failed-upgrade.sqlite');
    const original = new Database(file);
    applyMigrations(original, foundationMigrations.filter(migration => migration.version <= 18));
    original.prepare("INSERT INTO workspaces VALUES ('w', 'owner', 'Before', 'ACTIVE', '2026', '2026', 1)").run();
    original.exec('ALTER TABLE outbox ADD COLUMN claim_token TEXT');
    original.close();
    expect(() => createFoundationDatabase(file)).toThrow();
    const backups = readdirSync(dirname(file)).filter(name => name.startsWith('failed-upgrade.sqlite.pre-migration-') && name.endsWith('.sqlite'));
    expect(backups).toHaveLength(1);
    const check = new Database(file, { readonly: true, fileMustExist: true });
    try { expect(check.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 18 }); }
    finally { check.close(); }
    const restoredFile = join(dirname(file), 'restored.sqlite');
    copyFileSync(join(dirname(file), backups[0]!), restoredFile);
    const restored = new Database(restoredFile, { readonly: true, fileMustExist: true });
    try {
      expect(restored.prepare("SELECT name FROM workspaces WHERE workspace_id = 'w'").get()).toEqual({ name: 'Before' });
      expect(restored.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 18 });
    } finally { restored.close(); }
  });
  test('creates and repeats foundation migration without changing its version', () => {
    const db = new Database(pathFor('foundation.sqlite')); applyMigrations(db); applyMigrations(db);
    expect(db.prepare('select version from schema_migrations').all()).toEqual(Array.from({ length: 21 }, (_, index) => ({ version: index + 1 })));
    expect(db.prepare("select name from sqlite_master where type = 'table' and name = 'workspaces'").get()).toBeTruthy(); db.close();
  });
  test('rolls back a failed migration and leaves the prior schema usable', () => {
    const db = new Database(':memory:'); applyMigrations(db);
    expect(() => applyMigrations(db, [{ version: 22, name: 'bad', sql: 'create table impossible (;' }])).toThrow();
    expect(db.prepare('select version from schema_migrations').all()).toEqual(Array.from({ length: 21 }, (_, index) => ({ version: index + 1 })));
    expect(db.prepare('select count(*) as count from workspaces').get()).toEqual({ count: 0 }); db.close();
  });
});
