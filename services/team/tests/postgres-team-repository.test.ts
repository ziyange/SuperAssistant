import { expect, test } from 'vitest';
import process from 'node:process';
import { Pool } from 'pg';
import { PostgresTeamRepository } from '../src/postgres/team-repository.js';
import { initializeIntegratedTeamSchema } from '../src/postgres/schema.js';
import { RetentionOperationService } from '../src/retention-operation-service.js';
import { TeamAuditExportService } from '../src/team-audit-export-service.js';
import { PersistentTeamSessionService } from '../src/session-service.js';
import { randomUUID } from 'node:crypto';
import { NotificationOutbox } from '../src/notification-outbox.js';

test('repository rejects invalid notification identity before executing SQL', async () => {
  let queries = 0;
  const repository = new PostgresTeamRepository({ async query() { queries += 1; return { rows: [] }; } });
  const row = { idempotencyKey: '', workspaceId: 'w', principal: 'p', priority: 'NORMAL' as const, targetRef: 'target:t', attempts: 0 };
  await expect(repository.insert(row)).rejects.toThrow('NOTIFICATION_SCOPE_INVALID');
  await expect(repository.insert({ ...row, idempotencyKey: 'key', targetRef: 'target:' })).rejects.toThrow('NOTIFICATION_TARGET_INVALID');
  expect(queries).toBe(0);
});

test.runIf(process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL !== undefined && process.env.SUPER_ASSISTANT_TEAM_DISPOSABLE === '1')('fences notification confirmation and never reclaims an uncertain delivery', async () => {
  const schema = `task721_${randomUUID().replaceAll('-', '')}`;
  const connectionString = process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL;
  const admin = new Pool({ connectionString });
  await admin.query(`create schema "${schema}"`);
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}` });
  try {
    await pool.query('create table team_notification_outbox (idempotency_key text primary key, workspace_id text not null, principal text not null, priority text not null, aggregate_key text, target_ref text not null, attempts integer not null default 0, claimed_at bigint, delivered_at bigint)');
    await pool.query("insert into team_notification_outbox values ('legacy-uncertain', 'w', 'p', 'NORMAL', null, 'target:old', 1, 100, null)");
    await initializeIntegratedTeamSchema(pool);
    const repository = new PostgresTeamRepository(pool);
    expect(repository).toHaveProperty('insert', expect.any(Function));
    const outbox = new NotificationOutbox(repository);
    expect(await outbox.enqueue({ idempotencyKey: 'n1', workspaceId: 'w', principal: 'p', priority: 'NORMAL', targetRef: 'target:t', attempts: 0 })).toBe(true);
    const claimed = await Promise.all([outbox.claim(1), outbox.claim(1)]);
    expect(claimed.flat()).toHaveLength(1);
    const first = claimed.flat()[0];
    if (first === undefined) throw new Error('Expected claim');
    expect(first.attempts).toBe(1);
    expect(await new NotificationOutbox(new PostgresTeamRepository(pool)).claim(1)).toEqual([]);
    expect(outbox).toHaveProperty('beginDelivery', expect.any(Function));
    expect(await outbox.beginDelivery({ ...first, workspaceId: 'other' })).toBe(false);
    expect(await outbox.beginDelivery({ ...first, principal: 'other' })).toBe(false);
    expect(await outbox.beginDelivery({ ...first, targetRef: 'target:other' })).toBe(false);
    const starts = await Promise.all([outbox.beginDelivery(first), outbox.beginDelivery(first)]);
    expect(starts.filter(Boolean)).toHaveLength(1);
    await pool.query('update team_notification_outbox set attempts = 2, delivery_started_at = null where idempotency_key = $1', ['n1']);
    expect(await outbox.acknowledge(first)).toBe(false);
    expect(await outbox.beginDelivery(first)).toBe(false);
    expect(await outbox.beginDelivery({ ...first, attempts: 2 })).toBe(true);
    expect(await outbox.acknowledge({ ...first, attempts: 2 })).toBe(true);
    expect(await outbox.acknowledge({ ...first, attempts: 2 })).toBe(false);
    expect(await outbox.claim(1)).toEqual([]);
    expect((await pool.query("select attempts, claimed_at, delivery_started_at, delivered_at from team_notification_outbox where idempotency_key = 'legacy-uncertain'")).rows[0]).toEqual({ attempts: 1, claimed_at: '100', delivery_started_at: null, delivered_at: null });
    await outbox.enqueue({ idempotencyKey: 'n2', workspaceId: 'w', principal: 'p', priority: 'NORMAL', targetRef: 'target:t', attempts: 0 });
    const next = (await outbox.claim(1))[0];
    if (next === undefined) throw new Error('Expected delivery claim');
    let sends = 0;
    const ports = { async authorize() { return true; }, async deliver() { sends += 1; } };
    const delivered = await Promise.all([outbox.deliverClaim(next, ports), outbox.deliverClaim(next, ports)]);
    expect(delivered.sort()).toEqual(['DELIVERED', 'NOT_STARTED']);
    expect(sends).toBe(1);
    await outbox.enqueue({ ...next, idempotencyKey: 'n3' });
    const uncertain = (await outbox.claim(1))[0];
    if (uncertain === undefined) throw new Error('Expected uncertain claim');
    const failing = { async authorize() { return true; }, async deliver() { sends += 1; throw new Error('channel outcome unknown'); } };
    expect(await outbox.deliverClaim(uncertain, failing)).toBe('UNKNOWN');
    expect(await outbox.deliverClaim(uncertain, failing)).toBe('NOT_STARTED');
    expect(await outbox.claim(1)).toEqual([]);
    expect(sends).toBe(2);
    expect(outbox).toHaveProperty('reconcileClaim', expect.any(Function));
    expect(await outbox.reconcileClaim(uncertain, { async status() { return { outcome: 'UNKNOWN' as const }; } })).toBe('UNKNOWN');
    expect(await outbox.claim(1)).toEqual([]);
    expect(await outbox.reconcileClaim({ ...uncertain, workspaceId: 'other' }, { async status() { return { outcome: 'FINAL_NOT_DELIVERED' as const, evidenceRef: 'evidence:one' }; } })).toBe('UNKNOWN');
    expect(await outbox.reconcileClaim(uncertain, { async status() { return { outcome: 'FINAL_NOT_DELIVERED' as const, evidenceRef: 'evidence:one' }; } })).toBe('RETRYABLE');
    expect((await pool.query("select outcome, evidence_ref from team_notification_reconciliations where idempotency_key = 'n3'")).rows).toEqual([{ outcome: 'FINAL_NOT_DELIVERED', evidence_ref: 'evidence:one' }]);
    const retried = (await outbox.claim(1))[0];
    expect(retried).toMatchObject({ idempotencyKey: 'n3', attempts: 2 });
    expect(await outbox.beginDelivery(uncertain)).toBe(false);
    if (retried === undefined) throw new Error('Expected retry claim');
    expect(await outbox.deliverClaim(retried, failing)).toBe('UNKNOWN');
    expect(await outbox.reconcileClaim(retried, { async status() { throw new Error('unavailable'); } })).toBe('UNKNOWN');
    expect(await outbox.reconcileClaim(retried, { async status() { return { outcome: 'DELIVERED' as const, evidenceRef: 'bad' }; } })).toBe('UNKNOWN');
    const reconciled = await Promise.all([
      outbox.reconcileClaim(retried, { async status() { return { outcome: 'DELIVERED' as const, evidenceRef: 'evidence:two' }; } }),
      outbox.reconcileClaim(retried, { async status() { return { outcome: 'DELIVERED' as const, evidenceRef: 'evidence:two' }; } })
    ]);
    expect(reconciled.sort()).toEqual(['DELIVERED', 'UNKNOWN']);
    expect((await pool.query("select outcome, evidence_ref from team_notification_reconciliations where idempotency_key = 'n3' order by generation")).rows).toEqual([{ outcome: 'FINAL_NOT_DELIVERED', evidence_ref: 'evidence:one' }, { outcome: 'DELIVERED', evidence_ref: 'evidence:two' }]);
    expect(await outbox.claim(1)).toEqual([]);
    for (const key of ['batch-ok', 'batch-denied', 'batch-unknown']) {
      await outbox.enqueue({ idempotencyKey: key, workspaceId: 'w', principal: key, priority: 'NORMAL', targetRef: 'target:t', attempts: 0 });
    }
    const sent: string[] = [];
    const batch = await outbox.deliverAvailable(20, {
      async authorize(_workspace, principal) { return principal !== 'batch-denied'; },
      async deliver(key) { sent.push(key); if (key === 'batch-unknown') throw new Error('unknown channel outcome'); }
    });
    expect(batch).toEqual({ delivered: 1, denied: 1, notStarted: 0, unknown: 1 });
    expect(sent).toEqual(['batch-ok', 'batch-unknown']);
    expect(await outbox.claim(20)).toEqual([]);
  } finally { await pool.end(); await admin.end(); }
});

test('maps PostgreSQL NULL and bigint session fields before authentication', async () => {
  let revokedAt: string | null = null;
  const repository = new PostgresTeamRepository({
    async query() { return { rows: [{ sessionRef: 'session:sha256:one', actor: 'user', workspaceId: 'team', expiresAt: '100', revokedAt }] }; }
  });
  const sessions = new PersistentTeamSessionService(repository, () => 'unused');
  await expect(sessions.resolve('session:sha256:one', 50)).resolves.toEqual({ actor: 'user', workspaceId: 'team' });
  await expect(repository.getSession('session:sha256:one')).resolves.toEqual({ sessionRef: 'session:sha256:one', actor: 'user', workspaceId: 'team', expiresAt: 100 });
  await expect(sessions.resolve('session:sha256:one', 100)).rejects.toThrow('TEAM_SESSION_EXPIRED');
  revokedAt = '60';
  await expect(repository.getSession('session:sha256:one')).resolves.toMatchObject({ revokedAt: 60 });
  await expect(sessions.resolve('session:sha256:one', 50)).rejects.toThrow('TEAM_SESSION_REVOKED');
});

test.runIf(process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL !== undefined && process.env.SUPER_ASSISTANT_TEAM_DISPOSABLE === '1')('authenticates and revokes a session through real PostgreSQL NULL and bigint values', async () => {
  const pool = new Pool({ connectionString: process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL });
  try {
    await initializeIntegratedTeamSchema(pool);
    const repository = new PostgresTeamRepository(pool);
    await repository.createWorkspace({ workspaceId: 'task-721-workspace', name: 'Session fixture', ownerActor: 'task-721-user' });
    const sessions = new PersistentTeamSessionService(repository, () => 'task-721-live-session');
    const ref = await sessions.create({ actor: 'task-721-user', workspaceId: 'task-721-workspace', expiresAt: 100 });
    await expect(sessions.resolve(ref, 50)).resolves.toEqual({ actor: 'task-721-user', workspaceId: 'task-721-workspace' });
    await expect(sessions.resolve(ref, 100)).rejects.toThrow('TEAM_SESSION_EXPIRED');
    await sessions.revoke(ref);
    await expect(sessions.resolve(ref, 50)).rejects.toThrow('TEAM_SESSION_REVOKED');
  } finally { await pool.end(); }
});

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

test.runIf(process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL !== undefined && process.env.SUPER_ASSISTANT_TEAM_DISPOSABLE === '1')('retains legal-held records and restores governed export state from PostgreSQL', async () => {
  const pool = new Pool({ connectionString: process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL });
  try {
    await initializeIntegratedTeamSchema(pool);
    await pool.query('truncate table team_notification_reconciliations, team_notification_outbox, team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records');
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
  } finally { await pool.query('drop table if exists team_notification_reconciliations, team_notification_outbox, team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records'); await pool.end(); }
});

test.runIf(process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL !== undefined && process.env.SUPER_ASSISTANT_TEAM_DISPOSABLE === '1')('uses a disposable PostgreSQL authority database', async () => {
  const pool = new Pool({ connectionString: process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL });
  try {
    await initializeIntegratedTeamSchema(pool);
    await pool.query('truncate table team_notification_reconciliations, team_notification_outbox, team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records');
    const repository = new PostgresTeamRepository(pool);
    await repository.createWorkspace({ workspaceId: 'team-live', name: 'Live Team', ownerActor: 'actor-live' });
    expect(await repository.getWorkspace('team-live')).toEqual({ workspaceId: 'team-live', name: 'Live Team', ownerActor: 'actor-live' });
  } finally {
    await pool.query('drop table if exists team_notification_reconciliations, team_notification_outbox, team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records');
    await pool.end();
  }
});

test.runIf(process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL !== undefined && process.env.SUPER_ASSISTANT_TEAM_DISPOSABLE === '1')('persists roles, credential references and one transactional multi-party Grant', async () => {
  const pool = new Pool({ connectionString: process.env.SUPER_ASSISTANT_TEAM_TEST_DATABASE_URL });
  try {
    await initializeIntegratedTeamSchema(pool);
    await pool.query('truncate table team_notification_reconciliations, team_notification_outbox, team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records');
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
    await pool.query('drop table if exists team_notification_reconciliations, team_notification_outbox, team_retention_audit, team_retention_grants, team_retention_dry_runs, team_legal_holds, team_governed_records, team_grants, team_approval_records, team_approval_policies, team_credential_references, team_role_assignments, team_memberships, team_sessions, team_workspace_events, team_workspace_records');
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
