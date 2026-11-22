import { expect, test, vi } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';
import { createFoundationDatabase } from '../../../../packages/persistence/src/sqlite/database.js';
import { SqliteFoundationRepository } from '../../../../packages/persistence/src/repositories/foundation-repository.js';
import { ProposalDraftStore } from '../../src/main/proposal-draft-store.js';
import { builtinCodexFunctionId, provisionBuiltinCodexFunction } from '../../src/main/local-codex-function.js';

test('persists only locally scoped immutable drafts and verifies stored content', () => {
  const temp = realpathSync(tmpdir());
  const root = mkdtempSync(join(temp, 'sa-draft-baseline-'));
  const db = createFoundationDatabase(':memory:');
  try {
    const projectDir = join(root, 'project');
    const child = join(projectDir, 'child');
    const unborn = join(root, 'unborn');
    mkdirSync(projectDir);
    mkdirSync(child);
    mkdirSync(unborn);
    const gitEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' };
    const git = (path: string, ...args: string[]) => execFileSync('git', ['-C', path, '-c', 'user.name=Test Fixture', '-c', 'user.email=fixture@example.test',
      '-c', 'commit.gpgSign=false', '-c', `core.hooksPath=${join(root, 'no-hooks')}`, ...args], { env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim();
    git(projectDir, 'init', '--quiet');
    git(unborn, 'init', '--quiet');
    git(projectDir, 'commit', '--allow-empty', '-qm', 'first baseline');
    const baseline = git(projectDir, 'rev-parse', 'HEAD');
    const repo = new SqliteFoundationRepository(db);
    const w = repo.createWorkspace({ ownerId: 'local-owner', name: 'Local' });
    const a = repo.createAgent({ workspaceId: w.workspaceId, name: 'Codex', connection: 'UNAVAILABLE', availability: 'PAUSED', agentVersion: '0.121.0' });
    const p = repo.createProject({ workspaceId: w.workspaceId, name: 'P', canonicalPath: realpathSync(projectDir).replaceAll('\\', '/'), defaultAgentId: a.agentId, snapshotVersion: 1 });
    db.prepare("UPDATE projects SET status = 'ACTIVE' WHERE project_id = ?").run(p.projectId);
    db.prepare("INSERT INTO local_codex_registrations VALUES (?, ?, 'E:/fake.exe', '0.121.0', '2026')").run(w.workspaceId, a.agentId);
    provisionBuiltinCodexFunction(db, w.workspaceId, a.agentId, '0.121.0');
    const fn = { functionId: builtinCodexFunctionId(a.agentId) };
    const candidate = {
      objective: 'Update', workspaceId: w.workspaceId, projectId: p.projectId, agentId: a.agentId, functionId: fn.functionId,
      projectSnapshotVersion: '1', agentVersion: '0.121.0', functionVersion: '1', capabilityVersion: '1', baselineCommit: baseline,
      createdAt: '2026-08-13T00:00:00.000Z', expiresAt: '2026-08-13T01:00:00.000Z', deadlineAt: '2026-08-13T02:00:00.000Z',
      budget: { maxDurationMs: 1, maxTokens: null, maxCost: null }, capabilities: [{ id: 'code', version: '1' }],
      workItems: [{ id: 'work', projectId: p.projectId, agentId: a.agentId, functionId: fn.functionId, objective: 'Update', required: true, dependencies: [] }],
      resources: [{ key: 'project:p', intent: 'WRITE' }], allowedActions: ['FILE_WRITE'], forbiddenActions: [],
      reconfirmationTriggers: ['change'], risk: 'HIGH', acceptanceCriteria: [{ criterion: 'passes', evidence: 'test log' }]
    };
    const store = new ProposalDraftStore(db);
    expect(() => store.create({ ...candidate, projectSnapshotVersion: '2' })).toThrow();
    expect(() => store.create({ ...candidate, budget: null })).toThrow();
    for (const invalid of ['0'.repeat(40), baseline.slice(0, 12), 'HEAD']) {
      expect(() => store.create({ ...candidate, baselineCommit: invalid })).toThrow('DRAFT_BASELINE_UNVERIFIED');
    }
    const setPath = db.prepare('UPDATE projects SET canonical_path = ? WHERE project_id = ?');
    setPath.run(child, p.projectId);
    expect(() => store.create(candidate)).toThrow('DRAFT_BASELINE_UNVERIFIED');
    setPath.run(unborn, p.projectId);
    expect(() => store.create(candidate)).toThrow('DRAFT_BASELINE_UNVERIFIED');
    setPath.run(join(root, 'missing'), p.projectId);
    expect(() => store.create(candidate)).toThrow('DRAFT_BASELINE_UNVERIFIED');
    expect(db.prepare('SELECT count(*) AS count FROM proposal_candidate_drafts').get()).toEqual({ count: 0 });
    const canonical = realpathSync(projectDir).replaceAll('\\', '/');
    setPath.run(process.platform === 'win32' ? canonical.replace(/project$/, 'PROJECT') : canonical, p.projectId);
    vi.stubEnv('GIT_DIR', join(unborn, '.git'));
    vi.stubEnv('GIT_WORK_TREE', unborn);
    const id = store.create(candidate);
    vi.unstubAllEnvs();
    git(projectDir, 'commit', '--allow-empty', '-qm', 'advanced baseline');
    expect(() => store.create(candidate)).toThrow('DRAFT_BASELINE_UNVERIFIED');
    const currentCandidate = { ...candidate, baselineCommit: git(projectDir, 'rev-parse', 'HEAD') };
    expect(store.get(store.create(currentCandidate))).toEqual(currentCandidate);
    expect(store.get(id)).toEqual(candidate);
    const reopened = new Database(db.serialize());
    try { expect(new ProposalDraftStore(reopened).get(id)).toEqual(candidate); }
    finally { reopened.close(); }
    expect(() => db.prepare("UPDATE proposal_candidate_drafts SET payload_json = '{}' WHERE draft_id = ?").run(id)).toThrow();
    expect(() => db.prepare('DELETE FROM proposal_candidate_drafts WHERE draft_id = ?').run(id)).toThrow();
    expect(db.prepare('SELECT count(*) AS count FROM authorization_grants').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT count(*) AS count FROM tasks').get()).toEqual({ count: 0 });
    db.prepare("UPDATE workspaces SET status = 'LOCKED' WHERE workspace_id = ?").run(w.workspaceId);
    expect(() => store.get(id)).toThrow();
    db.prepare("UPDATE workspaces SET status = 'ACTIVE' WHERE workspace_id = ?").run(w.workspaceId);
    db.prepare("UPDATE workspaces SET owner_id = 'other-owner' WHERE workspace_id = ?").run(w.workspaceId);
    repo.createWorkspace({ ownerId: 'local-owner', name: 'Another local workspace' });
    expect(() => store.get(id)).toThrow();
    db.prepare("UPDATE workspaces SET status = 'ARCHIVED' WHERE owner_id = 'local-owner'").run();
    db.prepare("UPDATE workspaces SET owner_id = 'local-owner' WHERE workspace_id = ?").run(w.workspaceId);
    db.exec('DROP TRIGGER proposal_candidate_drafts_immutable_update');
    db.prepare("UPDATE proposal_candidate_drafts SET payload_json = '{}' WHERE draft_id = ?").run(id);
    expect(() => store.get(id)).toThrow();
  } finally {
    vi.unstubAllEnvs();
    db.close();
    if (dirname(root) === temp && basename(root).startsWith('sa-draft-baseline-')) rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
