/* eslint-disable no-unused-vars -- database port parameter names are public contract vocabulary. */
export const TEAM_AUTHORITY_SCHEMA = [
  'create table if not exists team_workspace_records (workspace_id text primary key, name text not null, owner_actor text not null)',
  'create table if not exists team_workspace_events (event_id text primary key, workspace_id text not null references team_workspace_records(workspace_id), sequence bigint not null, event_type text not null, payload jsonb not null, unique(workspace_id, sequence))',
  'create table if not exists team_sessions (session_ref text primary key, actor text not null, workspace_id text not null references team_workspace_records(workspace_id), expires_at bigint not null, revoked_at bigint)',
  'create table if not exists team_memberships (workspace_id text not null references team_workspace_records(workspace_id), subject text not null, role text not null, primary key (workspace_id, subject))',
  'create table if not exists team_role_assignments (workspace_id text not null references team_workspace_records(workspace_id), actor text not null, role text not null, primary key (workspace_id, actor, role))',
  'create table if not exists team_credential_references (credential_ref text primary key, owner_actor text not null, workspace_id text not null references team_workspace_records(workspace_id), rotation_due_at bigint not null, revoked_at bigint)',
  'create table if not exists team_approval_policies (proposal_digest text primary key, workspace_id text not null references team_workspace_records(workspace_id), policy_version text not null, requester text not null, eligible_approvers jsonb not null, quorum integer not null check (quorum > 0))',
  'create table if not exists team_approval_records (proposal_digest text not null references team_approval_policies(proposal_digest), approver text not null, approved_at bigint not null, primary key (proposal_digest, approver))',
  'create table if not exists team_grants (grant_ref text primary key, workspace_id text not null references team_workspace_records(workspace_id), requester text not null, proposal_digest text not null unique references team_approval_policies(proposal_digest), approvers jsonb not null, issued_at bigint not null, consumed_at bigint)',
  'create table if not exists team_governed_records (record_id text primary key, workspace_id text not null references team_workspace_records(workspace_id), record_class text not null, payload text not null, expires_at bigint not null, state_known boolean not null default true, deleted_at bigint)',
  'create table if not exists team_legal_holds (record_id text primary key references team_governed_records(record_id), workspace_id text not null references team_workspace_records(workspace_id), active boolean not null, reason text not null)',
  'create table if not exists team_retention_dry_runs (record_id text not null references team_governed_records(record_id), policy_version text not null, actor text not null, executed_at bigint not null, primary key (record_id, policy_version))',
  'create table if not exists team_retention_audit (audit_id text primary key, record_id text not null references team_governed_records(record_id), workspace_id text not null references team_workspace_records(workspace_id), authorization_ref text not null, actor text not null, action text not null, executed_at bigint not null)',
  'create table if not exists team_retention_grants (grant_ref text primary key, workspace_id text not null references team_workspace_records(workspace_id), record_id text not null references team_governed_records(record_id), policy_version text not null, actor text not null, expires_at bigint not null, consumed_at bigint)',
  'create table if not exists team_notification_outbox (idempotency_key text primary key, workspace_id text not null references team_workspace_records(workspace_id), principal text not null, priority text not null check (priority in (\'NORMAL\', \'EMERGENCY\')), aggregate_key text, target_ref text not null, attempts integer not null default 0 check (attempts >= 0), claimed_at bigint, delivered_at bigint, delivery_started_at bigint)',
  'alter table team_notification_outbox add column if not exists delivery_started_at bigint',
  'create table if not exists team_notification_reconciliations (event_id text primary key, idempotency_key text not null references team_notification_outbox(idempotency_key), generation integer not null, outcome text not null check (outcome in (\'DELIVERED\', \'FINAL_NOT_DELIVERED\')), evidence_ref text not null, recorded_at bigint not null)'
] as const;

export interface TeamSchemaDatabase { query(text: string): Promise<unknown> }

export async function initializeIntegratedTeamSchema(database: TeamSchemaDatabase): Promise<void> {
  for (const statement of TEAM_AUTHORITY_SCHEMA) await database.query(statement);
}
