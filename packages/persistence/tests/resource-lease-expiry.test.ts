import { expect, test } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteResourceLeaseRepository } from '../src/repositories/resource-lease-repository.js';
import { applyMigrations, foundationMigrations } from '../src/sqlite/migration-runner.js';
import Database from 'better-sqlite3';

const start = '2026-08-13T00:00:00.000Z';
const identity = { leaseId: 'lease-1', attemptId: 'attempt-1', fencingToken: 1 };
function fixture(path = ':memory:') {
  const db = createFoundationDatabase(path);
  db.pragma('foreign_keys = OFF');
  db.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-1', 'request-1', 'key-1', 'RUNNING', 0, ?)").run(start);
  db.pragma('foreign_keys = ON');
  return db;
}

test('new leases persist a 30-second window and renew only before expiry', () => {
  const db = fixture();
  try {
    let now = start;
    const repo = new SqliteResourceLeaseRepository(db, () => now);
    expect(typeof repo.canWrite).toBe('function');
    expect(typeof repo.renew).toBe('function');
    repo.acquire({ ...identity, resourceKey: 'project:p', createdAt: start });
    expect(db.prepare("SELECT renewed_at, expires_at FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ renewed_at: start, expires_at: '2026-08-13T00:00:30.000Z' });
    expect(repo.canWrite(identity)).toBe(true);
    now = '2026-08-13T00:00:10.000Z';
    expect(repo.renew(identity)).toBe(true);
    expect(db.prepare("SELECT renewed_at, expires_at FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ renewed_at: now, expires_at: '2026-08-13T00:00:40.000Z' });
    now = '2026-08-13T00:00:40.000Z';
    expect(repo.canWrite(identity)).toBe(false);
    expect(repo.renew(identity)).toBe(false);
    expect(() => repo.acquire({ leaseId: 'other', attemptId: 'attempt-1', resourceKey: 'project:p', fencingToken: 2, createdAt: now })).toThrow('RESOURCE_LEASE_BUSY');
  } finally { db.close(); }
});

test('wrong owners, tokens, rollback clocks and released leases cannot renew or write', () => {
  const db = fixture();
  try {
    let now = start;
    const repo = new SqliteResourceLeaseRepository(db, () => now);
    expect(typeof repo.canWrite).toBe('function');
    repo.acquire({ ...identity, resourceKey: 'project:p', createdAt: start });
    expect(repo.canWrite({ ...identity, attemptId: 'other' })).toBe(false);
    expect(repo.renew({ ...identity, fencingToken: 2 })).toBe(false);
    now = '2026-08-12T23:59:59.999Z';
    expect(repo.canWrite(identity)).toBe(false);
    expect(repo.renew(identity)).toBe(false);
    now = 'invalid';
    expect(repo.canWrite(identity)).toBe(false);
    expect(repo.renew(identity)).toBe(false);
    now = '2026-08-13T00:00:01.000Z';
    expect(repo.release('lease-1', 1, now)).toBe(true);
    expect(repo.canWrite(identity)).toBe(false);
    expect(repo.renew(identity)).toBe(false);
  } finally { db.close(); }
});

test('legacy null deadlines deny writes and remain blocking after reopen', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-lease-expiry-'));
  const path = join(folder, 'control.sqlite');
  try {
    const first = fixture(path);
    first.prepare("INSERT INTO resource_leases (lease_id, resource_key, attempt_id, fencing_token, state, created_at, released_at) VALUES ('lease-1', 'project:p', 'attempt-1', 1, 'ACTIVE', ?, NULL)").run(start);
    first.close();
    const reopened = createFoundationDatabase(path);
    try {
      const repo = new SqliteResourceLeaseRepository(reopened, () => start);
      expect(typeof repo.canWrite).toBe('function');
      expect(repo.canWrite(identity)).toBe(false);
      expect(repo.renew(identity)).toBe(false);
      expect(() => repo.acquire({ leaseId: 'other', attemptId: 'attempt-1', resourceKey: 'project:p', fencingToken: 2, createdAt: start })).toThrow('RESOURCE_LEASE_BUSY');
    } finally { reopened.close(); }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('version-19 active leases migrate without invented expiry and retain a restorable backup', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-lease-upgrade-'));
  const path = join(folder, 'legacy.sqlite');
  try {
    const old = new Database(path);
    applyMigrations(old, foundationMigrations.filter(migration => migration.version <= 19));
    old.pragma('foreign_keys = OFF');
    old.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-1', 'request-1', 'key-1', 'RUNNING', 0, ?)").run(start);
    old.prepare("INSERT INTO resource_leases VALUES ('lease-1', 'project:p', 'attempt-1', 1, 'ACTIVE', ?, NULL)").run(start);
    old.close();
    const upgraded = createFoundationDatabase(path);
    try {
      expect(upgraded.prepare("SELECT state, renewed_at, expires_at FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ state: 'ACTIVE', renewed_at: null, expires_at: null });
      expect(new SqliteResourceLeaseRepository(upgraded, () => start).canWrite(identity)).toBe(false);
      const backups = readdirSync(folder).filter(name => name.startsWith('legacy.sqlite.pre-migration-'));
      expect(backups).toHaveLength(1);
      const backup = new Database(join(folder, backups[0]!), { readonly: true, fileMustExist: true });
      try {
        expect(backup.prepare('SELECT max(version) AS version FROM schema_migrations').get()).toEqual({ version: 19 });
        expect(backup.prepare("SELECT state FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ state: 'ACTIVE' });
        expect(backup.pragma('integrity_check', { simple: true })).toBe('ok');
      } finally { backup.close(); }
    } finally { upgraded.close(); }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('a new lease retains its fencing window across database reopen', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-lease-reopen-'));
  const path = join(folder, 'control.sqlite');
  try {
    const db = fixture(path);
    new SqliteResourceLeaseRepository(db, () => start).acquire({ ...identity, resourceKey: 'project:p', createdAt: start });
    db.close();
    const reopened = createFoundationDatabase(path);
    try {
      expect(new SqliteResourceLeaseRepository(reopened, () => '2026-08-13T00:00:29.999Z').canWrite(identity)).toBe(true);
      expect(new SqliteResourceLeaseRepository(reopened, () => '2026-08-13T00:00:30.000Z').canWrite(identity)).toBe(false);
    } finally { reopened.close(); }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('an observed expiry remains denied after clock rollback and database reopen', () => {
  const folder = mkdtempSync(join(tmpdir(), 'sa-lease-clock-'));
  const path = join(folder, 'control.sqlite');
  try {
    const db = fixture(path);
    let now = start;
    const repo = new SqliteResourceLeaseRepository(db, () => now);
    repo.acquire({ ...identity, resourceKey: 'project:p', createdAt: start });
    now = '2026-08-13T00:00:30.000Z';
    expect(repo.canWrite(identity)).toBe(false);
    db.close();
    const reopened = createFoundationDatabase(path);
    try {
      now = '2026-08-13T00:00:29.000Z';
      const afterRestart = new SqliteResourceLeaseRepository(reopened, () => now);
      expect(afterRestart.canWrite(identity)).toBe(false);
      expect(afterRestart.renew(identity)).toBe(false);
      expect(reopened.prepare("SELECT last_observed_at FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ last_observed_at: '2026-08-13T00:00:30.000Z' });
    } finally { reopened.close(); }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
