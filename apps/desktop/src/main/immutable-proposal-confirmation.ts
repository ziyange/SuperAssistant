/* eslint-disable no-unused-vars -- callback arguments describe the main-process boundary. */
import { createH1ReviewedProposal, createProposalVersion, type ProposalVersion } from '@super-assistant/domain';

/** Does not issue grants or execute: the caller must recheck live authority atomically. */
export class ImmutableProposalConfirmation {
  private readonly pending = new Set<string>();

  constructor(
    private readonly read: (id: string) => ProposalVersion | null | Promise<ProposalVersion | null>,
    private readonly showNative: (fullReview: string) => Promise<boolean>
  ) {}

  private async verified(id: string, digest: string): Promise<ProposalVersion | undefined> {
    const proposal = await this.read(id);
    if (!proposal || proposal.proposalVersionId !== id || proposal.digest !== digest || !proposal.fullReview) return;
    const now = Date.now();
    if (!Number.isFinite(now) || now < Date.parse(proposal.createdAt)
      || now >= Date.parse(proposal.expiresAt) || now >= Date.parse(proposal.fullReview.deadlineAt)) return;
    const { digest: stored, ...fields } = proposal;
    if (createProposalVersion(fields).digest !== stored || createH1ReviewedProposal(id, proposal.fullReview).digest !== stored) return;
    return proposal;
  }

  async confirm(id: string, digest: string): Promise<boolean> {
    if (typeof id !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(id)
      || typeof digest !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(digest) || this.pending.size > 0) return false;
    this.pending.add(id);
    try {
      const before = await this.verified(id, digest);
      if (!before?.fullReview) return false;
      const shown = JSON.stringify(before.fullReview);
      // The native presenter must not receive hidden text direction controls or
      // unbounded content that could be clipped or make a decision unreadable.
      if (shown.length > 8192 || /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(shown)) return false;
      if (await this.showNative(shown) !== true) return false;
      const after = await this.verified(id, digest);
      return !!after?.fullReview && JSON.stringify(after.fullReview) === shown;
    } catch { return false; }
    finally { this.pending.delete(id); }
  }
}
