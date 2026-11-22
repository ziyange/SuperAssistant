/* global URL, setTimeout, clearTimeout */
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { expect, test } from 'vitest';
import { createH1ReviewedProposal } from '@super-assistant/domain';
import { projectGitEnvironment } from '../../src/main/project-git-baseline.js';
import { createFoundationDatabase } from '@super-assistant/persistence';
import { FixtureProposalLoop } from '../../src/main/fixture-proposal-loop.js';
import { ProposalDraftStore } from '../../src/main/proposal-draft-store.js';
import { builtinCodexFunctionId, provisionBuiltinCodexFunction } from '../../src/main/local-codex-function.js';
import { recoverLocalStartup } from '../../src/main/recovery-service.js';

function fakeServer(root: string, receipt: string, mode: string) {
  const fixture = fileURLToPath(new URL('./fixtures/verified-app-server.mjs', import.meta.url));
  const child = spawn(process.execPath, [fixture, receipt, root, mode], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  const output = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const closed = once(child, 'close');
  const methods: string[] = [];
  const observations: Record<string, unknown>[] = [];
  let sequence = 0;
  return {
    methods,
    observations,
    notify(method: string, params: Record<string, unknown>) {
      methods.push(method);
      child.stdin.write(JSON.stringify({ method, params }) + '\n');
    },
    async request(method: string, params: Record<string, unknown>): Promise<unknown> {
      const id = ++sequence;
      methods.push(method);
      if (method === 'thread/read') observations.push(params);
      child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const line = await Promise.race([
          output.next(),
          new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Fixture response timed out')), 4000); })
        ]);
        if (line.done) throw new Error('Fixture closed');
        const parsed = JSON.parse(line.value) as Record<string, unknown>;
        if (parsed.id !== id || 'error' in parsed) throw new Error('Fixture request rejected');
        return parsed.result;
      } finally { if (timer) clearTimeout(timer); }
    },
    async close() { if (!child.stdin.writableEnded) child.stdin.end(); await closed; }
  };
}

test.each(['normal', 'lost-receipt', 'baseline-moved', 'agent-paused'])('fixture fails closed across the original Attempt (%s)', async mode => {
  const lostReceipt = mode === 'lost-receipt';
  const parent = realpathSync.native(tmpdir());
  const root = mkdtempSync(join(parent, 'sa-verified-loop-'));
  const worktrees = join(root, 'worktrees');
  const receipt = join(root, 'receipt.json');
  const source = join(root, 'project');
  const fromGit = (...args: string[]) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', stdio: ['ignore','pipe','ignore'], env: projectGitEnvironment() }).trim();
  const databasePath = join(root, 'fixture.sqlite');
  let db = createFoundationDatabase(databasePath);
  const servers: ReturnType<typeof fakeServer>[] = [];
  const now = () => '2026-08-13T00:00:00.000Z';
  const version = '1.0.0';
  try {
    execFileSync('git', ['init', '--quiet', source], { stdio: 'pipe', env: projectGitEnvironment() });
    fromGit('-c', 'core.hooksPath=' + join(root, 'no-hooks'), '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=Fixture', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'approved baseline');
    const baselineCommit = fromGit('rev-parse', 'HEAD');
    db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace', 'local-owner', 'Fixture', 'ACTIVE', now(), now(), 1);
    db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent', 'workspace', 'Codex', '0.121.0', 'CONNECTED', 'AVAILABLE', null, 1);
    db.prepare('INSERT INTO local_codex_registrations VALUES (?, ?, ?, ?, ?)').run('workspace', 'agent', 'not-launched.exe', '0.121.0', now());
    db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project', 'workspace', 'Fixture', realpathSync(source), realpathSync(source).toLowerCase(), 'ACTIVE', 'agent', 1, now(), now(), 1);
    provisionBuiltinCodexFunction(db, 'workspace', 'agent', '0.121.0');
    const functionId = builtinCodexFunctionId('agent');
    const proposal = {
      objective: 'Produce the fixture file', workspaceId: 'workspace', projectId: 'project', agentId: 'agent', functionId,
      projectSnapshotVersion: '1', agentVersion: '0.121.0', functionVersion: '1', capabilityVersion: version, baselineCommit,
      createdAt: '2026-08-12T00:00:00.000Z', expiresAt: '2026-08-14T00:00:00.000Z', deadlineAt: '2026-08-14T00:00:00.000Z',
      budget: { maxDurationMs: 5000, maxTokens: null, maxCost: null }, capabilities: [{ id: 'fixture-write', version }],
      workItems: [{ id: 'work', projectId: 'project', agentId: 'agent', functionId, objective: 'Produce the fixture file', required: true, dependencies: [] }],
      resources: [{ key: 'fixture:result.txt', intent: 'WRITE' }], allowedActions: ['FILE_WRITE'], forbiddenActions: ['COMMAND'],
      reconfirmationTriggers: ['baseline changed'], risk: 'LOW', acceptanceCriteria: [{ criterion: 'file exists', evidence: 'result.txt' }]
    };
    const drafts = new ProposalDraftStore(db);
    const draftId = drafts.create(proposal);
    const wrong = fakeServer(worktrees, receipt, 'wrong-version');
    servers.push(wrong);
    await expect(new FixtureProposalLoop(db, wrong, functionId, worktrees, now).connect()).rejects.toThrow('FUNCTION_UNVERIFIED');
    const child = fakeServer(worktrees, receipt, lostReceipt ? 'lost-receipt' : 'normal');
    servers.push(child);
    const loop = new FixtureProposalLoop(db, {
      ...child,
      async request(method, params) {
        const result = await child.request(method, params);
        if (mode === 'agent-paused' && method === 'thread/start') db.prepare("UPDATE agents SET availability = 'PAUSED' WHERE agent_id = 'agent'").run();
        return result;
      }
    }, functionId, worktrees, now);
    expect(() => loop.review(draftId)).toThrow('FUNCTION_UNVERIFIED');
    await loop.connect();
    const wrongCapability = drafts.create({ ...proposal, capabilities: [{ id: 'fixture-write', version: '2.0.0' }] });
    expect(() => loop.review(wrongCapability)).toThrow('FUNCTION_UNVERIFIED');
    const review = loop.review(draftId);
    expect(review.fullReview).toEqual(proposal);
    expect(() => createH1ReviewedProposal(review.proposalVersionId, { ...proposal, objective: '\ud800' })).toThrow('Invalid Unicode');
    expect(() => db.prepare("UPDATE proposal_full_reviews SET payload_json = '{}' WHERE proposal_version_id = ?").run(review.proposalVersionId)).toThrow('immutable');
    expect(() => db.prepare("INSERT OR REPLACE INTO proposal_full_reviews VALUES (?, '{}')").run(review.proposalVersionId)).toThrow('immutable');
    const changed = createH1ReviewedProposal(review.proposalVersionId, { ...proposal, budget: { ...proposal.budget, maxDurationMs: 4900 } });
    expect(changed.digest).not.toBe(review.digest);
    expect(() => loop.confirm(review.proposalVersionId, changed.digest)).toThrow('REVIEW_DIGEST_MISMATCH');
    db.prepare("UPDATE projects SET snapshot_version = 2 WHERE project_id = 'project'").run();
    expect(() => loop.confirm(review.proposalVersionId, review.digest)).toThrow('REVIEW_STALE');
    db.prepare("UPDATE projects SET snapshot_version = 1 WHERE project_id = 'project'").run();
    fromGit('-c', 'core.hooksPath=' + join(root, 'no-hooks'), '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=Fixture', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'unapproved baseline');
    expect(() => loop.confirm(review.proposalVersionId, review.digest)).toThrow('REVIEW_STALE');
    fromGit('switch', '--detach', baselineCommit);
    expect(db.prepare('SELECT count(*) AS count FROM authorization_grants').get()).toEqual({ count: 0 });
    expect(existsSync(worktrees)).toBe(false);
    const attemptId = loop.confirm(review.proposalVersionId, review.digest);
    expect(loop.confirm(review.proposalVersionId, review.digest)).toBe(attemptId);
    expect(db.prepare('SELECT proposal_digest FROM authorization_grants').all()).toEqual([{ proposal_digest: review.digest }]);
    if (mode === 'baseline-moved' || mode === 'agent-paused') {
      if (mode === 'baseline-moved') {
        fromGit('switch', '-c', 'alternate-baseline');
        fromGit('-c', 'core.hooksPath=' + join(root, 'no-hooks'), '-c', 'user.email=fixture@example.invalid', '-c', 'user.name=Fixture', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'baseline changed since confirmation');
      }
      await expect(loop.dispatch(attemptId)).rejects.toThrow('FIXTURE_START_UNCERTAIN');
      expect(child.methods.filter(method => method === 'thread/start')).toHaveLength(mode === 'agent-paused' ? 1 : 0);
      expect(child.methods).not.toContain('turn/start');
      expect(existsSync(receipt)).toBe(false);
      expect(db.prepare('SELECT attempt_id, state FROM execution_attempts').all()).toEqual([{ attempt_id: attemptId, state: 'UNKNOWN' }]);
      return;
    }
    const start = lostReceipt ? expect(loop.dispatch(attemptId)).rejects.toThrow('FIXTURE_START_UNCERTAIN') : loop.dispatch(attemptId);
    await expect(loop.dispatch(attemptId)).rejects.toThrow('ATTEMPT_NOT_DISPATCHABLE');
    await start;
    if (!lostReceipt) {
      expect(() => db.prepare("UPDATE fixture_attempt_correlations SET turn_id = 'other-turn' WHERE attempt_id = ?").run(attemptId)).toThrow('immutable');
      expect(() => db.prepare("INSERT OR REPLACE INTO fixture_attempt_correlations VALUES (?, 'fixture-thread', 'other-turn')").run(attemptId)).toThrow('immutable');
    }
    expect(child.methods.filter(method => method === 'turn/start')).toHaveLength(1);
    expect(existsSync(receipt)).toBe(true);
    const original = JSON.parse(readFileSync(receipt, 'utf8')) as { threadId: string; turnId: string };
    expect(db.prepare('SELECT thread_id, turn_id FROM fixture_attempt_correlations').all()).toEqual(lostReceipt ? [] : [{ thread_id: original.threadId, turn_id: original.turnId }]);
    const dirs = readdirSync(worktrees);
    expect(dirs).toHaveLength(1);
    expect(readFileSync(join(worktrees, dirs[0] ?? '', 'result.txt'), 'utf8')).toBe('fixture result\n');
    expect(fromGit('status', '--porcelain')).toBe('');
    expect(fromGit('rev-parse', 'HEAD')).toBe(baselineCommit);
    expect(existsSync(join(source, 'result.txt'))).toBe(false);
    await child.close();
    db.close();
    db = createFoundationDatabase(databasePath);
    recoverLocalStartup(db);
    const observations = lostReceipt ? [] : [{ threadId: original.threadId, includeTurns: true }];
    for (const variant of (lostReceipt ? ['wrong-turn'] : ['wrong-thread', 'wrong-turn', 'duplicate-turn', 'in-progress', 'read-error'])) {
      const restarted = fakeServer(worktrees, receipt, variant);
      servers.push(restarted);
      const recovering = new FixtureProposalLoop(db, restarted, functionId, worktrees, now);
      await recovering.connect();
      expect(await recovering.reconcile(attemptId)).toBe('UNKNOWN');
      expect(restarted.observations).toEqual(observations);
      expect(db.prepare('SELECT attempt_id, state FROM execution_attempts').all()).toEqual([{ attempt_id: attemptId, state: 'UNKNOWN' }]);
      await restarted.close();
    }
    const honest = fakeServer(worktrees, receipt, 'normal');
    servers.push(honest);
    const final = new FixtureProposalLoop(db, honest, functionId, worktrees, now);
    await final.connect();
    expect(await final.reconcile(attemptId)).toBe(lostReceipt ? 'UNKNOWN' : 'SUCCEEDED');
    await expect(final.dispatch(attemptId)).rejects.toThrow();
    expect(honest.observations).toEqual(observations);
    expect(honest.methods).not.toContain('turn/start');
    expect(db.prepare('SELECT attempt_id, state FROM execution_attempts').all()).toEqual([{ attempt_id: attemptId, state: lostReceipt ? 'UNKNOWN' : 'SUCCEEDED' }]);
    expect(db.prepare('SELECT DISTINCT state FROM resource_leases').all()).toEqual([{ state: 'ACTIVE' }]);
    expect(db.prepare('SELECT state FROM tasks').all()).toEqual([{ state: 'QUEUED' }]);
    expect(JSON.parse(readFileSync(receipt, 'utf8'))).toEqual(original);
  } finally {
    await Promise.all(servers.map(server => server.close()));
    if (db.open) db.close();
    const canonical = realpathSync.native(root);
    if (dirname(canonical) === parent && basename(canonical).startsWith('sa-verified-loop-')) rmSync(canonical, { recursive: true, force: true });
  }
}, 45_000);
