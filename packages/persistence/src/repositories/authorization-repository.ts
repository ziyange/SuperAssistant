/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { classifyGoalActions, createAuthorizationGrant, createProposalVersion, type AuthorizationGrant, type ProposalVersion } from '@super-assistant/domain';
import { SqliteProposalRepository } from './proposal-repository.js';

export class SqliteAuthorizationRepository {
  constructor(private readonly database: Database.Database, private readonly clock: () => string = () => new Date().toISOString(), private readonly principal: () => string = () => 'local-owner') {}
  issue(input: { grantId: string; proposal: ProposalVersion; actorId: string; idempotencyKey: string; issuedAt: string }): AuthorizationGrant {
    const stored = new SqliteProposalRepository(this.database).get(input.proposal.proposalVersionId);
    if (!stored) throw new Error('PROPOSAL_NOT_FOUND');
    const actor = this.principal();
    const workspace = this.database.prepare('SELECT owner_id, status FROM workspaces WHERE workspace_id = ?').get(stored.workspaceId) as { owner_id: string; status: string } | undefined;
    if (!actor || !workspace || workspace.status !== 'ACTIVE' || workspace.owner_id !== actor || input.actorId !== actor) throw new Error('LOCAL_AUTHORITY_DENIED');
    const { digest: suppliedDigest, ...suppliedFields } = input.proposal;
    const { digest: storedDigest, ...storedFields } = stored;
    if (suppliedDigest !== storedDigest || createProposalVersion(suppliedFields).digest !== suppliedDigest || createProposalVersion(storedFields).digest !== storedDigest) throw new Error('PROPOSAL_DIGEST_MISMATCH');
    if (classifyGoalActions(stored.actions).kind !== 'SIDE_EFFECTING') throw new Error('PROPOSAL_NOT_SIDE_EFFECTING');
    const existing = this.database.prepare('SELECT * FROM authorization_grants WHERE actor_id = ? AND idempotency_key = ?').get(input.actorId, input.idempotencyKey) as Record<string, string> | undefined;
    if (existing) {
      const prior = this.toGrant(existing);
      if (prior.proposalVersionId !== stored.proposalVersionId || prior.proposalDigest !== stored.digest) throw new Error('GRANT_IDEMPOTENCY_CONFLICT');
      return prior;
    }
    const issuedAt = Date.parse(this.clock());
    const expiresAt = Date.parse(stored.expiresAt);
    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || issuedAt >= expiresAt) throw new Error('PROPOSAL_EXPIRED_OR_INVALID');
    const grant = createAuthorizationGrant({ grantId: input.grantId, proposalVersionId: stored.proposalVersionId, proposalDigest: stored.digest, actorId: input.actorId, idempotencyKey: input.idempotencyKey, actions: stored.actions, issuedAt: new Date(issuedAt).toISOString(), expiresAt: stored.expiresAt });
    this.database.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(grant.grantId, grant.proposalVersionId, grant.proposalDigest, grant.actorId, grant.idempotencyKey, JSON.stringify(grant.actions), grant.status, grant.issuedAt, grant.expiresAt);
    return grant;
  }
  private toGrant(row: Record<string, string>): AuthorizationGrant {
    const value = (key: string): string => { const found = row[key]; if (found === undefined) throw new Error(`Missing AuthorizationGrant column: ${key}`); return found; };
    return { grantId: value('grant_id'), proposalVersionId: value('proposal_version_id'), proposalDigest: value('proposal_digest'), actorId: value('actor_id'), idempotencyKey: value('idempotency_key'), actions: JSON.parse(value('actions_json')), status: value('status') as AuthorizationGrant['status'], issuedAt: value('issued_at'), expiresAt: value('expires_at') };
  }
}
