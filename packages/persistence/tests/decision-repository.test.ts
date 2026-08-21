import { expect, test } from 'vitest';
import { createDecision, resolveDecision } from '@super-assistant/domain';
import { SqliteDecisionRepository } from '../src/repositories/decision-repository.js';
import { createFoundationDatabase } from '../src/sqlite/database.js';

const input = { decisionId: 'decision-1', workspaceId: 'workspace-1', projectId: 'project-1', taskId: 'task-1', workItemId: 'work-item-1', question: 'Grant network access?', level: 'L3' as const, createdAt: '2026-08-21T00:00:00.000Z' };

test('stores one open Decision for the same fingerprint and persists its resolution', () => {
  const database = createFoundationDatabase(':memory:');
  const decisions = new SqliteDecisionRepository(database);
  const first = createDecision(input);
  decisions.create(first);
  expect(decisions.findOpenByFingerprint(first.fingerprint)).toEqual(first);
  expect(decisions.listForTask('task-1')).toEqual([first]);
  expect(() => decisions.create(createDecision({ ...input, decisionId: 'decision-2', question: ' grant network access? ' }))).toThrow(/UNIQUE/i);
  const resolved = resolveDecision(first, { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' });
  decisions.resolve(resolved);
  expect(decisions.get('decision-1')).toEqual(resolved);
  database.close();
});

test('atomically records the first resolution and emits one resume command', () => {
  const database = createFoundationDatabase(':memory:');
  database.prepare('PRAGMA foreign_keys = OFF').run();
  database.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-item-1', 'request-1', 'attempt-key-1', 'WAITING_USER', 0, '2026-08-21T00:00:00.000Z')").run();
  database.prepare('PRAGMA foreign_keys = ON').run();
  const decisions = new SqliteDecisionRepository(database);
  const first = createDecision(input);
  decisions.create(first);
  const resolution = { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW' as const, resolvedAt: '2026-08-21T00:01:00.000Z' };

  expect(decisions.resolveAndEnqueueResume(first.decisionId, resolution)).toEqual({ decision: resolveDecision(first, resolution), resumeEnqueued: true });
  expect(decisions.resolveAndEnqueueResume(first.decisionId, resolution)).toEqual({ decision: resolveDecision(first, resolution), resumeEnqueued: false });
  expect(database.prepare("SELECT message_type, payload_json FROM outbox WHERE attempt_id = 'attempt-1'").all()).toEqual([{ message_type: 'resume', payload_json: '{"attempt_id":"attempt-1","decision_id":"decision-1","resolution_id":"resolution-1"}' }]);
  database.close();
});

test.each(['UNKNOWN', 'RECONCILING'])('refuses an ambiguous %s Attempt without resolving the Decision', (state) => {
  const database = createFoundationDatabase(':memory:');
  database.prepare('PRAGMA foreign_keys = OFF').run();
  database.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-item-1', 'request-1', 'attempt-key-1', ?, 0, '2026-08-21T00:00:00.000Z')").run(state);
  database.prepare('PRAGMA foreign_keys = ON').run();
  const decisions = new SqliteDecisionRepository(database); decisions.create(createDecision(input));
  expect(() => decisions.resolveAndEnqueueResume('decision-1', { resolutionId: 'resolution-1', idempotencyKey: 'resolve-key-1', actorId: 'user-1', option: 'ALLOW', resolvedAt: '2026-08-21T00:01:00.000Z' })).toThrow('ATTEMPT_RECONCILIATION_REQUIRED');
  expect(decisions.get('decision-1')?.status).toBe('OPEN'); database.close();
});
