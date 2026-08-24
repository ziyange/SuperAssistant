import { expect, test } from 'vitest';
import process from 'node:process';
import { Pool } from 'pg';
import { PostgresTeamRepository } from '../src/postgres/team-repository.js';
import { initializeIntegratedTeamSchema } from '../src/postgres/schema.js';
import { RetentionOperationService } from '../src/retention-operation-service.js';
import { TeamAuditExportService } from '../src/team-audit-export-service.js';

test('persists one Team workspace and ordered scoped events through a transaction', async () => {
  const calls: string[] = [];
  const rows = new Map<string, { workspaceId: string; name: string; ownerActor: string }>();
  const repository = new PostgresTeamRepository({
    async query(text: string, values: readonly unknown[] = []) {
      calls.push(text);
      if (text.startsWith('insert into team_workspace_records')) {
        rows.set(values[0] as string, { workspaceId: values[0] as string, name: values[1] as string, ownerActor: values[2] as string });
        return { rows: [] };
      }
      if (text.startsWith('select workspace_id')) return { rows: [...rows.values()].filter(row => row.workspaceId === values[0]) };
      return { rows: [] };
    }
  });
  await repository.createWorkspace({ workspaceId: 'team-1', name: 'Team One', ownerActor: 'actor-1' });
  expect(await repository.getWorkspace('team-1')).toEqual({ workspaceId: 'team-1', name: 'Team One', ownerActor: 'actor-1' });
  expect(calls[0]).toContain('on conflict (workspace_id) do nothing');
});

test.runIf(process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL !== undefined)('retains legal-held records and restores governed export state from PostgreSQL', async () => {
  const pool = new Pool({ connectionString: process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL });
  try {
    await initializeIntegratedTeamSchema(pool);
    await pool.query('truncate table team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records');
    await pool.query("insert into team_workspace_records (workspace_id, name, owner_actor) values ('team-retention', 'Retention', 'owner')");
    await pool.query("insert into team_governed_records (record_id, workspace_id, record_class, payload, expires_at) values ('held', 'team-retention', 'AUDIT', '{\"kind\":\"audit\"}', 10), ('expired', 'team-retention', 'EVIDENCE', '{\"kind\":\"evidence\"}', 10), ('raced', 'team-retention', 'EVIDENCE', '{\"kind\":\"race\"}', 10)");
    await pool.query("insert into team_legal_holds (record_id, workspace_id, active, reason) values ('held', 'team-retention', true, 'investigation')");
    const restarted = new PostgresTeamRepository(pool, () => 20);
    const exported = await new TeamAuditExportService(restarted).export({ actor: 'auditor', workspaceId: 'team-retention', from: 0, to: 20 });
    expect(new TeamAuditExportService(restarted).verify(exported)).toBe(true);
    const retention = new RetentionOperationService(restarted);
    await expect(retention.dryRun({ actor: 'auditor', workspaceId: 'team-retention', recordId: 'held', policyVersion: 'v1', now: 20 })).resolves.toEqual({ action: 'PRESERVE', reason: 'LEGAL_HOLD' });
    await retention.dryRun({ actor: 'auditor', workspaceId: 'team-retention', recordId: 'expired', policyVersion: 'v1', now: 20 });
    await pool.query("insert into team_retention_grants (grant_ref, workspace_id, record_id, policy_version, actor, expires_at) values ('grant:retention', 'team-retention', 'expired', 'v1', 'operator', 30)");
    await expect(retention.execute({ actor: 'operator', workspaceId: 'team-retention', recordId: 'expired', policyVersion: 'v1', authorizationRef: 'grant:retention', now: 20 })).resolves.toEqual({ deleted: true });
    await expect(retention.execute({ actor: 'operator', workspaceId: 'team-retention', recordId: 'expired', policyVersion: 'v1', authorizationRef: 'grant:retention', now: 20 })).rejects.toThrow('RETENTION_EXECUTION_DENIED');
    await retention.dryRun({ actor: 'auditor', workspaceId: 'team-retention', recordId: 'raced', policyVersion: 'v1', now: 20 });
    await pool.query("insert into team_retention_grants (grant_ref, workspace_id, record_id, policy_version, actor, expires_at) values ('grant:raced', 'team-retention', 'raced', 'v1', 'operator', 30)");
    await pool.query("insert into team_legal_holds (record_id, workspace_id, active, reason) values ('raced', 'team-retention', true, 'race')");
    await expect(retention.execute({ actor: 'operator', workspaceId: 'team-retention', recordId: 'raced', policyVersion: 'v1', authorizationRef: 'grant:raced', now: 20 })).rejects.toThrow('RETENTION_EXECUTION_DENIED');
    expect((await pool.query("select consumed_at from team_retention_grants where grant_ref = 'grant:raced'")).rows[0]).toEqual({ consumed_at: null });
  } finally { await pool.query('drop table if exists team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records'); await pool.end(); }
});

test.runIf(process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL !== undefined)('uses a disposable PostgreSQL authority database', async () => {
  const pool = new Pool({ connectionString: process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL });
  try {
    await initializeIntegratedTeamSchema(pool);
    await pool.query('truncate table team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records');
    const repository = new PostgresTeamRepository(pool);
    await repository.createWorkspace({ workspaceId: 'team-live', name: 'Live Team', ownerActor: 'actor-live' });
    expect(await repository.getWorkspace('team-live')).toEqual({ workspaceId: 'team-live', name: 'Live Team', ownerActor: 'actor-live' });
  } finally {
    await pool.query('drop table if exists team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records');
    await pool.end();
  }
});

test.runIf(process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL !== undefined)('persists roles, credential references and one transactional multi-party Grant', async () => {
  const pool = new Pool({ connectionString: process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL });
  try {
    await initializeIntegratedTeamSchema(pool);
    await pool.query('truncate table team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records');
    const repository = new PostgresTeamRepository(pool, () => 100);
    await repository.createWorkspace({ workspaceId: 'team-governance', name: 'Governance', ownerActor: 'owner' });
    await repository.addRoleAssignment({ workspaceId: 'team-governance', actor: 'approver-a', role: 'APPROVER' });
    await repository.registerCredential({ ref: 'cred:service-a', owner: 'owner', workspaceId: 'team-governance', rotationDueAt: 200 });
    const restartedRepository = new PostgresTeamRepository(pool, () => 100);
    expect(await restartedRepository.listRoleAssignments('team-governance')).toEqual([{ workspaceId: 'team-governance', actor: 'approver-a', role: 'APPROVER' }]);
    expect(await restartedRepository.findCredential('cred:service-a')).toEqual({ ref: 'cred:service-a', owner: 'owner', workspaceId: 'team-governance', rotationDueAt: 200 });
    await restartedRepository.openApproval({ workspaceId: 'team-governance', proposalDigest: 'sha256:aaaaaaaa', policyVersion: 'v1', requester: 'owner', eligibleApprovers: ['approver-a', 'approver-b'], quorum: 2 });
    const approvalResults = await Promise.all([
      restartedRepository.approveAndIssue({ proposalDigest: 'sha256:aaaaaaaa', approver: 'approver-a' }),
      restartedRepository.approveAndIssue({ proposalDigest: 'sha256:aaaaaaaa', approver: 'approver-b' })
    ]);
    const grant = approvalResults.find(result => result.state === 'GRANTED');
    expect(grant).toMatchObject({ state: 'GRANTED', approvals: 2 });
    if (grant?.state !== 'GRANTED') throw new Error('GRANT_NOT_ISSUED');
    const consumed = await Promise.all([
      restartedRepository.consumeGrant(grant.grantRef, { workspaceId: 'team-governance', requester: 'owner', proposalDigest: 'sha256:aaaaaaaa' }),
      restartedRepository.consumeGrant(grant.grantRef, { workspaceId: 'team-governance', requester: 'owner', proposalDigest: 'sha256:aaaaaaaa' })
    ]);
    expect(consumed.filter(result => result.consumed)).toHaveLength(1);
    expect(consumed.filter(result => !result.consumed)).toEqual([{ consumed: false, reason: 'GRANT_ALREADY_CONSUMED' }]);
  } finally {
    await pool.query('drop table if exists team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records');
    await pool.end();
  }
});

test('persists opaque session and membership scope without a credential value', async () => {
  const calls: string[] = [];
  const repository = new PostgresTeamRepository({ async query(text: string) { calls.push(text); return { rows: [] }; } });
  await repository.createSession({ sessionRef: 'session:sha256:one', actor: 'subject-1', workspaceId: 'team-1', expiresAt: 100 });
  await repository.revokeSession('session:sha256:one');
  await repository.addMembership({ workspaceId: 'team-1', subject: 'subject-1', role: 'MEMBER' });
  expect(calls.join('\n')).toContain('team_sessions');
  expect(calls.join('\n')).toContain('team_memberships');
  expect(calls.join('\n')).not.toMatch(/token|secret|password/i);
});
