/* eslint-disable no-unused-vars -- fixture port parameter names document the test boundary. */
import { isDeepStrictEqual } from 'node:util';
import type { EncryptedProposalScope } from './encrypted-proposal-store.js';
import { ProtectedProposalAuthority } from './protected-proposal-authority.js';
import { GitWorktreeService } from './worktree-service.js';

type ReceiptWriter = Awaited<ReturnType<ProtectedProposalAuthority['prepareReceipt']>>;
type Receipt = Parameters<ReceiptWriter['record']>[0];
type FixtureClient = {
  initialize(): Promise<void>;
  start(cwd: string, objective: string): Promise<Receipt>;
  dispose(): void;
};
type FixtureFactory = (version: string, onUnknown: () => boolean, record: (receipt: Receipt) => boolean, cwd: string) => FixtureClient;

/** Test-only composition; its injected transport is not process custody or confinement proof. */
export class FixtureProtectedDispatch {
  private currentState: 'IDLE' | 'STARTING' | 'RUNNING' | 'UNKNOWN' | 'PERSISTENCE_FAILED' = 'IDLE';
  public get state(): 'IDLE' | 'STARTING' | 'RUNNING' | 'UNKNOWN' | 'PERSISTENCE_FAILED' { return this.currentState; }

  constructor(private readonly authority: ProtectedProposalAuthority, private readonly worktreeRoot: string,
    private readonly principalHash: string, private readonly createFixtureClient: FixtureFactory) {}

  async start(scope: EncryptedProposalScope): Promise<{ attemptId: string; cwd: string; receipt: Receipt }> {
    if (this.currentState !== 'IDLE' || !/^[a-f0-9]{64}$/.test(this.principalHash)) throw new Error('FIXTURE_DISPATCH_UNAVAILABLE');
    this.currentState = 'STARTING';
    let claimed: Awaited<ReturnType<ProtectedProposalAuthority['claimQueuedContext']>>;
    try { claimed = await this.authority.claimQueuedContext(scope); }
    catch { this.currentState = 'IDLE'; throw new Error('FIXTURE_DISPATCH_UNAVAILABLE'); }
    let writer: ReceiptWriter | undefined;
    let client: FixtureClient | undefined;
    let quarantined = false;
    let acceptingReceipt = false;
    let recordedReceipt: Receipt | undefined;
    const markUnknown = (): boolean => {
      if (quarantined) return true;
      if (this.currentState === 'PERSISTENCE_FAILED') return false;
      let success = false;
      try { success = writer ? writer.markUnknown() : this.authority.quarantineClaim(scope, claimed.claimToken); } catch { /* preserve uncertainty */ }
      if (success) { quarantined = true; this.currentState = 'UNKNOWN'; }
      else this.currentState = 'PERSISTENCE_FAILED';
      return success;
    };
    try {
      const worktree = new GitWorktreeService().create({
        projectId: claimed.projectId, taskId: claimed.taskId, projectPath: claimed.projectPath,
        worktreeRoot: this.worktreeRoot, baselineCommit: claimed.baselineCommit
      } as Parameters<GitWorktreeService['create']>[0]);
      writer = await this.authority.prepareReceipt(scope, claimed.claimToken, { cwd: worktree.path, principalHash: this.principalHash });
      client = this.createFixtureClient(claimed.executableVersion, markUnknown, receipt => {
        if (!acceptingReceipt || quarantined || this.currentState !== 'STARTING' || !writer?.record(receipt)) return false;
        recordedReceipt = { ...receipt };
        return true;
      }, worktree.path);
      await client.initialize();
      if (quarantined || this.currentState !== 'STARTING') throw new Error('FIXTURE_OUTCOME_UNKNOWN');
      acceptingReceipt = true;
      const receipt = await client.start(worktree.path, claimed.objective);
      acceptingReceipt = false;
      if (quarantined || this.currentState !== 'STARTING' || !recordedReceipt || !isDeepStrictEqual(receipt, recordedReceipt)) {
        throw new Error('FIXTURE_OUTCOME_UNKNOWN');
      }
      this.currentState = 'RUNNING';
      return { attemptId: claimed.attemptId, cwd: worktree.path, receipt };
    } catch {
      const recorded = markUnknown();
      try { client?.dispose(); } catch { /* do not mask the uncertain result */ }
      if (!recorded) throw new Error('FIXTURE_QUARANTINE_FAILED');
      throw new Error('FIXTURE_OUTCOME_UNKNOWN');
    }
  }
}
