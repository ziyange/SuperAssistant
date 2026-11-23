import Database from 'better-sqlite3';
import { chmodSync, closeSync, existsSync, lstatSync, mkdtempSync, openSync, realpathSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import process from 'node:process';
import { applyMigrations, foundationMigrations, hashMigrationBackup, type MigrationBackup } from './migration-runner.js';

// eslint-disable-next-line no-unused-vars -- parameter names document the injected backup boundary.
type DatabaseOptions = { backup?: (database: Database.Database, destination: string) => void; configureJournalMode?: (database: Database.Database) => unknown; preparedBackupPath?: string; requirePreparedBackup?: boolean; expectedDataVersion?: number };

export function createFoundationDatabase(path: string, options: DatabaseOptions = {}): Database.Database {
  return initializeFoundationDatabase(new Database(path), path, options);
}

function initializeFoundationDatabase(database: Database.Database, path: string, options: DatabaseOptions): Database.Database {
  const persistent = path !== ':memory:' && path !== '';
  try {
    const configureJournal = () => {
      const mode = options.configureJournalMode ? options.configureJournalMode(database) : database.pragma('journal_mode = WAL', { simple: true });
      if (persistent && mode !== 'wal') throw new Error('MIGRATION_WAL_UNAVAILABLE');
    };
    const hasMigrations = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get();
    const applied = hasMigrations ? new Set((database.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(row => row.version)) : new Set<number>();
    let backupDataVersion: number | undefined;
    let backupContext: MigrationBackup | undefined;
    if (persistent && foundationMigrations.some(migration => !applied.has(migration.version))) {
      backupDataVersion = options.expectedDataVersion ?? database.pragma('data_version', { simple: true }) as number;
      if (!Number.isSafeInteger(backupDataVersion)) throw new Error('MIGRATION_DATA_VERSION_UNAVAILABLE');
      if (database.pragma('data_version', { simple: true }) !== backupDataVersion) throw new Error('MIGRATION_DATABASE_CHANGED');
      if (options.requirePreparedBackup && !options.preparedBackupPath) throw new Error('MIGRATION_BACKUP_REQUIRED');
      if (options.preparedBackupPath && options.backup) throw new Error('MIGRATION_BACKUP_INVALID');
      const destination = options.preparedBackupPath ?? `${path}.pre-migration-${randomUUID()}.sqlite`;
      if (!options.preparedBackupPath) {
        const backup = options.backup ?? ((source: Database.Database, target: string) => { source.prepare('VACUUM INTO ?').run(target); });
        backup(database, destination);
      }
      if (!existsSync(destination) || statSync(destination).size === 0) throw new Error('Migration backup is missing.');
      backupContext = { backupPath: destination, dataVersion: backupDataVersion, fileDigest: hashMigrationBackup(destination) };
    }
    database.pragma('foreign_keys = ON');
    database.pragma('busy_timeout = 5000');
    if (backupDataVersion === undefined) {
      configureJournal();
      applyMigrations(database);
    }
    else if (foundationMigrations.some(migration => !applied.has(migration.version) && migration.mode === 'controlled-rebuild')) {
      applyMigrations(database, foundationMigrations, backupContext);
      try { configureJournal(); } catch { throw new Error('MIGRATION_COMMITTED_CONFIGURATION_FAILED'); }
    } else {
      database.exec('BEGIN EXCLUSIVE');
      try {
        if (database.pragma('data_version', { simple: true }) !== backupDataVersion) throw new Error('MIGRATION_DATABASE_CHANGED');
        applyMigrations(database);
        database.exec('COMMIT');
      } catch (error) {
        if (database.inTransaction) database.exec('ROLLBACK');
        throw error;
      }
      try { configureJournal(); } catch { throw new Error('MIGRATION_COMMITTED_CONFIGURATION_FAILED'); }
    }
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

/** Reserve only a new file; never overwrite a pre-existing backup target. */
export function reserveMigrationBackup(directory: string): string {
  const target = join(directory, 'backup.sqlite');
  const descriptor = openSync(target, 'wx', 0o600);
  closeSync(descriptor);
  return target;
}

/** Production opener: use SQLite online backup to preserve rowids and WAL state. */
export async function createFoundationDatabaseAsync(path: string): Promise<Database.Database> {
  if (path === ':memory:' || path === '') return createFoundationDatabase(path);
  const source = new Database(path);
  let destination: string | undefined;
  let handedOff = false;
  try {
    const baseline = source.pragma('data_version', { simple: true });
    if (typeof baseline !== 'number' || !Number.isSafeInteger(baseline)) throw new Error('MIGRATION_DATA_VERSION_UNAVAILABLE');
    const hasMigrations = source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
    const applied = hasMigrations ? new Set((source.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(row => row.version)) : new Set<number>();
    if (foundationMigrations.some(migration => !applied.has(migration.version))) {
      const parent = realpathSync(dirname(path));
      const directory = mkdtempSync(join(parent, `${basename(path)}.pre-migration-`));
      chmodSync(directory, 0o700);
      const actualDirectory = realpathSync(directory);
      const equalPath = (left: string, right: string) => process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
      if (lstatSync(directory).isSymbolicLink() || !equalPath(dirname(actualDirectory), parent)) throw new Error('MIGRATION_BACKUP_INVALID');
      destination = reserveMigrationBackup(actualDirectory);
      const reserved = statSync(destination, { bigint: true });
      const deadline = globalThis.performance.now() + 30_000;
      await source.backup(destination, { progress: () => {
        if (globalThis.performance.now() >= deadline) throw new Error('MIGRATION_BACKUP_TIMEOUT');
        return 256;
      } });
      if (globalThis.performance.now() >= deadline) throw new Error('MIGRATION_BACKUP_TIMEOUT');
      const actual = statSync(destination, { bigint: true });
      if (lstatSync(destination).isSymbolicLink() || reserved.dev !== actual.dev || reserved.ino !== actual.ino
        || !equalPath(dirname(realpathSync(destination)), actualDirectory)) throw new Error('MIGRATION_BACKUP_INVALID');
      if (source.pragma('data_version', { simple: true }) !== baseline) throw new Error('MIGRATION_DATABASE_CHANGED');
    }
    const result = initializeFoundationDatabase(source, path, {
      ...(destination ? { preparedBackupPath: destination, expectedDataVersion: baseline } : {}),
      requirePreparedBackup: true
    });
    handedOff = true;
    return result;
  } finally { if (!handedOff && source.open) source.close(); }
}
