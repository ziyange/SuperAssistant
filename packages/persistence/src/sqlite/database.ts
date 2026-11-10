import Database from 'better-sqlite3';
import { existsSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { applyMigrations, foundationMigrations } from './migration-runner.js';

// eslint-disable-next-line no-unused-vars -- parameter names document the injected backup boundary.
type DatabaseOptions = { backup?: (database: Database.Database, destination: string) => void };

export function createFoundationDatabase(path: string, options: DatabaseOptions = {}): Database.Database {
  const persistent = path !== ':memory:' && path !== '';
  const database = new Database(path);
  try {
    const hasMigrations = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get();
    const applied = hasMigrations ? new Set((database.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(row => row.version)) : new Set<number>();
    let backupDataVersion: number | undefined;
    if (persistent && foundationMigrations.some(migration => !applied.has(migration.version))) {
      backupDataVersion = database.pragma('data_version', { simple: true }) as number;
      if (!Number.isSafeInteger(backupDataVersion)) throw new Error('MIGRATION_DATA_VERSION_UNAVAILABLE');
      const destination = `${path}.pre-migration-${randomUUID()}.sqlite`;
      const backup = options.backup ?? ((source: Database.Database, target: string) => { source.prepare('VACUUM INTO ?').run(target); });
      backup(database, destination);
      if (!existsSync(destination) || statSync(destination).size === 0) throw new Error('Migration backup is missing.');
    }
    database.pragma('foreign_keys = ON');
    database.pragma('busy_timeout = 5000');
    if (backupDataVersion === undefined) {
      database.pragma('journal_mode = WAL');
      applyMigrations(database);
    }
    else {
      database.exec('BEGIN EXCLUSIVE');
      try {
        if (database.pragma('data_version', { simple: true }) !== backupDataVersion) throw new Error('MIGRATION_DATABASE_CHANGED');
        applyMigrations(database);
        database.exec('COMMIT');
      } catch (error) {
        if (database.inTransaction) database.exec('ROLLBACK');
        throw error;
      }
      database.pragma('journal_mode = WAL');
    }
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
