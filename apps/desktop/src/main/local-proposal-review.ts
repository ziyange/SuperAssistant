import type Database from 'better-sqlite3';
import { createH1ReviewedProposal, createProposalVersion, type H1ProposalCandidate, type ProposalVersion } from '@super-assistant/domain';
import { SqliteProposalRepository } from '@super-assistant/persistence';
import { ProposalDraftStore } from './proposal-draft-store.js';
import { checkLocalProposalCatalog } from './proposal-catalog-check.js';
import { findLocalWorkspace } from './local-workspace.js';
import { readProjectHead } from './project-git-baseline.js';

/** A review is a draft snapshot, not proof that any Function may execute. */
export class LocalProposalReview {
  private readonly drafts: ProposalDraftStore;
  private readonly proposals: SqliteProposalRepository;

  constructor(private readonly database: Database.Database) {
    this.drafts = new ProposalDraftStore(database);
    this.proposals = new SqliteProposalRepository(database);
  }

  private authority(candidate: H1ProposalCandidate): { path: string; rowVersion: number } | null {
    if (candidate.workspaceId !== findLocalWorkspace(this.database)
      || checkLocalProposalCatalog(this.database, candidate).status !== 'REQUIRES_LIVE_VERIFICATION') return null;
    const row = this.database.prepare('SELECT canonical_path, row_version FROM projects WHERE workspace_id=? AND project_id=?')
      .get(candidate.workspaceId, candidate.projectId) as { canonical_path: string; row_version: number } | undefined;
    return row ? { path: row.canonical_path, rowVersion: row.row_version } : null;
  }

  prepare(draftId: string): ProposalVersion {
    const draft = this.drafts.get(draftId);
    const observed = this.authority(draft);
    if (!observed || readProjectHead(observed.path) !== draft.baselineCommit) throw new Error('REVIEW_STALE');
    const proposal = createH1ReviewedProposal('review-' + draftId, draft);
    return this.database.transaction(() => {
      const latestDraft = this.drafts.get(draftId);
      if (createH1ReviewedProposal(proposal.proposalVersionId, latestDraft).digest !== proposal.digest) throw new Error('REVIEW_STALE');
      const current = this.authority(draft);
      if (!current || current.path !== observed.path || current.rowVersion !== observed.rowVersion) throw new Error('REVIEW_STALE');
      const existing = this.proposals.get(proposal.proposalVersionId);
      if (existing) {
        const { digest, ...fields } = existing;
        if (!existing.fullReview || digest !== proposal.digest || createProposalVersion(fields).digest !== digest
          || createH1ReviewedProposal(existing.proposalVersionId, existing.fullReview).digest !== digest) throw new Error('REVIEW_MISMATCH');
        return existing;
      }
      this.proposals.save(proposal);
      return proposal;
    }).immediate();
  }

  read(id: string): ProposalVersion | null {
    try {
      const proposal = this.proposals.get(id);
      if (!proposal?.fullReview) return null;
      if (!id.startsWith('review-')) return null;
      const observed = this.authority(proposal.fullReview);
      if (!observed || readProjectHead(observed.path) !== proposal.fullReview.baselineCommit) return null;
      return this.database.transaction(() => {
        const currentDraft = this.drafts.get(id.slice('review-'.length));
        const latest = this.proposals.get(id);
        if (!latest?.fullReview || latest.digest !== proposal.digest) return null;
        const current = this.authority(latest.fullReview);
        if (!current || current.path !== observed.path || current.rowVersion !== observed.rowVersion) return null;
        const { digest, ...fields } = latest;
        if (createProposalVersion(fields).digest !== digest || createH1ReviewedProposal(id, latest.fullReview).digest !== digest
          || createH1ReviewedProposal(id, currentDraft).digest !== digest) return null;
        return latest;
      }).immediate();
    } catch { return null; }
  }
}
