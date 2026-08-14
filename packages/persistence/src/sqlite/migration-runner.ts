/* global URL */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';

export interface Migration { version: number; name: string; sql: string; }
const foundationSql = readFileSync(fileURLToPath(new URL('./migrations/001-foundation.sql', import.meta.url)), 'utf8');
const projectMetadataSql = readFileSync(fileURLToPath(new URL('./migrations/002-project-metadata.sql', import.meta.url)), 'utf8');
const proposalAuthorizationSql = readFileSync(fileURLToPath(new URL('./migrations/003-proposal-authorization.sql', import.meta.url)), 'utf8');
const executionSql = readFileSync(fileURLToPath(new URL('./migrations/004-execution.sql', import.meta.url)), 'utf8');
export const foundationMigrations: readonly Migration[] = [{ version: 1, name: 'foundation', sql: foundationSql }, { version: 2, name: 'project-metadata', sql: projectMetadataSql }, { version: 3, name: 'proposal-authorization', sql: proposalAuthorizationSql }, { version: 4, name: 'execution', sql: executionSql }];

export function applyMigrations(database: Database.Database, migrations: readonly Migration[] = foundationMigrations): void {
  database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)');
  const applied = new Set((database.prepare('SELECT version FROM schema_migrations').all() as Array<{ version: number }>).map(({ version }) => version));
  for (const migration of migrations.filter(({ version }) => !applied.has(version)).sort((left, right) => left.version - right.version)) {
    const apply = database.transaction(() => {
      database.exec(migration.sql);
      database.prepare('INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)').run(migration.version, migration.name, new Date().toISOString());
    });
    apply();
  }
}
