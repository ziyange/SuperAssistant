/* eslint-disable no-unused-vars -- repository constructor parameter is public contract vocabulary. */
import { randomUUID } from 'node:crypto';
import { withinTeamTransaction, type TeamTransactionDatabase } from './team-transaction.js';
import type { TeamApprovalPolicy, TeamApprovalResult, TeamApprovalStore } from '../approval-service.js';
import type { CredentialReferenceRecord, CredentialReferenceStore } from '../credential-reference-service.js';
import type { TeamGrantConsumption, TeamGrantIssue, TeamGrantRecord, TeamGrantStore } from '../team-grant-service.js';
import type { TeamRoleAssignment, TeamRoleAssignmentStore } from '../team-authorization.js';
import type { GovernedRecord } from '../governed-record-inventory.js';
import type { GovernedRecordReader } from '../team-audit-export-service.js';
import { TeamAuditExportService } from '../team-audit-export-service.js';
import { RetentionOperationService, type RetentionOperationStore, type RetentionRecord } from '../retention-operation-service.js';
import { hasValidNotificationScope, type NotificationOutboxRow, type NotificationOutboxStore } from '../notification-outbox.js';
import { isValidNotificationTargetRef } from '../notification-policy.js';

export interface TeamWorkspaceRecord { workspaceId: string; name: string; ownerActor: string }
export interface TeamWorkspaceEvent { eventId: string; workspaceId: string; sequence: number; eventType: string; payload: Readonly<Record<string, unknown>> }
export interface TeamSessionRecord { sessionRef: string; actor: string; workspaceId: string; expiresAt: number; revokedAt?: number }
export interface TeamMembershipRecord { workspaceId: string; subject: string; role: string }

export class PostgresTeamRepository implements TeamRoleAssignmentStore, CredentialReferenceStore, TeamGrantStore, TeamApprovalStore, GovernedRecordReader, RetentionOperationStore, NotificationOutboxStore {
  constructor(private readonly database: TeamTransactionDatabase, private readonly now: () => number = () => Date.now()) {}
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
  async getSession(sessionRef: string): Promise<TeamSessionRecord | undefined> {
    const result = await this.database.query('select session_ref as "sessionRef", actor, workspace_id as "workspaceId", expires_at as "expiresAt", revoked_at as "revokedAt" from team_sessions where session_ref = $1', [sessionRef]);
    const row = result.rows[0] as (Omit<TeamSessionRecord, 'expiresAt' | 'revokedAt'> & { expiresAt: number | string; revokedAt: number | string | null }) | undefined;
    if (row === undefined) return undefined;
    const expiresAt = Number(row.expiresAt);
    const revokedAt = row.revokedAt == null ? undefined : Number(row.revokedAt);
    if (!Number.isSafeInteger(expiresAt) || (revokedAt !== undefined && !Number.isSafeInteger(revokedAt))) throw new Error('TEAM_SESSION_INVALID');
    return { sessionRef: row.sessionRef, actor: row.actor, workspaceId: row.workspaceId, expiresAt, ...(revokedAt === undefined ? {} : { revokedAt }) };
  }
  async insert(row: NotificationOutboxRow): Promise<boolean> {
    if (!hasValidNotificationScope(row)) throw new Error('NOTIFICATION_SCOPE_INVALID');
    if (!isValidNotificationTargetRef(row.targetRef)) throw new Error('NOTIFICATION_TARGET_INVALID');
    const result = await this.database.query('insert into team_notification_outbox (idempotency_key, workspace_id, principal, priority, aggregate_key, target_ref, attempts) values ($1, $2, $3, $4, $5, $6, 0) on conflict (idempotency_key) do nothing returning idempotency_key', [row.idempotencyKey, row.workspaceId, row.principal, row.priority, row.aggregateKey ?? null, row.targetRef]);
    return result.rows.length === 1;
  }
  async claim(limit: number): Promise<readonly NotificationOutboxRow[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw new Error('NOTIFICATION_CLAIM_LIMIT_INVALID');
    return withinTeamTransaction(this.database, async transaction => {
      const result = await transaction.query('with selected as (select idempotency_key from team_notification_outbox where delivered_at is null and claimed_at is null order by idempotency_key for update skip locked limit $1) update team_notification_outbox item set claimed_at = extract(epoch from clock_timestamp())::bigint, attempts = item.attempts + 1 from selected where item.idempotency_key = selected.idempotency_key returning item.idempotency_key as "idempotencyKey", item.workspace_id as "workspaceId", item.principal, item.priority, item.aggregate_key as "aggregateKey", item.target_ref as "targetRef", item.attempts', [limit]);
      return (result.rows as (Omit<NotificationOutboxRow, 'aggregateKey'> & { aggregateKey: string | null })[]).map(({ aggregateKey, ...row }) => aggregateKey === null ? row : { ...row, aggregateKey });
    });
  }
  async beginDelivery(claim: NotificationOutboxRow): Promise<boolean> {
    if (!claim.idempotencyKey || !Number.isSafeInteger(claim.attempts) || claim.attempts <= 0) return false;
    const result = await this.database.query('update team_notification_outbox set delivery_started_at = extract(epoch from clock_timestamp())::bigint where idempotency_key = $1 and attempts = $2 and workspace_id = $3 and principal = $4 and target_ref = $5 and claimed_at is not null and delivery_started_at is null and delivered_at is null returning idempotency_key', [claim.idempotencyKey, claim.attempts, claim.workspaceId, claim.principal, claim.targetRef]);
    return result.rows.length === 1;
  }
  async markDelivered(claim: NotificationOutboxRow): Promise<boolean> {
    if (!claim.idempotencyKey || !Number.isSafeInteger(claim.attempts) || claim.attempts <= 0) return false;
    const result = await this.database.query('update team_notification_outbox set delivered_at = extract(epoch from clock_timestamp())::bigint where idempotency_key = $1 and attempts = $2 and workspace_id = $3 and principal = $4 and target_ref = $5 and claimed_at is not null and delivery_started_at is not null and delivered_at is null returning idempotency_key', [claim.idempotencyKey, claim.attempts, claim.workspaceId, claim.principal, claim.targetRef]);
    return result.rows.length === 1;
  }
  async reconcile(claim: NotificationOutboxRow, outcome: 'DELIVERED' | 'FINAL_NOT_DELIVERED', evidenceRef: string): Promise<boolean> {
    if (!claim.idempotencyKey || !Number.isSafeInteger(claim.attempts) || claim.attempts <= 0 || (outcome !== 'DELIVERED' && outcome !== 'FINAL_NOT_DELIVERED') || !/^evidence:\S+$/.test(evidenceRef) || evidenceRef.length > 512) return false;
    const result = await this.database.query('with changed as (update team_notification_outbox set claimed_at = case when $6 = \'FINAL_NOT_DELIVERED\' then null else claimed_at end, delivery_started_at = case when $6 = \'FINAL_NOT_DELIVERED\' then null else delivery_started_at end, delivered_at = case when $6 = \'DELIVERED\' then extract(epoch from clock_timestamp())::bigint else delivered_at end where idempotency_key = $1 and attempts = $2 and workspace_id = $3 and principal = $4 and target_ref = $5 and claimed_at is not null and delivery_started_at is not null and delivered_at is null returning idempotency_key) insert into team_notification_reconciliations (event_id, idempotency_key, generation, outcome, evidence_ref, recorded_at) select $8, idempotency_key, $2, $6, $7, extract(epoch from clock_timestamp())::bigint from changed returning event_id', [claim.idempotencyKey, claim.attempts, claim.workspaceId, claim.principal, claim.targetRef, outcome, evidenceRef, randomUUID()]);
    return result.rows.length === 1;
  }
  async addMembership(record: TeamMembershipRecord): Promise<void> { await this.database.query('insert into team_memberships (workspace_id, subject, role) values ($1, $2, $3) on conflict (workspace_id, subject) do update set role = excluded.role', [record.workspaceId, record.subject, record.role]); }
  async listMemberships(workspaceId: string): Promise<readonly TeamMembershipRecord[]> { const result = await this.database.query('select workspace_id as "workspaceId", subject, role from team_memberships where workspace_id = $1 order by subject', [workspaceId]); return result.rows as TeamMembershipRecord[]; }
  async addRoleAssignment(record: TeamRoleAssignment): Promise<void> { await this.database.query('insert into team_role_assignments (workspace_id, actor, role) values ($1, $2, $3) on conflict do nothing', [record.workspaceId, record.actor, record.role]); }
  async listRoleAssignments(workspaceId: string): Promise<readonly TeamRoleAssignment[]> { const result = await this.database.query('select workspace_id as "workspaceId", actor, role from team_role_assignments where workspace_id = $1 order by actor, role', [workspaceId]); return result.rows as TeamRoleAssignment[]; }
  async registerCredential(record: CredentialReferenceRecord): Promise<void> { await this.database.query('insert into team_credential_references (credential_ref, owner_actor, workspace_id, rotation_due_at) values ($1, $2, $3, $4) on conflict (credential_ref) do nothing', [record.ref, record.owner, record.workspaceId, record.rotationDueAt]); }
  async findCredential(ref: string): Promise<CredentialReferenceRecord | undefined> {
    const result = await this.database.query('select credential_ref as ref, owner_actor as owner, workspace_id as "workspaceId", rotation_due_at as "rotationDueAt" from team_credential_references where credential_ref = $1 and revoked_at is null', [ref]);
    const record = result.rows[0] as (Omit<CredentialReferenceRecord, 'rotationDueAt'> & { rotationDueAt: number | string }) | undefined;
    return record === undefined ? undefined : { ...record, rotationDueAt: Number(record.rotationDueAt) };
  }

  async issueGrant(input: TeamGrantIssue): Promise<TeamGrantRecord> {
    const record: TeamGrantRecord = { ...input, ref: `grant:${randomUUID()}`, approvers: Object.freeze([...input.approvers]) };
    await this.database.query('insert into team_grants (grant_ref, workspace_id, requester, proposal_digest, approvers, issued_at) values ($1, $2, $3, $4, $5::jsonb, $6)', [record.ref, record.workspaceId, record.requester, record.proposalDigest, JSON.stringify(record.approvers), this.now()]);
    return record;
  }

  async consumeGrant(ref: string, binding: Readonly<{ workspaceId: string; requester: string; proposalDigest: string }>): Promise<TeamGrantConsumption> {
    const result = await this.database.query('update team_grants set consumed_at = $5 where grant_ref = $1 and workspace_id = $2 and requester = $3 and proposal_digest = $4 and consumed_at is null returning grant_ref', [ref, binding.workspaceId, binding.requester, binding.proposalDigest, this.now()]);
    if (result.rows.length > 0) return { consumed: true };
    const existing = await this.database.query('select workspace_id as "workspaceId", requester, proposal_digest as "proposalDigest", consumed_at as "consumedAt" from team_grants where grant_ref = $1', [ref]);
    const record = existing.rows[0] as { workspaceId: string; requester: string; proposalDigest: string; consumedAt?: number } | undefined;
    if (record === undefined) return { consumed: false, reason: 'GRANT_NOT_FOUND' };
    if (record.consumedAt !== undefined && record.consumedAt !== null) return { consumed: false, reason: 'GRANT_ALREADY_CONSUMED' };
    return { consumed: false, reason: 'GRANT_BINDING_DENIED' };
  }

  async openApproval(policy: TeamApprovalPolicy): Promise<void> {
    await withinTeamTransaction(this.database, async transaction => {
      const existing = await transaction.query('select workspace_id as "workspaceId", policy_version as "policyVersion", requester, eligible_approvers as "eligibleApprovers", quorum from team_approval_policies where proposal_digest = $1 for update', [policy.proposalDigest]);
      if (existing.rows.length > 0) {
        const current = existing.rows[0] as { workspaceId: string; policyVersion: string; requester: string; eligibleApprovers: readonly string[]; quorum: number };
        if (current.workspaceId !== policy.workspaceId || current.policyVersion !== policy.policyVersion || current.requester !== policy.requester || current.quorum !== policy.quorum || JSON.stringify(current.eligibleApprovers) !== JSON.stringify(policy.eligibleApprovers)) throw new Error('APPROVAL_POLICY_IMMUTABLE');
        return;
      }
      await transaction.query('insert into team_approval_policies (proposal_digest, workspace_id, policy_version, requester, eligible_approvers, quorum) values ($1, $2, $3, $4, $5::jsonb, $6)', [policy.proposalDigest, policy.workspaceId, policy.policyVersion, policy.requester, JSON.stringify(policy.eligibleApprovers), policy.quorum]);
    });
  }

  async approveAndIssue(input: Readonly<{ proposalDigest: string; approver: string }>): Promise<TeamApprovalResult> {
    return withinTeamTransaction(this.database, async transaction => {
      const policyResult = await transaction.query('select workspace_id as "workspaceId", policy_version as "policyVersion", requester, eligible_approvers as "eligibleApprovers", quorum from team_approval_policies where proposal_digest = $1 for update', [input.proposalDigest]);
      const policy = policyResult.rows[0] as { workspaceId: string; policyVersion: string; requester: string; eligibleApprovers: readonly string[]; quorum: number } | undefined;
      if (policy === undefined || input.approver === policy.requester || !policy.eligibleApprovers.includes(input.approver)) return { state: 'DENIED', reason: 'APPROVER_INELIGIBLE' };
      await transaction.query('insert into team_approval_records (proposal_digest, approver, approved_at) values ($1, $2, $3) on conflict do nothing', [input.proposalDigest, input.approver, this.now()]);
      const countResult = await transaction.query('select count(*)::integer as approvals from team_approval_records where proposal_digest = $1', [input.proposalDigest]);
      const approvals = Number((countResult.rows[0] as { approvals: number } | undefined)?.approvals ?? 0);
      const existing = await transaction.query('select grant_ref as "grantRef" from team_grants where proposal_digest = $1', [input.proposalDigest]);
      const grant = existing.rows[0] as { grantRef: `grant:${string}` } | undefined;
      if (grant !== undefined) return { state: 'GRANTED', grantRef: grant.grantRef, approvals };
      if (approvals < policy.quorum) return { state: 'PENDING', approvals };
      const grantRef = `grant:${randomUUID()}` as `grant:${string}`;
      const approverRows = await transaction.query('select approver from team_approval_records where proposal_digest = $1 order by approver', [input.proposalDigest]);
      const approvers = (approverRows.rows as { approver: string }[]).map(row => row.approver);
      await transaction.query('insert into team_grants (grant_ref, workspace_id, requester, proposal_digest, approvers, issued_at) values ($1, $2, $3, $4, $5::jsonb, $6)', [grantRef, policy.workspaceId, policy.requester, input.proposalDigest, JSON.stringify(approvers), this.now()]);
      return { state: 'GRANTED', grantRef, approvals };
    });
  }

  async listGovernedRecords(workspaceId: string): Promise<readonly GovernedRecord[]> {
    const result = await this.database.query('select record_id as id, record_class as class, payload from team_governed_records where workspace_id = $1 and deleted_at is null order by record_class, record_id', [workspaceId]);
    return result.rows as GovernedRecord[];
  }
  async exportAudit(input: Readonly<{ actor: string; workspaceId: string; from: number; to: number }>): Promise<Readonly<Record<string, unknown>>> {
    return new TeamAuditExportService(this).export(input);
  }
  async executeRetention(input: Readonly<{ actor: string; workspaceId: string; recordId: string; policyVersion: string; authorizationRef: string }>): Promise<{ deleted: true }> {
    return new RetentionOperationService(this).execute({ ...input, now: this.now() });
  }
  async inspect(recordId: string): Promise<RetentionRecord | undefined> {
    const result = await this.database.query('select record_id as "recordId", workspace_id as "workspaceId", expires_at as "expiresAt", state_known as "stateKnown", exists(select 1 from team_legal_holds h where h.record_id = r.record_id and h.active) as "legalHold" from team_governed_records r where record_id = $1 and deleted_at is null', [recordId]);
    const row = result.rows[0] as (Omit<RetentionRecord, 'expiresAt'> & { expiresAt: number | string }) | undefined;
    return row === undefined ? undefined : { ...row, expiresAt: Number(row.expiresAt) };
  }
  async recordDryRun(input: Readonly<{ actor: string; workspaceId: string; recordId: string; policyVersion: string; now: number }>): Promise<void> {
    await this.database.query('insert into team_retention_dry_runs (record_id, policy_version, actor, executed_at) values ($1, $2, $3, $4) on conflict do nothing', [input.recordId, input.policyVersion, input.actor, input.now]);
  }
  async executeAuthorizedDelete(input: Readonly<{ actor: string; workspaceId: string; recordId: string; policyVersion: string; authorizationRef: string; now: number }>): Promise<{ deleted: true }> {
    return withinTeamTransaction(this.database, async transaction => {
      const grant = await transaction.query('update team_retention_grants set consumed_at = $6 where grant_ref = $1 and workspace_id = $2 and record_id = $3 and policy_version = $4 and actor = $5 and expires_at >= $6 and consumed_at is null and exists (select 1 from team_retention_dry_runs where record_id = $3 and policy_version = $4) returning grant_ref', [input.authorizationRef, input.workspaceId, input.recordId, input.policyVersion, input.actor, input.now]);
      if (grant.rows.length === 0) throw new Error('RETENTION_EXECUTION_DENIED');
      const result = await transaction.query('update team_governed_records set deleted_at = $3 where record_id = $1 and workspace_id = $2 and deleted_at is null and state_known and expires_at <= $3 and not exists (select 1 from team_legal_holds where record_id = $1 and active) returning record_id', [input.recordId, input.workspaceId, input.now]);
      if (result.rows.length === 0) throw new Error('RETENTION_EXECUTION_DENIED');
      await transaction.query('insert into team_retention_audit (audit_id, record_id, workspace_id, authorization_ref, actor, action, executed_at) values ($1, $2, $3, $4, $5, $6, $7)', [randomUUID(), input.recordId, input.workspaceId, input.authorizationRef, input.actor, 'DELETE', input.now]);
      return { deleted: true };
    });
  }
}
