/* eslint-disable no-unused-vars -- constructor property defines the storage boundary. */
import { Buffer } from 'node:buffer';
import { isDeepStrictEqual } from 'node:util';
import { createH1ReviewedProposal, type ProposalVersion } from '@super-assistant/domain';
import { ReservedPayloadService } from './reserved-payload-service.js';

export interface EncryptedProposalScope {
  workspaceId: string;
  projectId: string;
  proposalVersionId: string;
}
function scopeFor(input: EncryptedProposalScope) {
  const scope = { ...input };
  if (typeof scope.workspaceId !== 'string' || typeof scope.projectId !== 'string'
    || typeof scope.proposalVersionId !== 'string'
    || !/^[a-z0-9_-]{1,128}$/i.test(scope.workspaceId)
    || !/^[a-z0-9_-]{1,128}$/i.test(scope.projectId)
    || !/^[a-z0-9_-]{1,128}$/i.test(scope.proposalVersionId)) throw new Error('Proposal scope rejected');
  return { workspaceId: scope.workspaceId, projectId: scope.projectId, recordId: scope.proposalVersionId, kind: 'PROPOSAL' as const };
}
function verify(value: unknown, scope: EncryptedProposalScope): ProposalVersion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Proposal rejected');
  const proposal = value as ProposalVersion;
  if (!proposal.fullReview || proposal.proposalVersionId !== scope.proposalVersionId
    || proposal.workspaceId !== scope.workspaceId || proposal.projectId !== scope.projectId) throw new Error('Proposal rejected');
  const rebuilt = createH1ReviewedProposal(scope.proposalVersionId, proposal.fullReview);
  if (!isDeepStrictEqual(proposal, rebuilt)) throw new Error('Proposal rejected');
  return rebuilt;
}

/** Isolated storage only; does not authorize or dispatch a Proposal. */
export class EncryptedProposalStore {
  constructor(private readonly protectedPayloads: ReservedPayloadService) {}

  async save(input: EncryptedProposalScope, proposal: unknown): Promise<void> {
    const scope = { ...input };
    const payloadScope = scopeFor(scope);
    let text: string;
    try {
      const normalized = verify(proposal, scope);
      text = JSON.stringify(normalized);
      if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 65536) throw new Error('Proposal too large');
      verify(JSON.parse(text) as unknown, scope);
    } catch { throw new Error('Proposal rejected'); }
    try { await this.protectedPayloads.create(payloadScope, text); }
    catch { throw new Error('Proposal unavailable'); }
  }

  async read(input: EncryptedProposalScope): Promise<ProposalVersion | null> {
    try {
      const scope = { ...input };
      const text = await this.protectedPayloads.read(scopeFor(scope));
      if (Buffer.byteLength(text, 'utf8') > 65536) return null;
      return verify(JSON.parse(text) as unknown, scope);
    } catch { return null; }
  }

  async readBound(input: EncryptedProposalScope, expectedEnvelope: string): Promise<ProposalVersion | null> {
    try {
      const scope = { ...input };
      const text = await this.protectedPayloads.readBound(scopeFor(scope), expectedEnvelope);
      if (Buffer.byteLength(text, 'utf8') > 65536) return null;
      return verify(JSON.parse(text) as unknown, scope);
    } catch { return null; }
  }

  async reconcile(input: EncryptedProposalScope): Promise<'LINKED' | 'UNRESOLVED'> {
    try {
      const scope = { ...input };
      if (await this.protectedPayloads.reconcile(scopeFor(scope)) !== 'LINKED') return 'UNRESOLVED';
      return await this.read(scope) ? 'LINKED' : 'UNRESOLVED';
    } catch { return 'UNRESOLVED'; }
  }
}
