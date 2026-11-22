/* global Buffer */
/* eslint-disable no-unused-vars -- test callback parameter names describe the promise contract. */
import { execFileSync } from 'node:child_process';
import { closeSync, ftruncateSync, mkdtempSync, openSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test, vi } from 'vitest';
import { createFoundationDatabase, SqliteFoundationRepository } from '@super-assistant/persistence';
import { LocalCodexRegistration } from '../../src/main/local-codex-registration.js';
import { LocalGoalDraft } from '../../src/main/local-goal-draft.js';
import { ImmutableProposalConfirmation } from '../../src/main/immutable-proposal-confirmation.js';
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
    const service = new LocalGoalDraft(db);
    const id = await service.create({ projectId: project.projectId, objective: 'Write a report', criterion: 'Report exists' });
    const draft = (await service.prepare(id)).fullReview;
    expect(draft).toBeDefined();
    if (!draft) throw new Error('Missing review');
    expect(draft.objective).toBe('Write a report');
    expect(draft.acceptanceCriteria[0]?.criterion).toBe('Report exists');
    expect(draft.allowedActions).toEqual(['FILE_WRITE']);
    expect(draft.forbiddenActions).toEqual(['COMMAND', 'NETWORK', 'EXTERNAL_WRITE', 'CREDENTIAL']);
    expect(draft.baselineCommit).toMatch(/^[a-f0-9]{40}$/);
    expect((await service.read((await service.prepare(id)).proposalVersionId))?.fullReview).toEqual(draft);
    expect(db.prepare('SELECT count(*) AS n FROM proposal_candidate_drafts').get()).toEqual({ n: 0 });
    expect(db.serialize().includes(Buffer.from('Write a report'))).toBe(false);
    expect(db.serialize().includes(Buffer.from('Report exists'))).toBe(false);
    expect(await new LocalGoalDraft(db).read((await service.prepare(id)).proposalVersionId)).toBeNull();
    const integratedId = await service.create({ projectId: project.projectId, objective: 'Integrated review', criterion: 'Check result' });
    const confirmation = new ImmutableProposalConfirmation(reviewId => service.read(reviewId), async () => true);
    expect(await service.review(integratedId, proposal => confirmation.confirm(proposal.proposalVersionId, proposal.digest))).toBe(true);
    await expect(service.prepare(integratedId)).rejects.toThrow();
    const concurrentId = await service.create({ projectId: project.projectId, objective: 'Another report', criterion: 'It exists' });
    let resolveReview: ((value: boolean) => void) | undefined;
    const first = service.review(concurrentId, async () => new Promise(resolve => { resolveReview = resolve; }));
    expect(await service.review(concurrentId, async () => true)).toBe(false);
    expect((await service.prepare(concurrentId)).fullReview?.objective).toBe('Another report');
    await vi.waitFor(() => expect(resolveReview).toBeDefined());
    resolveReview?.(true);
    expect(await first).toBe(true);
    await expect(service.prepare(concurrentId)).rejects.toThrow();
    const executableDraft = await service.create({ projectId: project.projectId, objective: 'Fingerprint check', criterion: 'Unchanged executable' });
    const executableReview = await service.prepare(executableDraft);
    writeFileSync(executable, 'X'.repeat('fixture only'.length));
    expect(await service.read(executableReview.proposalVersionId)).toBeNull();
    await expect(service.prepare(executableDraft)).rejects.toThrow();
    const missingDraft = await service.create({ projectId: project.projectId, objective: 'Missing file check', criterion: 'File present' });
    const missingReview = await service.prepare(missingDraft);
    renameSync(executable, executable + '.moved');
    expect(await service.read(missingReview.proposalVersionId)).toBeNull();
    renameSync(executable + '.moved', executable);
    service.discard(missingDraft);
    writeFileSync(executable, '');
    await expect(service.create({ projectId: project.projectId, objective: 'Empty file', criterion: 'Fails safely' })).rejects.toThrow();
    const descriptor = openSync(executable, 'w');
    try { ftruncateSync(descriptor, 134217729); } finally { closeSync(descriptor); }
    await expect(service.create({ projectId: project.projectId, objective: 'Oversized file', criterion: 'Fails safely' })).rejects.toThrow();
    writeFileSync(executable, 'fixture only');
    expect(db.prepare('SELECT count(*) AS n FROM authorization_grants').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT count(*) AS n FROM execution_attempts').get()).toEqual({ n: 0 });
    await expect(service.create({ projectId: project.projectId, objective: '', criterion: 'done' })).rejects.toThrow();
    await expect(service.create({ projectId: project.projectId, objective: 'x'.repeat(4001), criterion: 'done' })).rejects.toThrow();
    await expect(service.create({ projectId: 'foreign', objective: 'x', criterion: 'done' })).rejects.toThrow();
    const untrusted = { projectId: project.projectId, objective: 'x', criterion: 'done', agentId: 'untrusted' };
    await expect(service.create(untrusted)).rejects.toThrow();
    const before = db.prepare('SELECT count(*) AS n FROM proposal_candidate_drafts').get();
    for (const sensitive of ['password=example-secret-value', 'Bearer exampletoken1234567890', '-----BEGIN PRIVATE KEY-----',
      'sk-abcdefghijklmnopqrstuvwxyz123456']) {
      await expect(service.create({ projectId: project.projectId, objective: sensitive, criterion: 'done' })).rejects.toThrow('GOAL_INVALID');
      await expect(service.create({ projectId: project.projectId, objective: 'safe', criterion: sensitive })).rejects.toThrow('GOAL_INVALID');
    }
    expect(db.prepare('SELECT count(*) AS n FROM proposal_candidate_drafts').get()).toEqual(before);
    db.prepare('UPDATE agents SET row_version = row_version + 1 WHERE agent_id = ?').run(registration.agent_id);
    await expect(service.prepare(id)).rejects.toThrow();
    service.discard(id);
    expect(await service.read('goal-review-' + id.slice('goal-'.length))).toBeNull();
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
}, 30000);
