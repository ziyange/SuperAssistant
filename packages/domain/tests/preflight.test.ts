import { describe, expect, test } from 'vitest';
import { evaluatePreflight } from '../src/preflight.js';

const approved = { projectSnapshotVersion: 'project-1', agentVersion: '1.0.0', functionVersion: '1.0.0', capabilityVersion: '1.0.0', baselineCommit: 'abc', policyVersion: 'policy-1', grantStatus: 'ISSUED' as const, grantExpiresAt: '2026-08-14T00:00:00.000Z' };

describe('preflight invalidation', () => {
  test('accepts an unchanged current snapshot', () => {
    expect(evaluatePreflight(approved, { ...approved, checkedAt: '2026-08-13T12:00:00.000Z' })).toEqual({ status: 'READY', reasons: [] });
  });

  test('invalidates before execution when Project or authorization changes', () => {
    expect(evaluatePreflight(approved, { ...approved, projectSnapshotVersion: 'project-2', grantStatus: 'REVOKED', checkedAt: '2026-08-13T12:00:00.000Z' })).toEqual({ status: 'STALE', reasons: ['PROJECT_SNAPSHOT_CHANGED', 'GRANT_NOT_ISSUED'] });
  });
});
