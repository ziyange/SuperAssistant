import { createHash } from 'node:crypto';
import process from 'node:process';
import { expect, test } from 'vitest';
import { Pool } from 'pg';
import { initializeTeamAuthoritySchema, PostgresTeamSql, TeamAuthorityMigration, type TeamSql } from '../src/migration.js';

class MemoryTeamSql implements TeamSql {
  readonly workspaces = new Map<string, string>();
  readonly audit = new Map<string, string>();
  async execute(statement: string, values: readonly string[]): Promise<void> {
    if (statement === 'workspace') this.workspaces.set(values[0]!, values[1]!);
    if (statement === 'audit') this.audit.set(values[0]!, values[1]!);
  }
  async count(table: 'workspace' | 'audit'): Promise<number> {
    return table === 'workspace' ? this.workspaces.size : this.audit.size;
  }
  async digest(table: 'workspace' | 'audit'): Promise<string> {
    const source = table === 'workspace' ? this.workspaces : this.audit;
    return createHash('sha256').update([...source.entries()].sort().map(([id, value]) => `${id}:${value}`).join('|')).digest('hex');
  }
}

test('imports a local Workspace once, validates counts and hashes, then cuts over one authority', async () => {
  const team = new MemoryTeamSql();
  const migration = new TeamAuthorityMigration(team, {
    workspaceId: 'workspace-1',
    workspacePayload: '{"id":"workspace-1"}',
    audit: [{ id: 'audit-1', payload: '{"event":"created"}' }]
  });

  await migration.backupLocal();
  await migration.importToTeam();
  await migration.importToTeam();
  await migration.validate();
  migration.cutover();

  expect(migration.status()).toEqual({ authority: 'TEAM', state: 'CUT_OVER' });
  expect(await team.count('workspace')).toBe(1);
  expect(await team.count('audit')).toBe(1);
});

test('refuses cutover before validation and restores local authority after mismatch', async () => {
  const team = new MemoryTeamSql();
  const migration = new TeamAuthorityMigration(team, {
    workspaceId: 'workspace-2',
    workspacePayload: '{"id":"workspace-2"}',
    audit: [{ id: 'audit-2', payload: '{"event":"created"}' }]
  });

  await migration.backupLocal();
  await migration.importToTeam();
  expect(() => migration.cutover()).toThrow('TEAM_MIGRATION_NOT_VALIDATED');
  team.audit.set('audit-2', '{"event":"tampered"}');
  await expect(migration.validate()).rejects.toThrow('TEAM_MIGRATION_VALIDATION_FAILED');
  migration.rollback();

  expect(migration.status()).toEqual({ authority: 'LOCAL', state: 'ROLLED_BACK' });
});

test('PostgreSQL adapter uses idempotent inserts and hashes rows outside database extensions', async () => {
  const calls: { text: string; values?: readonly unknown[] }[] = [];
  const pool = {
    query: async <Row>(text: string, values?: readonly unknown[]) => {
      calls.push({ text, ...(values === undefined ? {} : { values }) });
      const rows: Row[] = text.includes('team_workspaces') && text.startsWith('select')
        ? [{ id: 'workspace-1', payload: '{"id":"workspace-1"}' } as Row]
        : [];
      return { rows };
    }
  };
  const team = new PostgresTeamSql(pool as never);

  await team.execute('workspace', ['workspace-1', '{"id":"workspace-1"}']);
  expect(calls[0]?.text).toContain('on conflict (workspace_id) do update');
  expect(await team.digest('workspace')).toBe(createHash('sha256').update('workspace-1:{"id":"workspace-1"}').digest('hex'));
});

const databaseUrl = process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL;

test.runIf(databaseUrl !== undefined)('rehearses import, cutover and failed validation against disposable PostgreSQL', async () => {
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await initializeTeamAuthoritySchema(pool);
    await pool.query('truncate table team_audit, team_workspaces');
    const migration = new TeamAuthorityMigration(new PostgresTeamSql(pool), {
      workspaceId: 'workspace-live',
      workspacePayload: '{"id":"workspace-live"}',
      audit: [{ id: 'audit-live', payload: '{"event":"created"}' }]
    });
    await migration.backupLocal();
    await migration.importToTeam();
    await migration.validate();
    migration.cutover();
    expect(migration.status()).toEqual({ authority: 'TEAM', state: 'CUT_OVER' });

    await pool.query('update team_audit set payload = $1 where audit_id = $2', ['{"event":"tampered"}', 'audit-live']);
    const restore = new TeamAuthorityMigration(new PostgresTeamSql(pool), {
      workspaceId: 'workspace-live',
      workspacePayload: '{"id":"workspace-live"}',
      audit: [{ id: 'audit-live', payload: '{"event":"created"}' }]
    });
    await restore.backupLocal();
    await restore.importToTeam();
    await pool.query('update team_audit set payload = $1 where audit_id = $2', ['{"event":"tampered"}', 'audit-live']);
    await expect(restore.validate()).rejects.toThrow('TEAM_MIGRATION_VALIDATION_FAILED');
    restore.rollback();
    expect(restore.status()).toEqual({ authority: 'LOCAL', state: 'ROLLED_BACK' });
  } finally {
    await pool.query('drop table if exists team_audit, team_workspaces');
    await pool.end();
  }
});
