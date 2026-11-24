import type Database from 'better-sqlite3';
import type { ReservedVault } from './reserved-payload-service.js';
import { LocalGoalDraft } from './local-goal-draft.js';
import { ProtectedProposalIntake } from './protected-proposal-intake.js';
import { ProtectedProposalAuthority } from './protected-proposal-authority.js';

/** Composes protected staging and native confirmation; does not launch a worker. */
export class ProtectedGoalAuthorization {
  private readonly intake: ProtectedProposalIntake;
  private readonly authority: ProtectedProposalAuthority;
  private readonly pending = new Map<string, Promise<{ attemptId: string }>>();

  constructor(db: Database.Database, vault: ReservedVault, private readonly drafts: LocalGoalDraft,
    clock: () => string = () => new Date().toISOString()) {
    this.intake = new ProtectedProposalIntake(db, vault, drafts, clock);
    this.authority = new ProtectedProposalAuthority(db, vault, clock);
  }

  confirm(draftId: string): Promise<{ attemptId: string }> {
    if (typeof draftId !== 'string' || !/^goal-[a-z0-9-]{1,100}$/i.test(draftId)) return Promise.reject(new Error('GOAL_AUTHORIZATION_UNAVAILABLE'));
    const existing = this.pending.get(draftId);
    if (existing) return existing;
    if (this.pending.size >= 8) return Promise.reject(new Error('GOAL_AUTHORIZATION_UNAVAILABLE'));
    const work = this.intake.stage(draftId).then(scope => this.authority.confirmDraftAndQueue(scope, this.drafts, draftId))
      .catch(() => { throw new Error('GOAL_AUTHORIZATION_UNAVAILABLE'); });
    this.pending.set(draftId, work);
    void work.then(() => { if (this.pending.get(draftId) === work) this.pending.delete(draftId); },
      () => { if (this.pending.get(draftId) === work) this.pending.delete(draftId); });
    return work;
  }
}
