/* eslint-disable no-unused-vars -- repository constructor parameter is public contract vocabulary. */
import type { TeamQuery } from './team-transaction.js';

export interface TeamWorkspaceRecord { workspaceId: string; name: string; ownerActor: string }
export interface TeamWorkspaceEvent { eventId: string; workspaceId: string; sequence: number; eventType: string; payload: Readonly<Record<string, unknown>> }
export interface TeamSessionRecord { sessionRef: string; actor: string; workspaceId: string; expiresAt: number; revokedAt?: number }
export interface TeamMembershipRecord { workspaceId: string; subject: string; role: string }

export class PostgresTeamRepository {
  constructor(private readonly database: TeamQuery) {}
  async createWorkspace(record: TeamWorkspaceRecord): Promise<void> {
    await this.database.query('insert into team_workspace_records (workspace_id, name, owner_actor) values ($1, $2, $3) on conflict (workspace_id) do nothing', [record.workspaceId, record.name, record.ownerActor]);
  }
  async getWorkspace(workspaceId: string): Promise<TeamWorkspaceRecord | undefined> {
    const result = await this.database.query('select workspace_id as "workspaceId", name, owner_actor as "ownerActor" from team_workspace_records where workspace_id = $1', [workspaceId]);
    return result.rows[0] as TeamWorkspaceRecord | undefined;
  }
  async listEvents(workspaceId: string): Promise<readonly TeamWorkspaceEvent[]> {
    const result = await this.database.query('select event_id as "eventId", workspace_id as "workspaceId", sequence, event_type as "eventType", payload from team_workspace_events where workspace_id = $1 order by sequence', [workspaceId]);
    return result.rows as TeamWorkspaceEvent[];
  }
  async createSession(record: TeamSessionRecord): Promise<void> { await this.database.query('insert into team_sessions (session_ref, actor, workspace_id, expires_at) values ($1, $2, $3, $4) on conflict (session_ref) do nothing', [record.sessionRef, record.actor, record.workspaceId, record.expiresAt]); }
  async revokeSession(sessionRef: string): Promise<void> { await this.database.query('update team_sessions set revoked_at = extract(epoch from clock_timestamp())::bigint where session_ref = $1', [sessionRef]); }
  async getSession(sessionRef: string): Promise<TeamSessionRecord | undefined> { const result = await this.database.query('select session_ref as "sessionRef", actor, workspace_id as "workspaceId", expires_at as "expiresAt", revoked_at as "revokedAt" from team_sessions where session_ref = $1', [sessionRef]); return result.rows[0] as TeamSessionRecord | undefined; }
  async addMembership(record: TeamMembershipRecord): Promise<void> { await this.database.query('insert into team_memberships (workspace_id, subject, role) values ($1, $2, $3) on conflict (workspace_id, subject) do update set role = excluded.role', [record.workspaceId, record.subject, record.role]); }
  async listMemberships(workspaceId: string): Promise<readonly TeamMembershipRecord[]> { const result = await this.database.query('select workspace_id as "workspaceId", subject, role from team_memberships where workspace_id = $1 order by subject', [workspaceId]); return result.rows as TeamMembershipRecord[]; }
}
