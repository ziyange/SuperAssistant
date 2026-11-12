import { describe, expect, test } from 'vitest';
import { createFoundationDatabase } from '../src/sqlite/database.js';
import { SqliteProposalRepository } from '../src/repositories/proposal-repository.js';
import { SqliteAuthorizationRepository } from '../src/repositories/authorization-repository.js';
import { SqliteFoundationRepository } from '../src/repositories/foundation-repository.js';
import { createProposalVersion } from '@super-assistant/domain';

describe('Proposal and authorization repositories', () => {

  test.each([[['READ']], [[]], [['UNKNOWN']]])('refuses execution Grant for invalid or read-only actions %#', (actions) => {
    const db = createFoundationDatabase(':memory:');
    try {
      const foundation = new SqliteFoundationRepository(db);
      const workspace = foundation.createWorkspace({ ownerId: 'owner-1', name: 'Local' });
      const agent = foundation.createAgent({ workspaceId: workspace.workspaceId, name: 'Codex', connection: 'CONNECTED', availability: 'AVAILABLE', agentVersion: '1' });
      const project = foundation.createProject({ workspaceId: workspace.workspaceId, name: 'Demo', canonicalPath: 'E:/Demo', defaultAgentId: agent.agentId, snapshotVersion: 1 });
      const fn = foundation.createFunction({ agentId: agent.agentId, name: 'codex', functionVersion: '1' });
      const proposal = createProposalVersion({ proposalVersionId: 'proposal-1', workspaceId: workspace.workspaceId, projectId: project.projectId, agentId: agent.agentId, functionId: fn.functionId, objective: 'Example', actions: actions as never, projectSnapshotVersion: '1', agentVersion: '1', functionVersion: '1', capabilityVersion: '1', baselineCommit: 'abc', expiresAt: '2026-08-14T00:00:00.000Z', createdAt: '2026-08-13T00:00:00.000Z' });
      new SqliteProposalRepository(db).save(proposal);
      const grants = new SqliteAuthorizationRepository(db, () => '2026-08-13T01:00:00.000Z', () => 'owner-1');
      expect(() => grants.issue({ grantId: 'grant-1', proposal, actorId: 'owner-1', idempotencyKey: 'confirmation-1', issuedAt: '2026-08-13T01:00:00.000Z' })).toThrow();
      expect(db.prepare('SELECT count(*) AS count FROM authorization_grants').get()).toEqual({ count: 0 });
    } finally { db.close(); }
  });
  test('persists immutable proposals and returns one grant for duplicate confirmation', () => {
    const db = createFoundationDatabase(':memory:');
    const foundation = new SqliteFoundationRepository(db); const workspace = foundation.createWorkspace({ ownerId: 'owner-1', name: 'Local' }); const agent = foundation.createAgent({ workspaceId: workspace.workspaceId, name: 'Codex', connection: 'CONNECTED', availability: 'AVAILABLE', agentVersion: '1' }); const project = foundation.createProject({ workspaceId: workspace.workspaceId, name: 'Demo', canonicalPath: 'E:/Demo', defaultAgentId: agent.agentId, snapshotVersion: 1 }); const fn = foundation.createFunction({ agentId: agent.agentId, name: 'codex', functionVersion: '1' });
    let trustedNow = '2026-08-13T01:00:00.000Z';
    const proposals = new SqliteProposalRepository(db); const grants = new SqliteAuthorizationRepository(db, () => trustedNow, () => 'owner-1');
    const proposal = createProposalVersion({ proposalVersionId: 'proposal-1', workspaceId: workspace.workspaceId, projectId: project.projectId, agentId: agent.agentId, functionId: fn.functionId, objective: 'Write a report', actions: ['FILE_WRITE'], projectSnapshotVersion: 'snapshot-1', agentVersion: '1', functionVersion: '1', capabilityVersion: '1', baselineCommit: 'abc', expiresAt: '2026-08-14T00:00:00.000Z', createdAt: '2026-08-13T00:00:00.000Z' });
    proposals.save(proposal);
    expect(proposals.get(proposal.proposalVersionId)?.digest).toBe(proposal.digest);
    expect(() => db.prepare("UPDATE proposal_versions SET objective = 'Changed' WHERE proposal_version_id = ?").run(proposal.proposalVersionId)).toThrow(/immutable/i);
    const first = grants.issue({ grantId: 'grant-1', proposal, actorId: 'owner-1', idempotencyKey: 'confirmation-1', issuedAt: '2026-08-12T01:00:00.000Z' });
    expect(first.issuedAt).toBe('2026-08-13T01:00:00.000Z');
    const second = grants.issue({ grantId: 'grant-2', proposal, actorId: 'owner-1', idempotencyKey: 'confirmation-1', issuedAt: '2026-08-13T01:00:01.000Z' });
    expect(second).toEqual(first);
    const alternateKey = grants.issue({ grantId: 'grant-alt', proposal, actorId: 'owner-1', idempotencyKey: 'alternate-confirmation', issuedAt: '2026-08-13T01:00:01.000Z' });
    expect(alternateKey).toEqual(first);
    expect(db.prepare('SELECT count(*) AS count FROM authorization_grants').get()).toEqual({ count: 1 });
    expect(() => db.prepare("INSERT INTO authorization_grants SELECT 'bypass', proposal_version_id, proposal_digest, actor_id, 'bypass-key', actions_json, status, issued_at, expires_at FROM authorization_grants WHERE grant_id = 'grant-1'").run()).toThrow();
    const forged = { ...proposal, objective: 'Perform a different action' };
    expect(() => grants.issue({ grantId: 'grant-3', proposal: forged, actorId: 'owner-1', idempotencyKey: 'new-key', issuedAt: '2026-08-13T01:00:01.000Z' })).toThrow();
    const { digest, ...input } = proposal;
    void digest;
    const other = createProposalVersion({ ...input, proposalVersionId: 'proposal-2', objective: 'Other objective' });
    proposals.save(other);
    expect(() => grants.issue({ grantId: 'alias-conflict', proposal: other, actorId: 'owner-1', idempotencyKey: 'alternate-confirmation', issuedAt: '2026-08-13T01:00:01.000Z' })).toThrow(/GRANT_IDEMPOTENCY_CONFLICT/);
    expect(() => grants.issue({ grantId: 'grant-4', proposal: other, actorId: 'owner-1', idempotencyKey: 'confirmation-1', issuedAt: '2026-08-13T01:00:01.000Z' })).toThrow();
    trustedNow = '2026-08-14T00:00:00.000Z';
    expect(() => grants.issue({ grantId: 'grant-5', proposal: other, actorId: 'owner-1', idempotencyKey: 'expired-key', issuedAt: '2026-08-13T00:00:00.000Z' })).toThrow();
    trustedNow = 'not-a-time';
    expect(() => grants.issue({ grantId: 'grant-6', proposal: other, actorId: 'owner-1', idempotencyKey: 'invalid-time-key', issuedAt: '2026-08-13T00:00:00.000Z' })).toThrow();
    const expiredAuthority = Reflect.construct(SqliteAuthorizationRepository, [db, () => '2026-08-14T00:00:00.000Z', () => 'owner-1']) as SqliteAuthorizationRepository;
    expect(() => expiredAuthority.issue({ grantId: 'grant-7', proposal: other, actorId: 'owner-1', idempotencyKey: 'backdated-key', issuedAt: '2026-08-13T01:00:00.000Z' })).toThrow();
    const outsider = Reflect.construct(SqliteAuthorizationRepository, [db, () => '2026-08-13T01:00:00.000Z', () => 'intruder']) as SqliteAuthorizationRepository;
    expect(() => outsider.issue({ grantId: 'grant-8', proposal: other, actorId: 'intruder', idempotencyKey: 'outsider', issuedAt: '2026-08-13T01:00:00.000Z' })).toThrow();
    const owner = Reflect.construct(SqliteAuthorizationRepository, [db, () => '2026-08-13T01:00:00.000Z', () => 'owner-1']) as SqliteAuthorizationRepository;
    expect(() => owner.issue({ grantId: 'grant-9', proposal: other, actorId: 'intruder', idempotencyKey: 'spoofed', issuedAt: '2026-08-13T01:00:00.000Z' })).toThrow();
    db.prepare("UPDATE workspaces SET status = 'LOCKED' WHERE workspace_id = ?").run(workspace.workspaceId);
    expect(() => owner.issue({ grantId: 'grant-10', proposal: other, actorId: 'owner-1', idempotencyKey: 'locked', issuedAt: '2026-08-13T01:00:00.000Z' })).toThrow();
    expect(db.prepare('SELECT count(*) AS count FROM authorization_grants').get()).toEqual({ count: 1 });
    db.prepare("UPDATE authorization_grants SET status = 'CONSUMED' WHERE grant_id = 'grant-1'").run();
    db.prepare("UPDATE workspaces SET status = 'ACTIVE' WHERE workspace_id = ?").run(workspace.workspaceId);
    const retry = owner.issue({ grantId: 'retry-grant', proposal, actorId: 'owner-1', idempotencyKey: 'retry-key', issuedAt: '2026-08-13T01:00:00.000Z' });
    expect(retry.grantId).toBe('retry-grant');
    expect(db.prepare('SELECT count(*) AS count FROM authorization_grants').get()).toEqual({ count: 2 });
    db.close();
  });
});
