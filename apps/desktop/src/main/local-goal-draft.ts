/* eslint-disable no-unused-vars -- constructor properties are used at runtime. */
/* global setTimeout, clearTimeout */
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { createH1ReviewedProposal, type ProposalVersion } from '@super-assistant/domain';
import { builtinCodexFunctionId, isBuiltinCodexFunction } from './local-codex-function.js';
import { findLocalWorkspace } from './local-workspace.js';
import { readProjectHead } from './project-git-baseline.js';

export interface GoalDraftInput { projectId: string; objective: string; criterion: string; }

export function validGoalText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 1000
    && !Array.from(value).some(character => { const code = character.codePointAt(0) ?? 0; return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127; })
    && !/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\uD800-\uDFFF]/u.test(value)
    && !/(?:password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret)["']?\s*[:=]\s*\S+/i.test(value)
    && !/\bBearer\s+[a-z0-9._~+/-]{12,}/i.test(value)
    && !/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(value)
    && !/\b(?:sk|ghp|github_pat)[-_][a-z0-9_-]{16,}/i.test(value)
    && !/\bAKIA[A-Z0-9]{16}\b/.test(value)
    && !/\beyJ[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\.[a-z0-9_-]{10,}\b/i.test(value);
}


type Authority = { workspace: string; canonical_path: string; snapshot_version: number; project_row_version: number; agent_id: string; agent_version: string; agent_row_version: number };
type Entry = { proposal: ProposalVersion; authority: Authority; expires: number; timer: ReturnType<typeof setTimeout> };

/** Ephemeral review only: user text never enters SQLite or a Grant. */
export class LocalGoalDraft {
  private readonly drafts = new Map<string, Entry>();
  private readonly reviewing = new Set<string>();

  constructor(private readonly db: Database.Database, private readonly clock: () => Date = () => new Date()) {}

  private authority(projectId: string): Authority {
    const workspace = findLocalWorkspace(this.db);
    if (!workspace) throw new Error('GOAL_UNAVAILABLE');
    const row = this.db.prepare(`
      SELECT p.canonical_path, p.snapshot_version, p.row_version AS project_row_version,
        a.agent_id, a.agent_version, a.row_version AS agent_row_version
      FROM projects p JOIN agents a ON a.agent_id=p.default_agent_id AND a.workspace_id=p.workspace_id
      WHERE p.workspace_id=? AND p.project_id=? AND p.status='ACTIVE'
    `).get(workspace, projectId) as Omit<Authority, 'workspace'> | undefined;
    if (!row || !Number.isSafeInteger(row.snapshot_version) || row.snapshot_version <= 0
      || !Number.isSafeInteger(row.project_row_version) || row.project_row_version <= 0
      || !Number.isSafeInteger(row.agent_row_version) || row.agent_row_version <= 0
      || !isBuiltinCodexFunction(this.db, workspace, row.agent_id, builtinCodexFunctionId(row.agent_id), '1')) throw new Error('GOAL_UNAVAILABLE');
    return { workspace, ...row };
  }

  private prune(now: number): void {
    for (const [id, entry] of this.drafts) if (entry.expires <= now) this.discard(id);
  }

  discard(id: string): void {
    const entry = this.drafts.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.drafts.delete(id);
  }

  create(input: GoalDraftInput): string {
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).sort().join(',') !== 'criterion,objective,projectId'
      || typeof input.projectId !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(input.projectId)
      || !validGoalText(input.objective) || !validGoalText(input.criterion)) throw new Error('GOAL_INVALID');
    const created = this.clock().getTime();
    if (!Number.isSafeInteger(created)) throw new Error('GOAL_UNAVAILABLE');
    this.prune(created);
    if (this.drafts.size >= 8) throw new Error('GOAL_UNAVAILABLE');
    const observed = this.authority(input.projectId);
    const baselineCommit = readProjectHead(observed.canonical_path);
    if (!baselineCommit) throw new Error('GOAL_UNAVAILABLE');
    const authority = this.db.transaction(() => {
      const current = this.authority(input.projectId);
      if (JSON.stringify(current) !== JSON.stringify(observed)) throw new Error('GOAL_UNAVAILABLE');
      return current;
    }).immediate();
    const iso = (offset: number) => new Date(created + offset).toISOString();
    const objective = input.objective.trim();
    const token = randomUUID();
    const draftId = 'goal-' + token;
    const functionId = builtinCodexFunctionId(authority.agent_id);
    const proposal = createH1ReviewedProposal('goal-review-' + token, {
      objective, workspaceId: authority.workspace, projectId: input.projectId, agentId: authority.agent_id, functionId,
      projectSnapshotVersion: String(authority.snapshot_version), agentVersion: authority.agent_version,
      functionVersion: '1', capabilityVersion: '1', baselineCommit,
      createdAt: iso(0), expiresAt: iso(900000), deadlineAt: iso(900000),
      budget: { maxDurationMs: 300000, maxTokens: null, maxCost: null },
      capabilities: [{ id: 'codex-file-write', version: '1' }],
      workItems: [{ id: randomUUID(), projectId: input.projectId, agentId: authority.agent_id, functionId, objective, required: true, dependencies: [] }],
      resources: [{ key: 'project:' + input.projectId, intent: 'WRITE' }],
      allowedActions: ['FILE_WRITE'], forbiddenActions: ['COMMAND', 'NETWORK', 'EXTERNAL_WRITE', 'CREDENTIAL'],
      reconfirmationTriggers: ['Project, Agent, Function, baseline or permissions change'],
      risk: 'HIGH', acceptanceCriteria: [{ criterion: input.criterion.trim(), evidence: 'User review of the resulting Project changes' }]
    });
    const timer = setTimeout(() => this.discard(draftId), 900000);
    timer.unref();
    this.drafts.set(draftId, { proposal, authority, expires: created + 900000, timer });
    return draftId;
  }

  prepare(id: string): ProposalVersion {
    if (!/^goal-[a-z0-9-]{1,100}$/i.test(id)) throw new Error('GOAL_UNAVAILABLE');
    const proposal = this.read('goal-review-' + id.slice(5));
    if (!proposal) throw new Error('GOAL_UNAVAILABLE');
    return proposal;
  }

  async review(id: string, presenter: (proposal: ProposalVersion) => Promise<boolean>): Promise<boolean> {
    if (this.reviewing.has(id)) return false;
    this.reviewing.add(id);
    try { return await presenter(this.prepare(id)) === true; }
    catch { return false; }
    finally { this.reviewing.delete(id); this.discard(id); }
  }

  read(id: string): ProposalVersion | null {
    try {
      if (!/^goal-review-[a-z0-9-]{1,100}$/i.test(id)) return null;
      const now = this.clock().getTime();
      if (!Number.isSafeInteger(now)) return null;
      this.prune(now);
      const entry = this.drafts.get('goal-' + id.slice('goal-review-'.length));
      if (!entry?.proposal.fullReview || now < Date.parse(entry.proposal.createdAt) || now >= entry.expires) return null;
      const observed = this.authority(entry.proposal.projectId);
      if (JSON.stringify(observed) !== JSON.stringify(entry.authority)
        || readProjectHead(observed.canonical_path) !== entry.proposal.baselineCommit) return null;
      return this.db.transaction(() => {
        if (JSON.stringify(this.authority(entry.proposal.projectId)) !== JSON.stringify(entry.authority)) return null;
        const reconstructed = createH1ReviewedProposal(id, entry.proposal.fullReview);
        return reconstructed.digest === entry.proposal.digest ? reconstructed : null;
      }).immediate();
    } catch { return null; }
  }
}
