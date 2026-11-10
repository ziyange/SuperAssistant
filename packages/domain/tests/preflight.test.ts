import { describe, expect, test } from 'vitest';
import { evaluatePreflight } from '../src/preflight.js';

const approved = { projectSnapshotVersion: 'project-1', agentVersion: '1.0.0', functionVersion: '1.0.0', capabilityVersion: '1.0.0', baselineCommit: 'abc', policyVersion: 'policy-1', grantStatus: 'ISSUED' as const, grantExpiresAt: '2026-08-14T00:00:00.000Z' };

describe('preflight invalidation', () => {
  test.each([
    { approvedExpiry: 'bad', currentExpiry: approved.grantExpiresAt, checkedAt: '2026-08-13T12:00:00.000Z' },
    { approvedExpiry: approved.grantExpiresAt, currentExpiry: 'bad', checkedAt: '2026-08-13T12:00:00.000Z' },
    { approvedExpiry: approved.grantExpiresAt, currentExpiry: approved.grantExpiresAt, checkedAt: 'bad' }
    ,{ approvedExpiry: approved.grantExpiresAt, currentExpiry: approved.grantExpiresAt, checkedAt: '0' }
    ,{ approvedExpiry: approved.grantExpiresAt, currentExpiry: approved.grantExpiresAt, checkedAt: '2026-02-30T12:00:00.000Z' }
    ,{ approvedExpiry: approved.grantExpiresAt, currentExpiry: approved.grantExpiresAt, checkedAt: '2026-08-13T12:00:00Z' }
  ])('malformed grant or check time is always stale %#', ({ approvedExpiry, currentExpiry, checkedAt }) => {
    const result = evaluatePreflight({ ...approved, grantExpiresAt: approvedExpiry }, { ...approved, grantExpiresAt: currentExpiry, checkedAt });
    expect(result.status).toBe('STALE');
    expect(result.reasons).toContain('INVALID_TIME');
  });
  test('a changed grant expiry requires renewed approval', () => {
    const result = evaluatePreflight(approved, { ...approved, grantExpiresAt: '2026-08-15T00:00:00.000Z', checkedAt: '2026-08-13T12:00:00.000Z' });
    expect(result.status).toBe('STALE');
    expect(result.reasons).toContain('GRANT_CHANGED');
  });
  test('an approved snapshot without an issued grant never becomes ready', () => {
    const result = evaluatePreflight({ ...approved, grantStatus: 'REVOKED' }, { ...approved, checkedAt: '2026-08-13T12:00:00.000Z' });
    expect(result.status).toBe('STALE');
    expect(result.reasons).toContain('GRANT_NOT_ISSUED');
  });
  test('accepts an unchanged current snapshot', () => {
    expect(evaluatePreflight(approved, { ...approved, checkedAt: '2026-08-13T12:00:00.000Z' })).toEqual({ status: 'READY', reasons: [] });
  });

  test('invalidates before execution when Project or authorization changes', () => {
    expect(evaluatePreflight(approved, { ...approved, projectSnapshotVersion: 'project-2', grantStatus: 'REVOKED', checkedAt: '2026-08-13T12:00:00.000Z' })).toEqual({ status: 'STALE', reasons: ['PROJECT_SNAPSHOT_CHANGED', 'GRANT_NOT_ISSUED'] });
  });
});
