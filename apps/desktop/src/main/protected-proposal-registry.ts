/* eslint-disable no-unused-vars -- parameter properties define the trusted main-process boundary. */
import { Buffer } from 'node:buffer';
import { isDeepStrictEqual } from 'node:util';
import type Database from 'better-sqlite3';
import type { ProposalVersion } from '@super-assistant/domain';
import { EncryptedProposalStore, type EncryptedProposalScope } from './encrypted-proposal-store.js';
import { ProtectedKeyReservations } from './protected-key-reservations.js';
import { ReservedPayloadService, type ReservedVault } from './reserved-payload-service.js';
import { isBuiltinCodexFunction } from './local-codex-function.js';

type Envelope = {
  record_id: string; workspace_id: string; project_id: string; content_kind: string; format_version: number;
  key_ref: string; nonce: Buffer; ciphertext: Buffer; auth_tag: Buffer; created_at: string;
  owner_hash: string; reservation_state: string; reservation_created: string; reservation_updated: string;
};
type Ref = { workspace_id: string; project_id: string; source_kind: string; binding_version: number; created_at: string };
type Binding = { source_kind: string; workspace_id: string; project_id: string; payload_record_id: string;
  key_ref: string; content_kind: string; binding_version: number; digest_profile: string };

/** Registers encrypted Proposal identity only; it never grants or dispatches execution. */
export class ProtectedProposalRegistry {
  private readonly store: EncryptedProposalStore;
  constructor(private readonly db: Database.Database, vault: ReservedVault, private readonly clock: () => string = () => new Date().toISOString()) {
    this.store = new EncryptedProposalStore(new ReservedPayloadService(db, new ProtectedKeyReservations(db), vault));
  }

  register(input: EncryptedProposalScope): Promise<'REGISTERED' | 'EXISTING'> {
    return this.registerOnce(input);
  }

  /** Expected content can only reject an independently authenticated Proposal. */
  registerMatching(input: EncryptedProposalScope, expected: ProposalVersion): Promise<'REGISTERED' | 'EXISTING'> {
    try {
      const text = JSON.stringify(expected);
      if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 65536) throw new Error('unavailable');
      const snapshot: unknown = JSON.parse(text);
      if (!isDeepStrictEqual(snapshot, expected)) throw new Error('unavailable');
      return this.registerOnce(input, snapshot);
    } catch { return Promise.reject(new Error('PROTECTED_REGISTRY_UNAVAILABLE')); }
  }

  private async registerOnce(input: EncryptedProposalScope, expected?: unknown): Promise<'REGISTERED' | 'EXISTING'> {
    try {
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join(',') !== 'projectId,proposalVersionId,workspaceId'
        || this.db.inTransaction) throw new Error('unavailable');
      const scope = Object.freeze({ ...input });
      if (![scope.workspaceId, scope.projectId, scope.proposalVersionId].every(value => typeof value === 'string' && /^[a-z0-9_-]{1,128}$/i.test(value))) throw new Error('unavailable');
      const initialTime = this.clock();
      const observed = Date.parse(initialTime);
      if (!Number.isFinite(observed) || new Date(observed).toISOString() !== initialTime) throw new Error('unavailable');
      const initial = this.db.transaction(() => ({ captured: this.envelope(scope), catalog: this.catalog(scope) })).immediate();
      const captured = initial.captured;
      if (!captured || !initial.catalog) throw new Error('unavailable');
      const proposal = await this.store.readBound(scope, captured.encoded);
      if (!proposal || (expected !== undefined && !isDeepStrictEqual(proposal, expected)) || this.db.inTransaction) throw new Error('unavailable');
      return this.db.transaction(() => {
        if (this.envelope(scope)?.encoded !== captured.encoded || !isDeepStrictEqual(this.catalog(scope), initial.catalog)
          || !this.current(proposal, observed)) throw new Error('unavailable');
        const ref = this.db.prepare('SELECT workspace_id,project_id,source_kind,binding_version,created_at FROM proposal_authority_refs WHERE proposal_version_id=?').get(scope.proposalVersionId) as Ref | undefined;
        const binding = this.db.prepare('SELECT source_kind,workspace_id,project_id,payload_record_id,key_ref,content_kind,binding_version,digest_profile FROM protected_proposal_bindings WHERE proposal_version_id=?').get(scope.proposalVersionId) as Binding | undefined;
        if (ref || binding) {
          if (!ref || !binding || ref.workspace_id !== scope.workspaceId || ref.project_id !== scope.projectId
            || ref.source_kind !== 'PROTECTED' || ref.binding_version !== 1 || ref.created_at !== proposal.createdAt
            || binding.source_kind !== 'PROTECTED' || binding.workspace_id !== scope.workspaceId || binding.project_id !== scope.projectId
            || binding.payload_record_id !== scope.proposalVersionId || binding.key_ref !== captured.keyRef
            || binding.content_kind !== 'PROPOSAL' || binding.binding_version !== 1 || binding.digest_profile !== 'SAI_PROPOSAL_SHA256_V1') throw new Error('unavailable');
          return 'EXISTING' as const;
        }
        this.db.prepare("INSERT INTO proposal_authority_refs VALUES (?, ?, ?, 'PROTECTED', 1, ?)")
          .run(scope.proposalVersionId, scope.workspaceId, scope.projectId, proposal.createdAt);
        this.db.prepare("INSERT INTO protected_proposal_bindings VALUES (?, 'PROTECTED', ?, ?, ?, ?, 'PROPOSAL', 1, 'SAI_PROPOSAL_SHA256_V1')")
          .run(scope.proposalVersionId, scope.workspaceId, scope.projectId, scope.proposalVersionId, captured.keyRef);
        return 'REGISTERED' as const;
      }).immediate();
    } catch { throw new Error('PROTECTED_REGISTRY_UNAVAILABLE'); }
  }

  private catalog(scope: EncryptedProposalScope): unknown {
    return this.db.prepare(`SELECT w.owner_id,w.status AS workspace_status,w.row_version AS workspace_row_version,
      p.canonical_path,p.canonical_key,p.status AS project_status,p.snapshot_version,p.row_version AS project_row_version,p.default_agent_id,
      a.agent_id,a.agent_version,a.connection,a.availability,a.row_version AS agent_row_version,
      r.executable_path,r.observed_version,r.updated_at AS registration_updated_at,
      f.function_id,f.name AS function_name,f.function_version,f.lifecycle
      FROM workspaces w JOIN projects p ON p.workspace_id=w.workspace_id
      JOIN agents a ON a.workspace_id=w.workspace_id AND a.agent_id=p.default_agent_id
      JOIN local_codex_registrations r ON r.workspace_id=w.workspace_id AND r.agent_id=a.agent_id
      JOIN functions f ON f.agent_id=a.agent_id AND f.name='Codex built-in development' AND f.function_version='1'
      WHERE w.workspace_id=? AND p.project_id=?`).get(scope.workspaceId, scope.projectId) ?? null;
  }

  private current(proposal: ProposalVersion, observed: number): boolean {
    const time = this.clock();
    const now = Date.parse(time), created = Date.parse(proposal.createdAt), expires = Date.parse(proposal.expiresAt);
    const deadline = Date.parse(proposal.fullReview?.deadlineAt ?? '');
    if (![now, created, expires, deadline].every(Number.isFinite) || new Date(now).toISOString() !== time
      || now < observed || now < created || now >= expires || now >= deadline) return false;
    const row = this.db.prepare(`SELECT p.snapshot_version,a.agent_version,a.connection,f.function_version,f.lifecycle
      FROM workspaces w JOIN projects p ON p.workspace_id=w.workspace_id
      JOIN agents a ON a.workspace_id=w.workspace_id AND a.agent_id=p.default_agent_id
      JOIN functions f ON f.agent_id=a.agent_id
      WHERE w.workspace_id=? AND w.owner_id='local-owner' AND w.status='ACTIVE'
        AND p.project_id=? AND p.status='ACTIVE' AND a.agent_id=? AND f.function_id=?`)
      .get(proposal.workspaceId, proposal.projectId, proposal.agentId, proposal.functionId) as { snapshot_version: number; agent_version: string; connection: string; function_version: string; lifecycle: string } | undefined;
    return !!row && String(row.snapshot_version) === proposal.projectSnapshotVersion && row.agent_version === proposal.agentVersion
      && row.connection !== 'DISABLED' && row.function_version === proposal.functionVersion && row.lifecycle === 'ACTIVE'
      && isBuiltinCodexFunction(this.db, proposal.workspaceId, proposal.agentId, proposal.functionId, proposal.functionVersion);
  }

  private envelope(scope: EncryptedProposalScope): { encoded: string; keyRef: string } | null {
    const row = this.db.prepare(`SELECT p.record_id,p.workspace_id,p.project_id,p.content_kind,p.format_version,p.key_ref,p.nonce,p.ciphertext,p.auth_tag,p.created_at,
      r.owner_hash,r.state AS reservation_state,r.created_at AS reservation_created,r.updated_at AS reservation_updated
      FROM protected_payloads p JOIN protected_key_reservations r ON r.record_id=p.record_id AND r.workspace_id=p.workspace_id
        AND r.project_id=p.project_id AND r.key_ref=p.key_ref
      WHERE p.record_id=? AND p.workspace_id=? AND p.project_id=? AND p.content_kind='PROPOSAL' AND r.state='LINKED'`)
      .get(scope.proposalVersionId, scope.workspaceId, scope.projectId) as Envelope | undefined;
    if (!row || row.format_version !== 1 || !Buffer.isBuffer(row.nonce) || row.nonce.length !== 12
      || !Buffer.isBuffer(row.auth_tag) || row.auth_tag.length !== 16 || !Buffer.isBuffer(row.ciphertext)
      || row.ciphertext.length < 1 || row.ciphertext.length > 65536 || !/^[a-f0-9]{64}$/.test(row.owner_hash)
      || !/^pkey-[a-f0-9]{64}$/.test(row.key_ref)) return null;
    return { keyRef: row.key_ref, encoded: JSON.stringify([row.record_id, row.workspace_id, row.project_id, row.content_kind, row.format_version,
      row.key_ref, row.nonce.toString('base64'), row.ciphertext.toString('base64'), row.auth_tag.toString('base64'), row.created_at,
      row.owner_hash, row.reservation_state, row.reservation_created, row.reservation_updated]) };
  }
}
