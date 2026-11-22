/* eslint-disable no-unused-vars -- callback parameter names describe test types. */
import { expect, test } from 'vitest';
import { createDecision, createProposalVersion } from '@super-assistant/domain';
import { createFoundationDatabase, SqliteDecisionRepository, SqliteExecutionRepository } from '@super-assistant/persistence';
import { NativeDecisionResolution } from '../../src/main/native-decision-resolution.js';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function fixture(path = ':memory:') {
  const db = createFoundationDatabase(path);
  const at = '2026-08-13T00:00:00.000Z';
  db.prepare('INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?)').run('workspace-1', 'local-owner', 'Workspace', 'ACTIVE', at, at, 1);
  db.prepare('INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('agent-1', 'workspace-1', 'Codex', '1.0.0', 'CONNECTED', 'AVAILABLE', null, 1);
  db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run('project-1', 'workspace-1', 'Project', 'E:/fixture', 'e:/fixture', 'ACTIVE', 'agent-1', 1, at, at, 1);
  db.prepare('INSERT INTO functions VALUES (?, ?, ?, ?, ?)').run('function-1', 'agent-1', 'implement', '1.0.0', 'ACTIVE');
  const p = createProposalVersion({ proposalVersionId: 'proposal-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', objective: 'Test execution', actions: ['COMMAND'], projectSnapshotVersion: '1', agentVersion: '1.0.0', functionVersion: '1.0.0', capabilityVersion: '1.0.0', baselineCommit: 'base', expiresAt: '2026-08-14T00:00:00.000Z', createdAt: at });
  db.prepare('INSERT INTO proposal_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(p.proposalVersionId, p.workspaceId, p.projectId, p.agentId, p.functionId, p.objective, JSON.stringify(p.actions), p.projectSnapshotVersion, p.agentVersion, p.functionVersion, p.capabilityVersion, p.baselineCommit, p.expiresAt, p.createdAt, p.digest);
  db.prepare('INSERT INTO authorization_grants VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('grant-1', p.proposalVersionId, p.digest, 'local-owner', 'grant-key', JSON.stringify(p.actions), 'ISSUED', at, p.expiresAt);
  new SqliteExecutionRepository(db, () => at, () => 'local-owner').createAuthorizedExecution({ taskId: 'task-1', workItemId: 'work-1', attemptId: 'attempt-1', leaseId: 'lease-1', requestId: 'request-1', idempotencyKey: 'initial-key', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', proposalVersionId: 'proposal-1', authorizationGrantId: 'grant-1', resourceKey: 'project:project-1', fencingToken: 1, createdAt: at });
  db.prepare("UPDATE outbox SET state='ACKNOWLEDGED' WHERE message_id='outbox:attempt-1'").run();
  db.prepare("UPDATE execution_attempts SET state='WAITING_USER' WHERE attempt_id='attempt-1'").run();
  const repo = new SqliteDecisionRepository(db, () => 'local-owner', () => '2026-08-13T00:00:02.000Z');
  repo.create(createDecision({ decisionId: 'decision-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-1', question: 'Proceed?', level: 'L3', createdAt: at }));
  return { db, repo };
}

test.each(['ALLOW', 'DENY'] as const)('records native %s on the original Attempt without dispatch', async option => {
  const { db, repo } = fixture();
  try {
    const seen: unknown[] = [];
    const service = new NativeDecisionResolution(db, repo, async context => { seen.push(context); return option; }, () => '2026-08-13T00:00:02.000Z');
    expect(await service.review('decision-1')).toBe('RECORDED');
    expect(seen).toHaveLength(1);
    expect(db.prepare("SELECT resolution_option FROM decisions WHERE decision_id='decision-1'").get()).toEqual({ resolution_option: option });
    expect(db.prepare("SELECT attempt_id,state FROM outbox WHERE message_id='resume:decision-1'").get()).toEqual({ attempt_id: 'attempt-1', state: 'PENDING' });
    expect(db.prepare("SELECT state FROM execution_attempts WHERE attempt_id='attempt-1'").get()).toEqual({ state: 'WAITING_USER' });
  } finally { db.close(); }
});

test('rejects a concurrent click while the native prompt is pending', async () => {
  const { db, repo } = fixture();
  try {
    let finish!: (option: 'ALLOW' | null) => void;
    const prompt = new Promise<'ALLOW' | null>(resolve => { finish = resolve; });
    const service = new NativeDecisionResolution(db, repo, async () => prompt, () => '2026-08-13T00:00:02.000Z');
    const first = service.review('decision-1');
    expect(await service.review('decision-1')).toBe('UNAVAILABLE');
    finish('ALLOW');
    expect(await first).toBe('RECORDED');
    expect(await service.review('decision-1')).toBe('UNAVAILABLE');
    expect(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE message_type='resume'").get()).toEqual({ n: 1 });
  } finally { db.close(); }
});

test('blocks another Decision prompt even through a second service instance', async () => {
  const { db, repo } = fixture();
  try {
    repo.create(createDecision({ decisionId: 'decision-2', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-1', question: 'Other?', level: 'L3', createdAt: '2026-08-13T00:00:00.000Z' }));
    let finish!: (option: null) => void;
    const prompt = new Promise<null>(resolve => { finish = resolve; });
    const firstService = new NativeDecisionResolution(db, repo, async () => prompt, () => '2026-08-13T00:00:02.000Z');
    const secondService = new NativeDecisionResolution(db, repo, async () => 'ALLOW', () => '2026-08-13T00:00:02.000Z');
    const first = firstService.review('decision-1');
    expect(await secondService.review('decision-2')).toBe('UNAVAILABLE');
    finish(null);
    expect(await first).toBe('DISMISSED');
  } finally { db.close(); }
});

test('rejects a Decision changed after the final read but before the atomic resolution', async () => {
  const { db, repo } = fixture();
  try {
    const racingRepo = {
      resolveAndEnqueueResume(...args: Parameters<typeof repo.resolveAndEnqueueResume>) {
        db.prepare("UPDATE decisions SET question='changed after dialog' WHERE decision_id='decision-1'").run();
        return repo.resolveAndEnqueueResume(...args);
      }
    } as unknown as SqliteDecisionRepository;
    const service = new NativeDecisionResolution(db, racingRepo, async () => 'ALLOW', () => '2026-08-13T00:00:02.000Z');
    expect(await service.review('decision-1')).toBe('UNAVAILABLE');
    expect(db.prepare("SELECT status FROM decisions WHERE decision_id='decision-1'").get()).toEqual({ status: 'OPEN' });
  } finally { db.close(); }
});

test('rejects a context change committed by another SQLite connection before resolution begins', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sa-decision-test-'));
  const path = join(directory, 'fixture.sqlite');
  const { db, repo } = fixture(path);
  const other = new Database(path);
  try {
    const racingRepo = {
      resolveAndEnqueueResume(...args: Parameters<typeof repo.resolveAndEnqueueResume>) {
        other.prepare("UPDATE decisions SET question='changed externally' WHERE decision_id='decision-1'").run();
        return repo.resolveAndEnqueueResume(...args);
      }
    } as unknown as SqliteDecisionRepository;
    const service = new NativeDecisionResolution(db, racingRepo, async () => 'ALLOW', () => '2026-08-13T00:00:02.000Z');
    expect(await service.review('decision-1')).toBe('UNAVAILABLE');
    expect(db.prepare("SELECT status FROM decisions WHERE decision_id='decision-1'").get()).toEqual({ status: 'OPEN' });
  } finally { other.close(); db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test.each(['dismiss', 'changed-question', 'changed-project', 'changed-attempt', 'expired-lease', 'expired-grant', 'unsafe-text', 'invisible-text'])('fails closed on %s', async kind => {
  const { db, repo } = fixture();
  try {
    if (kind === 'unsafe-text') db.prepare("UPDATE decisions SET question=? WHERE decision_id='decision-1'").run('unsafe\u202equestion');
    if (kind === 'invisible-text') db.prepare("UPDATE decisions SET question=? WHERE decision_id='decision-1'").run('unsafe\u200bquestion');
    const service = new NativeDecisionResolution(db, repo, async () => {
      if (kind === 'changed-question') db.prepare("UPDATE decisions SET question='changed' WHERE decision_id='decision-1'").run();
      if (kind === 'changed-project') db.prepare("UPDATE projects SET name='Other' WHERE project_id='project-1'").run();
      if (kind === 'changed-attempt') db.prepare("UPDATE execution_attempts SET request_id='other-request' WHERE attempt_id='attempt-1'").run();
      if (kind === 'expired-lease') db.prepare("UPDATE resource_leases SET state='RELEASED' WHERE lease_id='lease-1'").run();
      if (kind === 'expired-grant') db.prepare("UPDATE authorization_grants SET status='EXPIRED' WHERE grant_id='grant-1'").run();
      return kind === 'dismiss' ? null : 'ALLOW';
    }, () => '2026-08-13T00:00:02.000Z');
    expect(await service.review('decision-1')).toBe(kind === 'dismiss' ? 'DISMISSED' : 'UNAVAILABLE');
    expect(db.prepare("SELECT status FROM decisions WHERE decision_id='decision-1'").get()).toEqual({ status: 'OPEN' });
    expect(db.prepare("SELECT COUNT(*) AS n FROM outbox WHERE message_type='resume'").get()).toEqual({ n: 0 });
  } finally { db.close(); }
});
