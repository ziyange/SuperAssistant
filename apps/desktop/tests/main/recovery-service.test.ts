import { expect, test } from 'vitest';
import { RecoveryService } from '../../src/main/recovery-service.js';

test('moves lost nonterminal work to reconciliation without a replacement start', async () => {
  const service = new RecoveryService({ reconcile: async () => ({ status: 'INDETERMINATE' as const }) });
  expect(await service.recover({ attemptId: 'attempt-1', state: 'RUNNING' })).toEqual({ attemptId: 'attempt-1', state: 'RECONCILING', redispatch: false });
});

test('does not redispatch an existing Attempt after restart even when the Adapter observes no upstream execution', async () => {
  const service = new RecoveryService({ reconcile: async () => ({ status: 'NOT_STARTED' as const }) });
  expect(await service.recover({ attemptId: 'attempt-1', state: 'UNKNOWN' })).toEqual({ attemptId: 'attempt-1', state: 'NOT_STARTED', redispatch: false });
});
