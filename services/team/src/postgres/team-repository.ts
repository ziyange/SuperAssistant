/* eslint-disable no-unused-vars -- repository constructor parameter is public contract vocabulary. */
import type { TeamQuery } from './team-transaction.js';

export interface TeamWorkspaceRecord { workspaceId: string; name: string; ownerActor: string }
export interface TeamWorkspaceEvent { eventId: string; workspaceId: string; sequence: number; eventType: string; payload: Readonly<Record<string, unknown>> }

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
}
