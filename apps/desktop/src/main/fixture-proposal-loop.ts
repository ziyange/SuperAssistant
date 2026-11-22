/* eslint-disable no-unused-vars -- port arguments and constructor properties are contract names. */
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { createH1ReviewedProposal, createProposalVersion, type ProposalVersion } from '@super-assistant/domain';
import { SqliteAuthorizationRepository, SqliteExecutionRepository, SqliteOutboxRepository, SqliteProposalRepository, SqliteResourceLeaseRepository } from '@super-assistant/persistence';
import { findLocalWorkspace } from './local-workspace.js';
import { ProposalDraftStore } from './proposal-draft-store.js';
import { checkLocalProposalCatalog } from './proposal-catalog-check.js';
import { readProjectHead } from './project-git-baseline.js';
import { GitWorktreeService } from './worktree-service.js';

export interface FixtureAppServerTransport {
  notify(method: string, params: Record<string, unknown>): void;
  request(method: string, params: Record<string, unknown>): Promise<unknown>;
}

type OwnedAttempt = {
  attempt_id: string; state: string; task_id: string; proposal_version_id: string; proposal_digest: string;
  lease_id: string; fencing_token: number; resource_key: string;
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function protocolId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[^a-z0-9_-]/i.test(value);
}

export class FixtureProposalLoop {
  private connected = false;
  private readonly proposals: SqliteProposalRepository;

  constructor(private readonly database: Database.Database, private readonly rpc: FixtureAppServerTransport,
    private readonly functionId: string, private readonly worktreeRoot: string, private readonly clock: () => string) {
    this.proposals = new SqliteProposalRepository(database);
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const init = record(await this.rpc.request('initialize', { clientInfo: { name: 'super_assistant', version: '0.1.0' } }));
    if (init?.userAgent !== 'fixture-app-server/0.121.0') throw new Error('FUNCTION_UNVERIFIED');
    this.rpc.notify('initialized', {});
    const status = record(await this.rpc.request('account/read', { refreshToken: false }));
    if (status?.requiresOpenaiAuth !== true || record(status.account)?.type !== 'chatgpt') throw new Error('FUNCTION_UNVERIFIED');
    this.connected = true;
  }

  review(draftId: string): ProposalVersion {
    const draft = new ProposalDraftStore(this.database).get(draftId);
    const review = createH1ReviewedProposal(`review-${draftId}`, draft);
    this.assertFunction(review);
    return this.database.transaction(() => {
      const prior = this.proposals.get(review.proposalVersionId);
      if (prior && prior.digest !== review.digest) throw new Error('REVIEW_DIGEST_MISMATCH');
      if (!prior) this.proposals.save(review);
      return review;
    }).immediate();
  }

  confirm(proposalVersionId: string, digest: string): string {
    return this.database.transaction(() => {
      const review = this.readReview(proposalVersionId, digest);
      const prior = this.database.prepare(`
        SELECT a.attempt_id FROM tasks t JOIN work_items w ON w.task_id = t.task_id
        JOIN execution_attempts a ON a.work_item_id = w.work_item_id
        WHERE t.workspace_id = ? AND t.proposal_version_id = ?
      `).all(review.workspaceId, review.proposalVersionId) as { attempt_id: string }[];
      if (prior.length > 1) throw new Error('AMBIGUOUS_APPROVAL');
      if (prior[0]) return prior[0].attempt_id;
      const path = this.currentProjectPath(review);
      if (!path || readProjectHead(path) !== review.baselineCommit) throw new Error('REVIEW_STALE');
      const now = this.clock();
      const grant = new SqliteAuthorizationRepository(this.database, this.clock).issue({
        grantId: randomUUID(), proposal: review, actorId: 'local-owner', idempotencyKey: proposalVersionId, issuedAt: now
      });
      const resourceKey = `project:${review.projectId}`;
      const fence = this.database.prepare('SELECT COALESCE(MAX(fencing_token), 0) AS token FROM resource_leases WHERE resource_key IN (?, ?)').get(resourceKey, `worktree:${review.projectId}`) as { token: number };
      return new SqliteExecutionRepository(this.database, this.clock).createAuthorizedExecution({
        taskId: randomUUID(), workItemId: randomUUID(), attemptId: randomUUID(), leaseId: randomUUID(), requestId: randomUUID(),
        idempotencyKey: proposalVersionId, workspaceId: review.workspaceId, projectId: review.projectId, agentId: review.agentId,
        functionId: review.functionId, proposalVersionId, authorizationGrantId: grant.grantId, resourceKey, fencingToken: fence.token + 1, createdAt: now
      }).attemptId;
    }).immediate();
  }

  async dispatch(attemptId: string): Promise<void> {
    const claimed = this.database.transaction(() => {
      const owned = this.ownedAttempt(attemptId);
      if (!owned || owned.state !== 'DISPATCH_PENDING') throw new Error('ATTEMPT_NOT_DISPATCHABLE');
      const review = this.readReview(owned.proposal_version_id, owned.proposal_digest);
      const path = this.currentProjectPath(review);
      if (!this.canWrite(owned)) throw new Error('LEASE_NOT_CURRENT');
      const messageId = `outbox:${attemptId}`;
      const claim = randomUUID();
      const updated = this.database.prepare("UPDATE outbox SET state = 'DISPATCHING', claim_token = ? WHERE message_id = ? AND attempt_id = ? AND message_type = 'start' AND state = 'PENDING'").run(claim, messageId, attemptId);
      if (updated.changes !== 1) throw new Error('ATTEMPT_NOT_DISPATCHABLE');
      return { owned, review, path, messageId, claim };
    }).immediate();
    const outbox = new SqliteOutboxRepository(this.database);
    try {
      const worktree = new GitWorktreeService().create({
        projectId: claimed.review.projectId as Parameters<GitWorktreeService['create']>[0]['projectId'],
        taskId: claimed.owned.task_id as Parameters<GitWorktreeService['create']>[0]['taskId'],
        projectPath: claimed.path, worktreeRoot: this.worktreeRoot, baselineCommit: claimed.review.baselineCommit
      });
      const started = record(await this.rpc.request('thread/start', { cwd: worktree.path, approvalPolicy: 'on-request', sandbox: 'workspace-write' }));
      const threadId = record(started?.thread)?.id;
      const stillOwned = this.database.prepare("SELECT 1 FROM outbox WHERE message_id = ? AND state = 'DISPATCHING' AND claim_token = ?").get(claimed.messageId, claimed.claim);
      const current = this.ownedAttempt(attemptId);
      if (!protocolId(threadId) || !stillOwned || current?.state !== 'DISPATCH_PENDING'
        || current.proposal_digest !== claimed.review.digest || !this.canWrite(current)
        || this.currentProjectPath(claimed.review) !== claimed.path || readProjectHead(claimed.path) !== claimed.review.baselineCommit
        || readProjectHead(worktree.path) !== claimed.review.baselineCommit) throw new Error('ATTEMPT_NOT_DISPATCHABLE');
      const startedTurn = record(await this.rpc.request('turn/start', { threadId, input: [{ type: 'text', text: 'fixture:write-result' }] }));
      const turnId = record(startedTurn?.turn)?.id;
      if (!protocolId(turnId)) throw new Error('ATTEMPT_RECEIPT_MISSING');
      this.database.transaction(() => {
        this.database.prepare('INSERT INTO fixture_attempt_correlations VALUES (?, ?, ?)').run(attemptId, threadId, turnId);
        if (!outbox.acknowledge(claimed.messageId, claimed.claim)) throw new Error('CLAIM_LOST');
        const change = this.database.prepare("UPDATE execution_attempts SET state = 'RUNNING' WHERE attempt_id = ? AND state = 'DISPATCH_PENDING'").run(attemptId);
        if (change.changes !== 1) throw new Error('ATTEMPT_CHANGED');
      }).immediate();
    } catch {
      outbox.markUncertain(claimed.messageId, claimed.claim);
      throw new Error('FIXTURE_START_UNCERTAIN');
    }
  }

  async reconcile(attemptId: string): Promise<'UNKNOWN' | 'SUCCEEDED' | 'FAILED'> {
    const attempt = this.ownedAttempt(attemptId);
    if (!this.connected || !attempt || !['UNKNOWN', 'RECONCILING'].includes(attempt.state)) return 'UNKNOWN';
    this.readReview(attempt.proposal_version_id, attempt.proposal_digest);
    const binding = this.binding(attemptId);
    if (!binding || !protocolId(binding.thread_id) || !protocolId(binding.turn_id)) return 'UNKNOWN';
    try {
      const result = record(await this.rpc.request('thread/read', { threadId: binding.thread_id, includeTurns: true }));
      const thread = record(result?.thread);
      if (thread?.id !== binding.thread_id || !Array.isArray(thread.turns)) return 'UNKNOWN';
      const matches = thread.turns.map(record).filter(turn => turn?.id === binding.turn_id);
      if (matches.length !== 1) return 'UNKNOWN';
      const status = matches[0]?.status;
      const outcome = status === 'completed' ? 'SUCCEEDED' : status === 'failed' ? 'FAILED' : 'UNKNOWN';
      if (outcome === 'UNKNOWN') return outcome;
      return this.database.transaction(() => {
        const current = this.ownedAttempt(attemptId);
        const original = this.binding(attemptId);
        if (!current || current.proposal_digest !== attempt.proposal_digest || !original || original.thread_id !== binding.thread_id || original.turn_id !== binding.turn_id) return 'UNKNOWN';
        const change = this.database.prepare("UPDATE execution_attempts SET state = ? WHERE attempt_id = ? AND state IN ('UNKNOWN', 'RECONCILING')").run(outcome, attemptId);
        return change.changes === 1 ? outcome : 'UNKNOWN';
      }).immediate();
    } catch { return 'UNKNOWN'; }
  }

  private binding(attemptId: string): { thread_id: string; turn_id: string } | undefined {
    return this.database.prepare('SELECT thread_id, turn_id FROM fixture_attempt_correlations WHERE attempt_id = ?').get(attemptId) as { thread_id: string; turn_id: string } | undefined;
  }

  private readReview(id: string, digest: string): ProposalVersion {
    const review = this.proposals.get(id);
    if (!review?.fullReview || review.workspaceId !== findLocalWorkspace(this.database)) throw new Error('REVIEW_UNAVAILABLE');
    const { digest: stored, ...input } = review;
    if (digest !== stored || createProposalVersion(input).digest !== stored
      || createH1ReviewedProposal(id, review.fullReview).digest !== stored) throw new Error('REVIEW_DIGEST_MISMATCH');
    this.assertFunction(review);
    return review;
  }

  private assertFunction(review: ProposalVersion): void {
    const full = review.fullReview;
    if (!this.connected || !full || review.agentVersion !== '0.121.0' || review.functionId !== this.functionId
      || review.functionVersion !== '1' || review.capabilityVersion !== '1.0.0'
      || full.capabilities.length !== 1 || full.capabilities[0]?.id !== 'fixture-write' || full.capabilities[0].version !== '1.0.0'
      || full.allowedActions.length !== 1 || full.allowedActions[0] !== 'FILE_WRITE'
      || full.resources.length !== 1 || full.resources[0]?.key !== 'fixture:result.txt' || full.resources[0].intent !== 'WRITE'
      || full.budget.maxTokens !== null || full.budget.maxCost !== null || full.budget.maxDurationMs !== 5000) throw new Error('FUNCTION_UNVERIFIED');
  }

  private currentProjectPath(review: ProposalVersion): string {
    const now = Date.parse(this.clock());
    if (!review.fullReview || !Number.isFinite(now) || now < Date.parse(review.createdAt) || now >= Date.parse(review.expiresAt)
      || now >= Date.parse(review.fullReview.deadlineAt) || checkLocalProposalCatalog(this.database, review.fullReview).status !== 'REQUIRES_LIVE_VERIFICATION') throw new Error('REVIEW_STALE');
    const row = this.database.prepare(`
      SELECT p.canonical_path FROM projects p
      JOIN agents a ON a.workspace_id = p.workspace_id AND a.agent_id = p.default_agent_id
      WHERE p.workspace_id = ? AND p.project_id = ? AND a.agent_id = ?
        AND a.connection = 'CONNECTED' AND a.availability = 'AVAILABLE'
    `).get(review.workspaceId, review.projectId, review.agentId) as { canonical_path: string } | undefined;
    if (!row) throw new Error('REVIEW_STALE');
    return row.canonical_path;
  }

  private ownedAttempt(attemptId: string): OwnedAttempt | undefined {
    const workspace = findLocalWorkspace(this.database);
    if (!workspace) return undefined;
    const rows = this.database.prepare(`
      SELECT a.attempt_id, a.state, t.task_id, t.proposal_version_id, g.proposal_digest, l.lease_id, l.fencing_token, l.resource_key
      FROM execution_attempts a JOIN work_items w ON w.work_item_id = a.work_item_id JOIN tasks t ON t.task_id = w.task_id
      JOIN authorization_grants g ON g.grant_id = t.authorization_grant_id AND g.proposal_version_id = t.proposal_version_id AND g.status = 'CONSUMED'
      JOIN proposal_full_reviews r ON r.proposal_version_id = t.proposal_version_id
      JOIN resource_leases l ON l.attempt_id = a.attempt_id AND l.resource_key = 'project:' || t.project_id
      WHERE a.attempt_id = ? AND t.workspace_id = ? AND g.actor_id = 'local-owner' LIMIT 2
    `).all(attemptId, workspace) as OwnedAttempt[];
    return rows.length === 1 ? rows[0] : undefined;
  }

  private canWrite(owned: OwnedAttempt): boolean {
    return new SqliteResourceLeaseRepository(this.database, this.clock).canWrite({
      leaseId: owned.lease_id, attemptId: owned.attempt_id, fencingToken: owned.fencing_token
    });
  }
}
