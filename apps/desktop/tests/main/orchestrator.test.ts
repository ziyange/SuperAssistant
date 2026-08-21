import { expect, test } from 'vitest';
import { ExecutionOrchestrator } from '../../src/main/orchestrator.js';
import { OutboxDispatcher } from '../../src/main/outbox-dispatcher.js';

test('creates durable execution before invoking the adapter and refuses unknown redispatch', async () => {
  const calls: string[] = [];
  const orchestrator = new ExecutionOrchestrator({ create: () => { calls.push('durable'); return { state: 'DISPATCH_PENDING' }; } }, { start: async () => { calls.push('adapter'); } });
  await orchestrator.dispatch({ attemptId: 'attempt-1', state: 'CREATED' });
  expect(calls).toEqual(['durable', 'adapter']);
  await expect(orchestrator.dispatch({ attemptId: 'attempt-1', state: 'UNKNOWN' })).rejects.toThrow('RECONCILIATION_REQUIRED');
});

test('dispatches only a claimed durable start message and acknowledges it after adapter acceptance', async () => {
  const calls: string[] = [];
  const dispatcher = new OutboxDispatcher(
    { claimNext: () => ({ messageId: 'message-1', attemptId: 'attempt-1', payload: { attemptId: 'attempt-1' } }), acknowledge: (messageId) => { calls.push(`ack:${messageId}`); } },
    { start: async (command) => { calls.push(`start:${command.attemptId}`); } }
  );
  expect(await dispatcher.dispatchOne()).toEqual({ messageId: 'message-1', dispatched: true });
  expect(calls).toEqual(['start:attempt-1', 'ack:message-1']);
});

test('dispatches one claimed Decision resume command and acknowledges it only after adapter acceptance', async () => {
  const calls: string[] = [];
  const dispatcher = new OutboxDispatcher(
    { claimNext: () => ({ messageId: 'resume:decision-1', attemptId: 'attempt-1', kind: 'resume' as const, payload: { attemptId: 'attempt-1', decisionId: 'decision-1', resolutionId: 'resolution-1' } }), acknowledge: (messageId) => { calls.push(`ack:${messageId}`); } },
    { start: async () => { calls.push('unexpected-start'); }, resume: async (command) => { calls.push(`resume:${command.attemptId}:${command.decisionId}`); } }
  );
  expect(await dispatcher.dispatchOne()).toEqual({ messageId: 'resume:decision-1', dispatched: true });
  expect(calls).toEqual(['resume:attempt-1:decision-1', 'ack:resume:decision-1']);
});
