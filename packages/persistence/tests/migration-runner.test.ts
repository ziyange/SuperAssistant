import { afterEach, describe, expect, test } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { applyMigrations } from '../src/sqlite/migration-runner.js';

const folders: string[] = [];
afterEach(() => folders.splice(0).forEach((folder) => rmSync(folder, { recursive: true, force: true })));
function pathFor(name: string): string { const folder = mkdtempSync(join(tmpdir(), 'sa-migration-')); folders.push(folder); return join(folder, name); }

describe('migration runner', () => {
  test('creates and repeats foundation migration without changing its version', () => {
    const db = new Database(pathFor('foundation.sqlite')); applyMigrations(db); applyMigrations(db);
    expect(db.prepare('select version from schema_migrations').all()).toEqual([{ version: 1 }, { version: 2 }]);
    expect(db.prepare("select name from sqlite_master where type = 'table' and name = 'workspaces'").get()).toBeTruthy(); db.close();
  });
  test('rolls back a failed migration and leaves the prior schema usable', () => {
    const db = new Database(':memory:'); applyMigrations(db);
    expect(() => applyMigrations(db, [{ version: 3, name: 'bad', sql: 'create table impossible (;' }])).toThrow();
    expect(db.prepare('select version from schema_migrations').all()).toEqual([{ version: 1 }, { version: 2 }]);
    expect(db.prepare('select count(*) as count from workspaces').get()).toEqual({ count: 0 }); db.close();
  });
});
