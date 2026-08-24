/* eslint-disable no-unused-vars -- database port parameter names are public contract vocabulary. */
export const TEAM_AUTHORITY_SCHEMA = [
  'create table if not exists team_workspace_records (workspace_id text primary key, name text not null, owner_actor text not null)',
  'create table if not exists team_workspace_events (event_id text primary key, workspace_id text not null references team_workspace_records(workspace_id), sequence bigint not null, event_type text not null, payload jsonb not null, unique(workspace_id, sequence))'
] as const;

export interface TeamSchemaDatabase { query(text: string): Promise<unknown> }

export async function initializeIntegratedTeamSchema(database: TeamSchemaDatabase): Promise<void> {
  for (const statement of TEAM_AUTHORITY_SCHEMA) await database.query(statement);
}
