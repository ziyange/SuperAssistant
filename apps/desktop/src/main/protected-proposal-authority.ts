/* eslint-disable no-unused-vars -- callback parameter names describe the trusted internal boundary. */
import { Buffer } from 'node:buffer';
import { isDeepStrictEqual } from 'node:util';
import type Database from 'better-sqlite3';
import { createH1ReviewedProposal, type ProposalVersion } from '@super-assistant/domain';
import { EncryptedProposalStore, type EncryptedProposalScope } from './encrypted-proposal-store.js';
import { ProtectedKeyReservations } from './protected-key-reservations.js';
import { ReservedPayloadService, type ReservedVault } from './reserved-payload-service.js';

type Envelope = {
  record_id: string; workspace_id: string; project_id: string; content_kind: string; format_version: number;
  key_ref: string; nonce: Buffer; ciphertext: Buffer; auth_tag: Buffer; created_at: string;
  owner_hash: string; reservation_state: string; reservation_created: string; reservation_updated: string;
};
function validScope(input: EncryptedProposalScope): boolean {
  return !!input && typeof input === 'object' && !Array.isArray(input)
    && Object.keys(input).sort().join(',') === 'projectId,proposalVersionId,workspaceId'
    && [input.workspaceId, input.projectId, input.proposalVersionId].every(value => typeof value === 'string' && /^[a-z0-9_-]{1,128}$/i.test(value));
}
function instant(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value ? parsed : null;
}
/** Informational only: a CURRENT result is not a Grant or permission to execute. */
export class ProtectedProposalAuthority {
  private readonly store: EncryptedProposalStore;
  constructor(private readonly db: Database.Database, vault: ReservedVault,
    private readonly clock: () => string = () => new Date().toISOString()) {
    this.store = new EncryptedProposalStore(new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault));
  }

  async check(input: EncryptedProposalScope): Promise<'CURRENT'> {
    if (!validScope(input) || this.db.inTransaction) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
    const scope = { ...input };
    const before = this.envelope(scope);
    if (!before) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
    const proposal = await this.store.read(scope);
    if (!proposal?.fullReview || this.db.inTransaction) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
    const rebuilt = createH1ReviewedProposal(scope.proposalVersionId, proposal.fullReview);
    if (!isDeepStrictEqual(rebuilt, proposal) || rebuilt.workspaceId !== scope.workspaceId || rebuilt.projectId !== scope.projectId) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
    try {
      return this.db.transaction(() => {
        if (this.envelope(scope) !== before || !this.current(rebuilt)) throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE');
        return 'CURRENT' as const;
      }).immediate();
    } catch { throw new Error('PROTECTED_AUTHORITY_UNAVAILABLE'); }
  }

  private envelope(scope: EncryptedProposalScope): string | null {
    const row = this.db.prepare(`
      SELECT p.record_id,p.workspace_id,p.project_id,p.content_kind,p.format_version,p.key_ref,p.nonce,p.ciphertext,p.auth_tag,p.created_at,
        r.owner_hash,r.state AS reservation_state,r.created_at AS reservation_created,r.updated_at AS reservation_updated
      FROM protected_payloads p JOIN protected_key_reservations r ON r.record_id=p.record_id AND r.workspace_id=p.workspace_id
        AND r.project_id=p.project_id AND r.key_ref=p.key_ref
      WHERE p.record_id=? AND p.workspace_id=? AND p.project_id=? AND p.content_kind='PROPOSAL' AND r.state='LINKED'
    `).get(scope.proposalVersionId, scope.workspaceId, scope.projectId) as Envelope | undefined;
    if (!row || row.format_version !== 1 || !Buffer.isBuffer(row.nonce) || row.nonce.length !== 12
      || !Buffer.isBuffer(row.auth_tag) || row.auth_tag.length !== 16 || !Buffer.isBuffer(row.ciphertext)
      || row.ciphertext.length < 1 || row.ciphertext.length > 65536 || !/^[a-f0-9]{64}$/.test(row.owner_hash)
      || !/^pkey-[a-f0-9]{64}$/.test(row.key_ref)) return null;
    return JSON.stringify([row.record_id, row.workspace_id, row.project_id, row.content_kind, row.format_version, row.key_ref,
      row.nonce.toString('base64'), row.ciphertext.toString('base64'), row.auth_tag.toString('base64'), row.created_at,
      row.owner_hash, row.reservation_state, row.reservation_created, row.reservation_updated]);
  }

  private current(proposal: ProposalVersion): boolean {
    const now = instant(this.clock()), created = instant(proposal.createdAt), expires = instant(proposal.expiresAt);
    const deadline = instant(proposal.fullReview?.deadlineAt);
    if (now === null || created === null || expires === null || deadline === null || now < created || now >= expires || now >= deadline) return false;
    const row = this.db.prepare(`
      SELECT p.snapshot_version,a.agent_version,a.connection,a.availability,f.function_version,f.lifecycle
      FROM workspaces w JOIN projects p ON p.workspace_id=w.workspace_id
      JOIN agents a ON a.workspace_id=w.workspace_id AND a.agent_id=?
      JOIN functions f ON f.agent_id=a.agent_id AND f.function_id=?
      WHERE w.workspace_id=? AND w.owner_id='local-owner' AND w.status='ACTIVE'
        AND p.project_id=? AND p.status='ACTIVE' AND p.default_agent_id=a.agent_id
    `).get(proposal.agentId, proposal.functionId, proposal.workspaceId, proposal.projectId) as { snapshot_version: number; agent_version: string; connection: string; availability: string; function_version: string; lifecycle: string } | undefined;
    return !!row && String(row.snapshot_version) === proposal.projectSnapshotVersion && row.agent_version === proposal.agentVersion
      && row.connection === 'CONNECTED' && row.availability === 'AVAILABLE'
      && row.function_version === proposal.functionVersion && row.lifecycle === 'ACTIVE';
  }
}
