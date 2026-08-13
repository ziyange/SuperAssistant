import { describe, expect, test } from 'vitest';
import { ProposalPreflightService } from '../../src/main/preflight-service.js';

describe('Proposal preflight service', () => {
  test('never issues a grant for a read-only request', () => {
    const service = new ProposalPreflightService();
    expect(service.classify(['READ'])).toEqual({ kind: 'READ_ONLY', actions: ['READ'] });
  });

  test('marks changed Project snapshots stale before a side effect may run', () => {
    const service = new ProposalPreflightService();
    expect(service.preflight({ projectSnapshotVersion: 'one', agentVersion: '1', functionVersion: '1', capabilityVersion: '1', baselineCommit: 'abc', policyVersion: 'one', grantStatus: 'ISSUED', grantExpiresAt: '2026-08-14T00:00:00.000Z' }, { projectSnapshotVersion: 'two', agentVersion: '1', functionVersion: '1', capabilityVersion: '1', baselineCommit: 'abc', policyVersion: 'one', grantStatus: 'ISSUED', grantExpiresAt: '2026-08-14T00:00:00.000Z', checkedAt: '2026-08-13T00:00:00.000Z' })).toEqual({ status: 'STALE', reasons: ['PROJECT_SNAPSHOT_CHANGED'] });
  });
});
