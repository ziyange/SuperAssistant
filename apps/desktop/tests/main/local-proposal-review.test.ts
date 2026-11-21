import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { createFoundationDatabase } from '@super-assistant/persistence';
import { ProposalDraftStore } from '../../src/main/proposal-draft-store.js';
import { LocalProposalReview } from '../../src/main/local-proposal-review.js';
import { ImmutableProposalConfirmation } from '../../src/main/immutable-proposal-confirmation.js';
import { routeIpc } from '../../src/main/ipc-router.js';

test('persists the exact local review and refuses a changed Project snapshot', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-review-'));
  const source = join(root, 'project');
  const db = createFoundationDatabase(':memory:');
  const git = (...args: string[]) => execFileSync('git', ['-C', source, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  try {
    execFileSync('git', ['init', '--quiet', source]);
    git('commit', '--allow-empty', '-m', 'base');
    const baselineCommit = git('rev-parse', 'HEAD');
    const now = '2026-01-01T00:00:00.000Z';
    db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace', 'local-owner', 'Local', 'ACTIVE', now, now, 1);
    db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent', 'workspace', 'Codex', '0.121.0', 'CONNECTED', 'AVAILABLE', null, 1);
    db.prepare('INSERT INTO local_codex_registrations VALUES (?, ?, ?, ?, ?)').run('workspace', 'agent', 'fixture.exe', '0.121.0', now);
    db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project', 'workspace', 'Project', realpathSync(source), realpathSync(source).toLowerCase(), 'ACTIVE', 'agent', 1, now, now, 1);
    db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function', 'agent', 'Code', '1', 'ACTIVE');
    const candidate = {
      objective: 'Update', workspaceId: 'workspace', projectId: 'project', agentId: 'agent', functionId: 'function',
      projectSnapshotVersion: '1', agentVersion: '0.121.0', functionVersion: '1', capabilityVersion: '1', baselineCommit,
      createdAt: now, expiresAt: '2030-01-01T00:00:00.000Z', deadlineAt: '2030-01-01T00:00:00.000Z',
      budget: { maxDurationMs: 5000, maxTokens: null, maxCost: null }, capabilities: [{ id: 'code', version: '1' }],
      workItems: [{ id: 'work', projectId: 'project', agentId: 'agent', functionId: 'function', objective: 'Update', required: true, dependencies: [] }],
      resources: [{ key: 'project:project', intent: 'WRITE' }], allowedActions: ['FILE_WRITE'], forbiddenActions: [],
      reconfirmationTriggers: ['change'], risk: 'HIGH', acceptanceCriteria: [{ criterion: 'passes', evidence: 'test log' }]
    };
    const draft = new ProposalDraftStore(db).create(candidate);
    const service = new LocalProposalReview(db);
    const review = service.prepare(draft);
    expect(review.fullReview).toEqual(candidate);
    expect(service.prepare(draft)).toEqual(review);
    let displayed: unknown;
    const confirmation = new ImmutableProposalConfirmation(id => service.read(id), async fullReview => {
      displayed = JSON.parse(fullReview);
      return true;
    });
    const onboarding = { async get() { return { completed: false }; }, async set(value: { completed: boolean }) { return value; } };
    const reviewDraft = async (id: string) => {
      const current = service.prepare(id);
      return confirmation.confirm(current.proposalVersionId, current.digest);
    };
    const route = () => routeIpc({ channel: 'proposal:review', payload: { draftId: draft } },
      onboarding, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, reviewDraft);
    expect(await route()).toEqual({ proposalReview: 'REVIEWED_ONLY' });
    expect(displayed).toEqual(candidate);
    const staleDuringReview = new ImmutableProposalConfirmation(id => service.read(id), async () => {
      db.prepare("UPDATE projects SET snapshot_version=2 WHERE project_id='project'").run();
      return true;
    });
    expect(await staleDuringReview.confirm(review.proposalVersionId, review.digest)).toBe(false);
    db.prepare("UPDATE projects SET snapshot_version=1 WHERE project_id='project'").run();
    expect(db.prepare('SELECT count(*) AS count FROM authorization_grants').get()).toEqual({ count: 0 });
    expect(db.prepare('SELECT count(*) AS count FROM tasks').get()).toEqual({ count: 0 });
    git('commit', '--allow-empty', '-m', 'advanced');
    expect(() => service.prepare(draft)).toThrow();
    expect(service.read(review.proposalVersionId)).toBeNull();
    git('update-ref', 'HEAD', baselineCommit);
    db.prepare("UPDATE projects SET snapshot_version=2 WHERE project_id='project'").run();
    expect(() => service.prepare(draft)).toThrow();
    expect(service.read(review.proposalVersionId)).toBeNull();
    expect(await route()).toEqual({ proposalReview: 'UNAVAILABLE' });
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
}, 30000);
