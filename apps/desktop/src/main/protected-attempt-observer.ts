/* eslint-disable no-unused-vars -- parameter property defines the main-only authority boundary. */
import { isDeepStrictEqual } from 'node:util';
import { ReadOnlyAppServerClient } from '@super-assistant/codex-adapter';
import type { EncryptedProposalScope } from './encrypted-proposal-store.js';
import { ProtectedProposalAuthority } from './protected-proposal-authority.js';

type Observation = { attemptId: string; observation: 'OBSERVED_COMPLETED' | 'OBSERVED_FAILED' } | null;
type Pending = { client: ReadOnlyAppServerClient; work: Promise<Observation> };
function validScope(scope: EncryptedProposalScope): boolean {
  return !!scope && typeof scope === 'object' && !Array.isArray(scope)
    && Object.keys(scope).sort().join(',') === 'projectId,proposalVersionId,workspaceId'
    && [scope.workspaceId, scope.projectId, scope.proposalVersionId].every(value => typeof value === 'string' && /^[a-z0-9_-]{1,128}$/i.test(value));
}

/** Observations are not terminal state or Lease-release evidence. */
export class ProtectedAttemptObserver {
  private readonly pending = new Map<string, Pending>();
  constructor(private readonly authority: ProtectedProposalAuthority) {}

  observe(input: EncryptedProposalScope, client: ReadOnlyAppServerClient): Promise<Observation> {
    try {
      if (arguments.length !== 2 || !(this.authority instanceof ProtectedProposalAuthority)
        || !(client instanceof ReadOnlyAppServerClient) || !validScope(input)) return Promise.resolve(null);
      const scope = Object.freeze({ workspaceId: input.workspaceId, projectId: input.projectId, proposalVersionId: input.proposalVersionId });
      const key = JSON.stringify([scope.workspaceId, scope.projectId, scope.proposalVersionId]);
      const existing = this.pending.get(key);
      if (existing) return existing.client === client ? existing.work : Promise.resolve(null);
      if (this.pending.size >= 16) return Promise.resolve(null);
      const work = this.observeOnce(scope, client).catch(() => null);
      this.pending.set(key, { client, work });
      void work.then(() => { if (this.pending.get(key)?.work === work) this.pending.delete(key); });
      return work;
    } catch { return Promise.resolve(null); }
  }

  private async observeOnce(scope: EncryptedProposalScope, client: ReadOnlyAppServerClient): Promise<Observation> {
    const receipt = await this.authority.readReceipt(scope);
    if (!receipt || !client.isReady() || client.recoveryPrincipal() !== receipt.principalHash
      || !await client.verifyRecoveryPrincipal() || !await this.authority.beginReconciliation(scope)) return null;
    const proof = await this.authority.prepareObservation(scope);
    if (!proof || !isDeepStrictEqual(proof.receipt, receipt)) return null;
    const outcome = await client.observeTurn(receipt.threadId, receipt.turnId, receipt.cwd);
    if ((outcome !== 'COMPLETED' && outcome !== 'FAILED') || !await client.verifyRecoveryPrincipal()) return null;
    const refreshed = await this.authority.prepareObservation(scope);
    if (!refreshed || !isDeepStrictEqual(refreshed.receipt, receipt) || !proof.isCurrent()
      || !refreshed.isCurrent() || !client.isReady() || client.recoveryPrincipal() !== receipt.principalHash) return null;
    return { attemptId: receipt.attemptId, observation: outcome === 'COMPLETED' ? 'OBSERVED_COMPLETED' : 'OBSERVED_FAILED' };
  }
}
