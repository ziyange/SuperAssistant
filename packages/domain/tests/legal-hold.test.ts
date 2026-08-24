import { expect, test } from 'vitest';
import { evaluateRetention } from '../src/legal-hold.js';

test('legal hold and unknown state preserve evidence without exception', () => {
  expect(evaluateRetention({ recordId: 'record-1', expiresAt: 100, now: 200, legalHold: true, stateKnown: true, dryRunApproved: true })).toEqual({ action: 'PRESERVE', reason: 'LEGAL_HOLD' });
  expect(evaluateRetention({ recordId: 'record-1', expiresAt: 100, now: 200, legalHold: false, stateKnown: false, dryRunApproved: true })).toEqual({ action: 'PRESERVE', reason: 'STATE_UNKNOWN' });
});

test('requires expiration and dry-run evidence before deletion', () => {
  expect(evaluateRetention({ recordId: 'record-1', expiresAt: 100, now: 99, legalHold: false, stateKnown: true, dryRunApproved: true })).toEqual({ action: 'PRESERVE', reason: 'NOT_EXPIRED' });
  expect(evaluateRetention({ recordId: 'record-1', expiresAt: 100, now: 200, legalHold: false, stateKnown: true, dryRunApproved: false })).toEqual({ action: 'PRESERVE', reason: 'DRY_RUN_REQUIRED' });
  expect(evaluateRetention({ recordId: 'record-1', expiresAt: 100, now: 200, legalHold: false, stateKnown: true, dryRunApproved: true })).toEqual({ action: 'DELETE', auditDigest: expect.stringMatching(/^sha256:/) });
});
