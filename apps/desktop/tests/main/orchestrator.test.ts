import { expect, test } from 'vitest';
import { ExecutionOrchestrator } from '../../src/main/orchestrator.js';
import { OutboxDispatcher } from '../../src/main/outbox-dispatcher.js';

test('without a trusted dispatch guard it refuses before claiming or invoking an adapter', async () => {
  const calls: string[] = [];
  const dispatcher = new OutboxDispatcher(
    { claimNext: () => { calls.push('claim'); return null; }, acknowledge: () => { calls.push('ack'); return true; }, markUncertain: () => { calls.push('uncertain'); return true; } },
    { start: async () => { calls.push('start'); } }
  );
  await expect(dispatcher.dispatchOne()).rejects.toThrow('DISPATCH_GUARD_UNAVAILABLE');
  expect(calls).toEqual([]);
});

test.each(['false', 'throw', 'resume', 'non-boolean'])('a rejected %s guard quarantines the claim without adapter calls', async (kind) => {
  const calls: string[] = [];
  const checked: unknown[] = [];
  const message = kind === 'resume'
    ? { messageId: 'message-1', attemptId: 'attempt-1', claimToken: 'token-1', kind: 'resume' as const, payload: { attemptId: 'attempt-1', decisionId: 'decision-1', resolutionId: 'resolution-1' } }
    : { messageId: 'message-1', attemptId: 'attempt-1', claimToken: 'token-1', payload: { attemptId: 'attempt-1' } };
  const dispatcher = new OutboxDispatcher(
    { claimNext: () => message, acknowledge: () => { calls.push('ack'); return true; }, markUncertain: (id, token) => { calls.push(`uncertain:${id}:${token}`); return true; } },
    { start: async () => { calls.push('start'); }, resume: async () => { calls.push('resume'); } },
    async (claimed) => { checked.push(claimed); if (kind === 'throw') throw new Error('guard failed'); return kind === 'non-boolean' ? 1 as unknown as boolean : false; }
  );
  await expect(dispatcher.dispatchOne()).rejects.toThrow('DISPATCH_OUTCOME_UNKNOWN');
  expect(checked).toEqual([message]);
  expect(calls).toEqual(['uncertain:message-1:token-1']);
});

test.each(['CREATED', 'RUNNING', 'UNKNOWN', 'RECONCILING'])('legacy direct dispatch is disabled for %s without side effects', async (state) => {
  const calls: string[] = [];
  const orchestrator = new ExecutionOrchestrator({ create: () => { calls.push('durable'); return { state: 'DISPATCH_PENDING' }; } }, { start: async () => { calls.push('adapter'); } });
  await expect(orchestrator.dispatch({ attemptId: 'attempt-1', state })).rejects.toThrow('DIRECT_DISPATCH_DISABLED');
  expect(calls).toEqual([]);
});

test('dispatches only a claimed durable start message and acknowledges it after adapter acceptance', async () => {
  const calls: string[] = [];
  const dispatcher = new OutboxDispatcher(
    { claimNext: () => ({ messageId: 'message-1', attemptId: 'attempt-1', claimToken: 'claim-1', payload: { attemptId: 'attempt-1' } }), acknowledge: (messageId, token) => { calls.push(`ack:${messageId}:${token}`); return true; }, markUncertain: () => false },
    { start: async (command) => { calls.push(`start:${command.attemptId}`); } }, () => true
  );
  expect(await dispatcher.dispatchOne()).toEqual({ messageId: 'message-1', dispatched: true });
  expect(calls).toEqual(['start:attempt-1', 'ack:message-1:claim-1']);
});

test('dispatches one claimed Decision resume command and acknowledges it only after adapter acceptance', async () => {
  const calls: string[] = [];
  const dispatcher = new OutboxDispatcher(
    { claimNext: () => ({ messageId: 'resume:decision-1', attemptId: 'attempt-1', claimToken: 'claim-2', kind: 'resume' as const, payload: { attemptId: 'attempt-1', decisionId: 'decision-1', resolutionId: 'resolution-1' } }), acknowledge: (messageId, token) => { calls.push(`ack:${messageId}:${token}`); return true; }, markUncertain: () => false },
    { start: async () => { calls.push('unexpected-start'); }, resume: async (command) => { calls.push(`resume:${command.attemptId}:${command.decisionId}`); } }, () => true
  );
  expect(await dispatcher.dispatchOne()).toEqual({ messageId: 'resume:decision-1', dispatched: true });
  expect(calls).toEqual(['resume:attempt-1:decision-1', 'ack:resume:decision-1:claim-2']);
});

test('dispatch failure preserves the claim as uncertain and never acknowledges it', async () => {
  const calls: string[] = [];
  const outbox = {
    claimNext: () => ({ messageId: 'message-1', attemptId: 'attempt-1', claimToken: 'token-1', payload: { attemptId: 'attempt-1' } }),
    acknowledge: () => { calls.push('ack'); return true; },
    markUncertain: (messageId: string, token: string) => { calls.push(`uncertain:${messageId}:${token}`); return true; }
  };
  const dispatcher = new OutboxDispatcher(outbox, { start: async () => { calls.push('start'); throw new Error('lost after write'); } }, () => true);
  await expect(dispatcher.dispatchOne()).rejects.toThrow('DISPATCH_OUTCOME_UNKNOWN');
  expect(calls).toEqual(['start', 'uncertain:message-1:token-1']);
});

test('lost acknowledgement fencing never reports a successful dispatch', async () => {
  const calls: string[] = [];
  const outbox = {
    claimNext: () => ({ messageId: 'message-1', attemptId: 'attempt-1', claimToken: 'old-token', payload: { attemptId: 'attempt-1' } }),
    acknowledge: () => false,
    markUncertain: () => { calls.push('uncertain'); return false; }
  };
  const dispatcher = new OutboxDispatcher(outbox, { start: async () => { calls.push('start'); } }, () => true);
  await expect(dispatcher.dispatchOne()).rejects.toThrow('DISPATCH_OUTCOME_UNKNOWN');
  expect(calls).toEqual(['start', 'uncertain']);
});
