/* eslint-disable no-unused-vars -- TypeScript interface parameters are public port vocabulary. */
import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

export interface TeamSql {
  execute(statement: 'workspace' | 'audit', values: readonly string[]): Promise<void>;
  count(table: 'workspace' | 'audit'): Promise<number>;
  digest(table: 'workspace' | 'audit'): Promise<string>;
}

export class PostgresTeamSql implements TeamSql {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}
  async execute(statement: 'workspace' | 'audit', values: readonly string[]): Promise<void> {
    const text = statement === 'workspace'
      ? 'insert into team_workspaces (workspace_id, payload) values ($1, $2) on conflict (workspace_id) do update set payload = excluded.payload'
      : 'insert into team_audit (audit_id, payload) values ($1, $2) on conflict (audit_id) do update set payload = excluded.payload';
    await this.pool.query(text, [...values]);
  }
  async count(table: 'workspace' | 'audit'): Promise<number> {
    const result = await this.pool.query<{ count: string }>(`select count(*)::text as count from ${table === 'workspace' ? 'team_workspaces' : 'team_audit'}`);
    return Number(result.rows[0]?.count ?? '0');
  }
  async digest(table: 'workspace' | 'audit'): Promise<string> {
    const source = table === 'workspace'
      ? 'select workspace_id as id, payload from team_workspaces order by workspace_id'
      : 'select audit_id as id, payload from team_audit order by audit_id';
    const result = await this.pool.query<{ id: string; payload: string }>(source);
    return createHash('sha256').update(result.rows.map(row => `${row.id}:${row.payload}`).join('|')).digest('hex');
  }
}

export async function initializeTeamAuthoritySchema(pool: Pick<Pool, 'query'>): Promise<void> {
  await pool.query('create table if not exists team_workspaces (workspace_id text primary key, payload text not null)');
  await pool.query('create table if not exists team_audit (audit_id text primary key, payload text not null)');
}

export interface LocalWorkspaceExport {
  workspaceId: string;
  workspacePayload: string;
  audit: readonly { id: string; payload: string }[];
}

type MigrationState = 'LOCAL_READY' | 'IMPORTED' | 'VALIDATED' | 'CUT_OVER' | 'ROLLED_BACK';

function localDigest(entries: readonly { id: string; payload: string }[]): string {
  return createHash('sha256').update([...entries].sort((left, right) => left.id.localeCompare(right.id)).map(entry => `${entry.id}:${entry.payload}`).join('|')).digest('hex');
}

export class TeamAuthorityMigration {
  private state: MigrationState = 'LOCAL_READY';
  private backupCreated = false;
  constructor(private readonly team: TeamSql, private readonly source: LocalWorkspaceExport) {}

  async backupLocal(): Promise<void> {
    if (this.state !== 'LOCAL_READY') throw new Error('TEAM_MIGRATION_BACKUP_ORDER');
    this.backupCreated = true;
  }

  async importToTeam(): Promise<void> {
    if (!this.backupCreated) throw new Error('TEAM_MIGRATION_BACKUP_REQUIRED');
    if (this.state !== 'LOCAL_READY' && this.state !== 'IMPORTED') throw new Error('TEAM_MIGRATION_IMPORT_ORDER');
    await this.team.execute('workspace', [this.source.workspaceId, this.source.workspacePayload]);
    for (const record of this.source.audit) await this.team.execute('audit', [record.id, record.payload]);
    this.state = 'IMPORTED';
  }

  async validate(): Promise<void> {
    if (this.state !== 'IMPORTED') throw new Error('TEAM_MIGRATION_VALIDATE_ORDER');
    const auditMatches = await this.team.count('audit') === this.source.audit.length && await this.team.digest('audit') === localDigest(this.source.audit);
    const workspaceMatches = await this.team.count('workspace') === 1 && await this.team.digest('workspace') === localDigest([{ id: this.source.workspaceId, payload: this.source.workspacePayload }]);
    if (!auditMatches || !workspaceMatches) throw new Error('TEAM_MIGRATION_VALIDATION_FAILED');
    this.state = 'VALIDATED';
  }

  cutover(): void {
    if (this.state !== 'VALIDATED') throw new Error('TEAM_MIGRATION_NOT_VALIDATED');
    this.state = 'CUT_OVER';
  }

  rollback(): void {
    if (this.state === 'CUT_OVER') throw new Error('TEAM_MIGRATION_ROLLBACK_AFTER_CUTOVER_FORBIDDEN');
    this.state = 'ROLLED_BACK';
  }

  status(): Readonly<{ authority: 'LOCAL' | 'TEAM'; state: MigrationState }> {
    return this.state === 'CUT_OVER' ? { authority: 'TEAM', state: this.state } : { authority: 'LOCAL', state: this.state };
  }
}
