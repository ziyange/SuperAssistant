import { expect, test } from 'vitest';
import { reconcileExecution } from '../src/reconciliation.js';

test('keeps an uncertain upstream result in RECONCILING', async () => {
  expect(await reconcileExecution(async () => ({ status: 'INDETERMINATE' }))).toEqual({ state: 'RECONCILING', dispatchable: false });
});

test('never makes an existing Attempt redispatchable after restart, including when upstream reports not started', async () => {
  expect(await reconcileExecution(async () => ({ status: 'NOT_STARTED' }))).toEqual({ state: 'NOT_STARTED', dispatchable: false });
});
