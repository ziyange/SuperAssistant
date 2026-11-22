/* global Buffer */
/* eslint-disable no-unused-vars -- test callback parameter names describe the promise contract. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from 'vitest';
import { createFoundationDatabase, SqliteFoundationRepository } from '@super-assistant/persistence';
import { LocalCodexRegistration } from '../../src/main/local-codex-registration.js';
import { LocalGoalDraft } from '../../src/main/local-goal-draft.js';
import { projectGitEnvironment } from '../../src/main/project-git-baseline.js';

test('derives a review-only candidate from the local catalog and the exact Git baseline', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-goal-draft-'));
  const source = join(root, 'project');
  const executable = join(root, 'fake.exe');
  const db = createFoundationDatabase(':memory:');
  try {
    writeFileSync(executable, 'fixture only');
    execFileSync('git', ['init', '--quiet', source], { env: projectGitEnvironment() });
    execFileSync('git', ['-C', source, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'base'], { env: projectGitEnvironment() });
    new LocalCodexRegistration(db).save(executable, '0.121.0');
    const registration = db.prepare('SELECT workspace_id, agent_id FROM local_codex_registrations').get() as { workspace_id: string; agent_id: string };
    const project = new SqliteFoundationRepository(db).createProject({ workspaceId: registration.workspace_id as never, name: 'Project', canonicalPath: realpathSync(source), defaultAgentId: registration.agent_id as never });
    db.prepare("UPDATE projects SET status='ACTIVE' WHERE project_id=?").run(project.projectId);
    const service = new LocalGoalDraft(db, () => new Date('2026-11-22T04:00:00.000Z'));
    const id = service.create({ projectId: project.projectId, objective: 'Write a report', criterion: 'Report exists' });
    const draft = service.prepare(id).fullReview;
    expect(draft).toBeDefined();
    if (!draft) throw new Error('Missing review');
    expect(draft.objective).toBe('Write a report');
    expect(draft.acceptanceCriteria[0]?.criterion).toBe('Report exists');
    expect(draft.allowedActions).toEqual(['FILE_WRITE']);
    expect(draft.forbiddenActions).toEqual(['COMMAND', 'NETWORK', 'EXTERNAL_WRITE', 'CREDENTIAL']);
    expect(draft.baselineCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(service.read(service.prepare(id).proposalVersionId)?.fullReview).toEqual(draft);
    expect(db.prepare('SELECT count(*) AS n FROM proposal_candidate_drafts').get()).toEqual({ n: 0 });
    expect(db.serialize().includes(Buffer.from('Write a report'))).toBe(false);
    expect(db.serialize().includes(Buffer.from('Report exists'))).toBe(false);
    expect(new LocalGoalDraft(db).read(service.prepare(id).proposalVersionId)).toBeNull();
    const concurrentId = service.create({ projectId: project.projectId, objective: 'Another report', criterion: 'It exists' });
    let resolveReview: (value: boolean) => void = () => { throw new Error('No presenter'); };
    const first = service.review(concurrentId, async () => new Promise(resolve => { resolveReview = resolve; }));
    expect(await service.review(concurrentId, async () => true)).toBe(false);
    expect(service.prepare(concurrentId).fullReview?.objective).toBe('Another report');
    resolveReview(true);
    expect(await first).toBe(true);
    expect(() => service.prepare(concurrentId)).toThrow();
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
    expect(() => service.create({ projectId: project.projectId, objective: '', criterion: 'done' })).toThrow();
    expect(() => service.create({ projectId: project.projectId, objective: 'x'.repeat(4001), criterion: 'done' })).toThrow();
    expect(() => service.create({ projectId: 'foreign', objective: 'x', criterion: 'done' })).toThrow();
    const untrusted = { projectId: project.projectId, objective: 'x', criterion: 'done', agentId: 'untrusted' };
    expect(() => service.create(untrusted)).toThrow();
    const before = db.prepare('SELECT count(*) AS n FROM proposal_candidate_drafts').get();
    for (const sensitive of ['password=example-secret-value', 'Bearer exampletoken1234567890', '-----BEGIN PRIVATE KEY-----',
      'sk-abcdefghijklmnopqrstuvwxyz123456']) {
      expect(() => service.create({ projectId: project.projectId, objective: sensitive, criterion: 'done' })).toThrow('GOAL_INVALID');
      expect(() => service.create({ projectId: project.projectId, objective: 'safe', criterion: sensitive })).toThrow('GOAL_INVALID');
    }
    expect(db.prepare('SELECT count(*) AS n FROM proposal_candidate_drafts').get()).toEqual(before);
    db.prepare('UPDATE agents SET row_version = row_version + 1 WHERE agent_id = ?').run(registration.agent_id);
    expect(() => service.prepare(id)).toThrow();
    service.discard(id);
    expect(service.read('goal-review-' + id.slice('goal-'.length))).toBeNull();
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
}, 30000);
