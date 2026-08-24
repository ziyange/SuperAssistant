import { expect, test } from 'vitest';
import { DshProcessHost } from '../src/dsh-process-host.js';
import { DshToolBroker } from '../src/dsh-tool-broker.js';
import { reconcileDsh } from '../src/dsh-reconciler.js';

test('duplicate dispatch and ambiguous crash never create a second DSH effect', () => {
  const host = new DshProcessHost();
  expect(host.start('attempt-1', 'worktree-1').started).toBe(true);
  expect(host.start('attempt-1', 'worktree-1').started).toBe(false);
  const broker = new DshToolBroker({ grant: 'grant-1', snapshot: 'snapshot-1', fence: 1, budget: 1, targets: { shell: ['fixture'], filesystem: ['fixture'], network: ['fixture'], plugin: ['fixture-plugin@1'] }, plugins: { 'fixture-plugin@1': 'sha256:fixture' } });
  expect(broker.authorize({ capability: 'shell', grant: 'grant-1', snapshot: 'snapshot-1', fence: 1, target: 'fixture' }).allowed).toBe(true);
  expect(reconcileDsh({ processAlive: false, journalState: 'AMBIGUOUS' }).redispatchAllowed).toBe(false);
  expect(broker.authorize({ capability: 'shell', grant: 'grant-1', snapshot: 'snapshot-1', fence: 1, target: 'fixture' }).reason).toBe('BUDGET_EXHAUSTED');
});
