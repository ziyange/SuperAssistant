import { describe, expect, test } from 'vitest';
import { createProposalVersion } from '../src/proposal.js';

const baseInput = {
  proposalVersionId: 'proposal-1', workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1',
  objective: 'Inspect the repository', actions: ['READ'] as const, projectSnapshotVersion: 'snapshot-1', agentVersion: '1.0.0', functionVersion: '1.0.0', capabilityVersion: '1.0.0', baselineCommit: 'abc123', expiresAt: '2026-08-14T00:00:00.000Z', createdAt: '2026-08-13T00:00:00.000Z'
};

describe('ProposalVersion', () => {
  test('uses a stable lower-case sha256 digest over canonical JSON', () => {
    const first = createProposalVersion(baseInput);
    const second = createProposalVersion({ ...baseInput, actions: [...baseInput.actions] });
    expect(first.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(second.digest).toBe(first.digest);
  });

  test('binds the approved scope to the Project and version snapshots', () => {
    const proposal = createProposalVersion({ ...baseInput, actions: ['READ', 'FILE_WRITE'] });
    expect(proposal.actions).toEqual(['READ', 'FILE_WRITE']);
    expect(proposal.projectSnapshotVersion).toBe('snapshot-1');
    expect(proposal.baselineCommit).toBe('abc123');
  });
});
