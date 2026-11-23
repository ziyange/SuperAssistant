/* eslint-disable no-unused-vars -- constructor properties are used at runtime. */
/* global setTimeout, clearTimeout, process */
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { isAbsolute } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type Database from 'better-sqlite3';
import { createH1ReviewedProposal, type ProposalVersion } from '@super-assistant/domain';
import { builtinCodexFunctionId, isBuiltinCodexFunction } from './local-codex-function.js';
import { findLocalWorkspace } from './local-workspace.js';
import { readProjectHeadAsync } from './async-project-baseline.js';

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


export type FileFingerprint = { hash: string; dev: string; ino: string; size: string; modified: string; changed: string };
type CatalogAuthority = { workspace: string; canonical_path: string; executable_path: string; snapshot_version: number; project_row_version: number; agent_id: string; agent_version: string; agent_row_version: number };
type Authority = { catalog: CatalogAuthority; binary: FileFingerprint };
type Entry = { proposal: ProposalVersion; authority: Authority; expires: number; timer: ReturnType<typeof setTimeout> };
const genuineDrafts = new WeakSet<LocalGoalDraft>();

const workerSource = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const { createHash } = require('node:crypto');
const { closeSync, fstatSync, openSync, readSync, realpathSync, statSync } = require('node:fs');
try {
  const path = workerData;
  if (realpathSync(path) !== path) throw new Error('invalid');
  const descriptor = openSync(path, 'r');
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.size <= 0n || before.size > 134217728n) throw new Error('invalid');
    const hash = createHash('sha256');
    const buffer = Buffer.allocUnsafe(262144);
    const size = Number(before.size);
    let position = 0;
    while (position < size) {
      const count = readSync(descriptor, buffer, 0, Math.min(buffer.length, size - position), position);
      if (count <= 0) throw new Error('invalid');
      hash.update(buffer.subarray(0, count));
      position += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    const pathStat = statSync(path, { bigint: true });
    const same = other => other.isFile() && other.dev === before.dev && other.ino === before.ino
      && other.size === before.size && other.mtimeNs === before.mtimeNs && other.ctimeNs === before.ctimeNs;
    if (!same(after) || !same(pathStat) || realpathSync(path) !== path) throw new Error('invalid');
    parentPort.postMessage({ hash: hash.digest('hex'), dev: String(before.dev), ino: String(before.ino),
      size: String(before.size), modified: String(before.mtimeNs), changed: String(before.ctimeNs) });
  } finally { closeSync(descriptor); }
} catch { parentPort.postMessage(null); }
`;

let activeFingerprintWorkers = 0;
export function fingerprintExecutable(path: string): Promise<FileFingerprint> {
  if (!isAbsolute(path) || path.startsWith('\\\\') || path.startsWith('//')
    || (process.platform === 'win32' && !/^[a-z]:[\\/]/i.test(path)) || activeFingerprintWorkers >= 2) {
    return Promise.reject(new Error('GOAL_UNAVAILABLE'));
  }
  activeFingerprintWorkers += 1;
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try { worker = new Worker(workerSource, { eval: true, workerData: path }); }
    catch { activeFingerprintWorkers -= 1; reject(new Error('GOAL_UNAVAILABLE')); return; }
    let settled = false;
    let result: FileFingerprint | null = null;
    const fail = () => { if (!settled) { settled = true; clearTimeout(timer); reject(new Error('GOAL_UNAVAILABLE')); } };
    const timer = setTimeout(() => { fail(); void worker.terminate().catch(() => undefined); }, 5000);
    timer.unref();
    worker.once('message', (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const fields = value as Partial<FileFingerprint>;
      if (typeof fields.hash === 'string' && /^[a-f0-9]{64}$/.test(fields.hash)
        && typeof fields.dev === 'string' && typeof fields.ino === 'string' && typeof fields.size === 'string'
        && typeof fields.modified === 'string' && typeof fields.changed === 'string') result = fields as FileFingerprint;
    });
    worker.once('error', fail);
    worker.once('exit', code => {
      activeFingerprintWorkers -= 1;
      if (settled) return;
      if (code !== 0 || !result) { fail(); return; }
      settled = true; clearTimeout(timer); resolve(result);
    });
  });
}

/** Ephemeral review only: user text never enters SQLite or a Grant. */
export class LocalGoalDraft {
  readonly #drafts = new Map<string, Entry>();
  readonly #clock: () => Date;
  private readonly reviewing = new Set<string>();
  private creating = 0;

  constructor(private readonly db: Database.Database, clock: () => Date = () => new Date()) { this.#clock = clock; genuineDrafts.add(this); }

  /** Restrictive, synchronous liveness check; this is not authorization. */
  matchesSnapshot(id: string, expected: ProposalVersion): boolean {
    try {
      if (!genuineDrafts.has(this) || typeof id !== 'string' || !/^goal-[a-z0-9-]{1,100}$/i.test(id)) return false;
      const entry = this.#drafts.get(id);
      const now = this.#clock().getTime();
      return !!entry && this.#drafts.get(id) === entry && Number.isSafeInteger(now) && now >= Date.parse(entry.proposal.createdAt)
        && entry.proposal.proposalVersionId === 'goal-review-' + id.slice(5)
        && now < entry.expires && now < Date.parse(entry.proposal.fullReview?.deadlineAt ?? '')
        && isDeepStrictEqual(entry.proposal, expected);
    } catch { return false; }
  }

  private authority(projectId: string): CatalogAuthority {
    const workspace = findLocalWorkspace(this.db);
    if (!workspace) throw new Error('GOAL_UNAVAILABLE');
    const row = this.db.prepare(`
      SELECT p.canonical_path, r.executable_path, p.snapshot_version, p.row_version AS project_row_version,
        a.agent_id, a.agent_version, a.row_version AS agent_row_version
      FROM projects p JOIN agents a ON a.agent_id=p.default_agent_id AND a.workspace_id=p.workspace_id
      JOIN local_codex_registrations r ON r.agent_id=a.agent_id AND r.workspace_id=a.workspace_id
      WHERE p.workspace_id=? AND p.project_id=? AND p.status='ACTIVE'
    `).get(workspace, projectId) as Omit<CatalogAuthority, 'workspace'> | undefined;
    if (!row || !Number.isSafeInteger(row.snapshot_version) || row.snapshot_version <= 0
      || !Number.isSafeInteger(row.project_row_version) || row.project_row_version <= 0
      || !Number.isSafeInteger(row.agent_row_version) || row.agent_row_version <= 0
      || !isBuiltinCodexFunction(this.db, workspace, row.agent_id, builtinCodexFunctionId(row.agent_id), '1')) throw new Error('GOAL_UNAVAILABLE');
    return { workspace, ...row };
  }

  private prune(now: number): void {
    for (const [id, entry] of this.#drafts) if (entry.expires <= now) this.discard(id);
  }

  discard(id: string): void {
    const entry = this.#drafts.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.#drafts.delete(id);
  }

  async create(input: GoalDraftInput): Promise<string> {
    if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).sort().join(',') !== 'criterion,objective,projectId'
      || typeof input.projectId !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(input.projectId)
      || !validGoalText(input.objective) || !validGoalText(input.criterion)) throw new Error('GOAL_INVALID');
    const created = this.#clock().getTime();
    if (!Number.isSafeInteger(created)) throw new Error('GOAL_UNAVAILABLE');
    this.prune(created);
    if (this.#drafts.size + this.creating >= 8) throw new Error('GOAL_UNAVAILABLE');
    this.creating += 1;
    try {
    const observed = this.authority(input.projectId);
    const binary = await fingerprintExecutable(observed.executable_path);
    const baselineCommit = await readProjectHeadAsync(observed.canonical_path);
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
    this.#drafts.set(draftId, { proposal, authority: { catalog: authority, binary }, expires: created + 900000, timer });
    return draftId;
    } finally { this.creating -= 1; }
  }

  async prepare(id: string): Promise<ProposalVersion> {
    if (!/^goal-[a-z0-9-]{1,100}$/i.test(id)) throw new Error('GOAL_UNAVAILABLE');
    const proposal = await this.read('goal-review-' + id.slice(5));
    if (!proposal) throw new Error('GOAL_UNAVAILABLE');
    return proposal;
  }

  async review(id: string, presenter: (proposal: ProposalVersion) => Promise<boolean>): Promise<boolean> {
    if (this.reviewing.has(id)) return false;
    this.reviewing.add(id);
    try { return await presenter(await this.prepare(id)) === true; }
    catch { return false; }
    finally { this.reviewing.delete(id); this.discard(id); }
  }

  async read(id: string): Promise<ProposalVersion | null> {
    try {
      if (!/^goal-review-[a-z0-9-]{1,100}$/i.test(id)) return null;
      const now = this.#clock().getTime();
      if (!Number.isSafeInteger(now)) return null;
      this.prune(now);
      const draftId = 'goal-' + id.slice('goal-review-'.length);
      const entry = this.#drafts.get(draftId);
      if (!entry?.proposal.fullReview || now < Date.parse(entry.proposal.createdAt) || now >= entry.expires) return null;
      const observed = this.authority(entry.proposal.projectId);
      if (JSON.stringify(observed) !== JSON.stringify(entry.authority.catalog)
        || JSON.stringify(await fingerprintExecutable(observed.executable_path)) !== JSON.stringify(entry.authority.binary)
        || await readProjectHeadAsync(observed.canonical_path) !== entry.proposal.baselineCommit) return null;
      const afterHash = this.#clock().getTime();
      if (!Number.isSafeInteger(afterHash) || afterHash >= entry.expires || this.#drafts.get(draftId) !== entry) return null;
      return this.db.transaction(() => {
        if (JSON.stringify(this.authority(entry.proposal.projectId)) !== JSON.stringify(entry.authority.catalog)) return null;
        const reconstructed = createH1ReviewedProposal(id, entry.proposal.fullReview);
        return reconstructed.digest === entry.proposal.digest ? reconstructed : null;
      }).immediate();
    } catch { return null; }
  }
}
