/* eslint-disable no-unused-vars -- constructor parameter property is used at runtime. */
import type Database from 'better-sqlite3';
import { createAuthorizationGrant, type AuthorizationGrant, type ProposalVersion } from '@super-assistant/domain';

export class SqliteAuthorizationRepository {
  constructor(private readonly database: Database.Database) {}
  issue(input: { grantId: string; proposal: ProposalVersion; actorId: string; idempotencyKey: string; issuedAt: string }): AuthorizationGrant {
    const existing = this.database.prepare('SELECT * FROM authorization_grants WHERE actor_id = ? AND idempotency_key = ?').get(input.actorId, input.idempotencyKey) as Record<string, string> | undefined;
    if (existing) return this.toGrant(existing);
    const grant = createAuthorizationGrant({ grantId: input.grantId, proposalVersionId: input.proposal.proposalVersionId, proposalDigest: input.proposal.digest, actorId: input.actorId, idempotencyKey: input.idempotencyKey, actions: input.proposal.actions, issuedAt: input.issuedAt, expiresAt: input.proposal.expiresAt });
    this.database.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(grant.grantId, grant.proposalVersionId, grant.proposalDigest, grant.actorId, grant.idempotencyKey, JSON.stringify(grant.actions), grant.status, grant.issuedAt, grant.expiresAt);
    return grant;
  }
  private toGrant(row: Record<string, string>): AuthorizationGrant {
    const value = (key: string): string => { const found = row[key]; if (found === undefined) throw new Error(`Missing AuthorizationGrant column: ${key}`); return found; };
    return { grantId: value('grant_id'), proposalVersionId: value('proposal_version_id'), proposalDigest: value('proposal_digest'), actorId: value('actor_id'), idempotencyKey: value('idempotency_key'), actions: JSON.parse(value('actions_json')), status: value('status') as AuthorizationGrant['status'], issuedAt: value('issued_at'), expiresAt: value('expires_at') };
  }
}
