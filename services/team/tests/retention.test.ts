import { expect, test } from 'vitest';
import { RetentionService } from '../src/retention.js';

test('records dry-run evidence before a policy deletion plan and never deletes held records', () => {
  const retention = new RetentionService();
  const input = { recordId: 'record-1', expiresAt: 100, now: 200, legalHold: false, stateKnown: true };
  expect(retention.plan(input)).toEqual({ action: 'PRESERVE', reason: 'DRY_RUN_REQUIRED' });
  retention.recordDryRun('record-1', 'policy-v1');
  expect(retention.plan(input)).toEqual({ action: 'DELETE', auditDigest: expect.stringMatching(/^sha256:/) });
  expect(retention.plan({ ...input, legalHold: true })).toEqual({ action: 'PRESERVE', reason: 'LEGAL_HOLD' });
});
