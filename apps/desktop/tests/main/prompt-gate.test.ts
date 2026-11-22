import { expect, test } from 'vitest';
import { ExclusivePromptGate } from '../../src/main/prompt-gate.js';

test('serializes Decision, Proposal, and cancellation until the operation completes', async () => {
  const gate = new ExclusivePromptGate();
  let finish!: () => void;
  const held = new Promise<void>(resolve => { finish = resolve; });
  const calls: string[] = [];
  const decision = gate.run(async () => { calls.push('decision'); await held; return 'recorded'; }, 'unavailable');
  expect(await gate.run(async () => { calls.push('proposal'); return 'approved'; }, 'unavailable')).toBe('unavailable');
  expect(await gate.run(async () => { calls.push('cancel'); return 'cancelled'; }, 'unavailable')).toBe('unavailable');
  finish();
  expect(await decision).toBe('recorded');
  expect(await gate.run(async () => { calls.push('proposal'); return 'approved'; }, 'unavailable')).toBe('approved');
  expect(calls).toEqual(['decision', 'proposal']);
});

test('releases the shared slot after exceptions', async () => {
  const gate = new ExclusivePromptGate();
  await expect(gate.run(async () => { throw new Error('closed'); }, false)).rejects.toThrow('closed');
  expect(await gate.run(async () => true, false)).toBe(true);
});
