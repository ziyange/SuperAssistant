import Database from 'better-sqlite3';
import { applyMigrations } from './migration-runner.js';

export function createFoundationDatabase(path: string): Database.Database {
  const database = new Database(path);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.pragma('busy_timeout = 5000');
  applyMigrations(database);
  return database;
}
