/* eslint-disable no-unused-vars -- parameter properties define the trusted main-process boundary. */
import { isDeepStrictEqual } from 'node:util';
import type Database from 'better-sqlite3';
import { EncryptedProposalStore, type EncryptedProposalScope } from './encrypted-proposal-store.js';
import type { LocalGoalDraft } from './local-goal-draft.js';
import { ProtectedKeyReservations } from './protected-key-reservations.js';
import { ProtectedProposalRegistry } from './protected-proposal-registry.js';
import { ReservedPayloadService, type ReservedVault } from './reserved-payload-service.js';

/** Staging is not native approval, authorization, process ownership or dispatch. */
export class ProtectedProposalIntake {
  private readonly pending = new Map<string, Promise<EncryptedProposalScope>>();
  private readonly journal: ProtectedKeyReservations;
  private readonly store: EncryptedProposalStore;
  private readonly registry: ProtectedProposalRegistry;

  constructor(private readonly db: Database.Database, vault: ReservedVault, private readonly drafts: LocalGoalDraft,
    clock: () => string = () => new Date().toISOString()) {
    this.journal = new ProtectedKeyReservations(db);
    this.store = new EncryptedProposalStore(new ReservedPayloadService(db, this.journal, vault));
    this.registry = new ProtectedProposalRegistry(db, vault, clock);
  }

  stage(draftId: string): Promise<EncryptedProposalScope> {
    if (typeof draftId !== 'string' || !/^goal-[a-z0-9-]{1,100}$/i.test(draftId) || this.db.inTransaction) {
      return Promise.reject(new Error('PROTECTED_INTAKE_UNAVAILABLE'));
    }
    const existing = this.pending.get(draftId);
    if (existing) return existing;
    if (this.pending.size >= 8) return Promise.reject(new Error('PROTECTED_INTAKE_UNAVAILABLE'));
    const pending = this.stageOnce(draftId);
    this.pending.set(draftId, pending);
    void pending.then(() => { if (this.pending.get(draftId) === pending) this.pending.delete(draftId); },
      () => { if (this.pending.get(draftId) === pending) this.pending.delete(draftId); });
    return pending;
  }

  private async stageOnce(draftId: string): Promise<EncryptedProposalScope> {
    try {
      const proposal = await this.drafts.prepare(draftId);
      if (this.db.inTransaction || !proposal.fullReview || proposal.proposalVersionId !== 'goal-review-' + draftId.slice(5)) throw new Error('unavailable');
      const scope = Object.freeze({ workspaceId: proposal.workspaceId, projectId: proposal.projectId, proposalVersionId: proposal.proposalVersionId });
      const reservationScope = { workspaceId: scope.workspaceId, projectId: scope.projectId, recordId: scope.proposalVersionId };
      const state = this.journal.inspect(reservationScope);
      if (state === 'ABSENT') await this.store.save(scope, proposal);
      else if (state === 'LINKED') {
        if (!isDeepStrictEqual(await this.store.read(scope), proposal)) throw new Error('unavailable');
      } else throw new Error('unavailable');
      if (this.db.inTransaction || !isDeepStrictEqual(await this.drafts.prepare(draftId), proposal) || this.db.inTransaction) throw new Error('unavailable');
      await this.registry.registerMatching(scope, proposal);
      if (this.db.inTransaction || !isDeepStrictEqual(await this.drafts.prepare(draftId), proposal) || this.db.inTransaction) throw new Error('unavailable');
      return scope;
    } catch { throw new Error('PROTECTED_INTAKE_UNAVAILABLE'); }
  }
}
