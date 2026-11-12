import { describe, expect, test } from 'vitest';
import { parseH1ProposalCandidate } from '../src/proposal-candidate.js';

function candidate() {
  return {
    objective: 'Update the report',
    workspaceId: 'workspace-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1',
    projectSnapshotVersion: '1', agentVersion: '1', functionVersion: '1', capabilityVersion: '1', baselineCommit: 'abc123',
    createdAt: '2026-08-13T00:00:00.000Z', expiresAt: '2026-08-13T01:00:00.000Z', deadlineAt: '2026-08-13T02:00:00.000Z',
    budget: { maxDurationMs: 60000, maxTokens: 1000, maxCost: { minorUnits: 100, currency: 'USD' } },
    capabilities: [{ id: 'editing', version: '1' }],
    workItems: [{ id: 'work-1', projectId: 'project-1', agentId: 'agent-1', functionId: 'function-1', objective: 'Write the report', required: true, dependencies: [] }],
    resources: [{ key: 'project:project-1/report.md', intent: 'WRITE' }],
    allowedActions: ['FILE_WRITE'], forbiddenActions: ['NETWORK'],
    reconfirmationTriggers: ['project snapshot changed'], risk: 'HIGH',
    acceptanceCriteria: [{ criterion: 'Report contains all sections', evidence: 'report check output' }]
  };
}

describe('H1 Proposal candidate structural boundary', () => {
  test('accepts a complete candidate and detaches nested input', () => {
    const input = candidate();
    const parsed = parseH1ProposalCandidate(input);
    input.resources[0]!.key = 'changed';
    input.acceptanceCriteria[0]!.criterion = 'changed';
    input.budget.maxCost.minorUnits = 900;
    expect(parsed.resources[0]!.key).toBe('project:project-1/report.md');
    expect(parsed.acceptanceCriteria[0]!.criterion).toBe('Report contains all sections');
    expect(parsed.budget.maxCost!.minorUnits).toBe(100);
    expect(parsed.workItems[0]!.required).toBe(true);
  });

  test.each(['objective', 'workspaceId', 'projectId', 'agentId', 'functionId', 'projectSnapshotVersion', 'agentVersion', 'functionVersion', 'capabilityVersion', 'baselineCommit', 'createdAt', 'expiresAt', 'deadlineAt', 'budget', 'capabilities', 'workItems', 'resources', 'allowedActions', 'forbiddenActions', 'reconfirmationTriggers', 'risk', 'acceptanceCriteria'])('rejects absent required field %s', (field) => {
    const input = candidate() as Record<string, unknown>;
    delete input[field];
    expect(() => parseH1ProposalCandidate(input)).toThrow();
  });

  test('rejects invalid timestamps and non-increasing temporal bounds', () => {
    const input = candidate();
    for (const value of ['not-a-time', '2026-02-30T00:00:00.000Z', '2026-08-13T00:00:00Z', '2026-08-13T00:00:00.000+00:00']) {
      expect(() => parseH1ProposalCandidate({ ...input, createdAt: value })).toThrow();
    }
    expect(() => parseH1ProposalCandidate({ ...input, expiresAt: input.createdAt })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...input, deadlineAt: input.createdAt })).toThrow();
  });

  test('rejects missing, negative, fractional, unsafe and malformed budget limits', () => {
    const input = candidate();
    for (const maxDurationMs of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => parseH1ProposalCandidate({ ...input, budget: { ...input.budget, maxDurationMs } })).toThrow();
    }
    for (const maxTokens of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => parseH1ProposalCandidate({ ...input, budget: { ...input.budget, maxTokens } })).toThrow();
    }
    expect(() => parseH1ProposalCandidate({ ...input, budget: { maxDurationMs: 1, maxCost: null } })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...input, budget: { ...input.budget, extra: true } })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...input, budget: { ...input.budget, maxCost: { minorUnits: -1, currency: 'USD' } } })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...input, budget: { ...input.budget, maxCost: { minorUnits: 1, currency: 'usd' } } })).toThrow();
    expect(parseH1ProposalCandidate({ ...input, budget: { maxDurationMs: 1, maxTokens: null, maxCost: null } }).budget.maxCost).toBeNull();
  });

  test('rejects extra fields, whitespace identity and malformed nested values', () => {
    expect(() => parseH1ProposalCandidate({ ...candidate(), unexpected: true })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...candidate(), projectId: '  ' })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...candidate(), capabilities: [{ id: 'editing' }] })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...candidate(), acceptanceCriteria: [{ criterion: 'done', evidence: '' }] })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...candidate(), resources: [{ key: 'path', intent: 'DELETE' }] })).toThrow();
  });

  test('rejects missing scope, read-only, unknown and conflicting actions', () => {
    expect(() => parseH1ProposalCandidate({ ...candidate(), resources: [] })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...candidate(), allowedActions: ['READ'] })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...candidate(), allowedActions: ['UNKNOWN'] })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...candidate(), forbiddenActions: ['FILE_WRITE'] })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...candidate(), reconfirmationTriggers: [] })).toThrow();
  });

  test('rejects multiple or optional work items, dependencies and identity mismatch', () => {
    const input = candidate();
    const item = input.workItems[0]!;
    expect(() => parseH1ProposalCandidate({ ...input, workItems: [] })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...input, workItems: [item, item] })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...input, workItems: [{ ...item, required: false }] })).toThrow();
    expect(() => parseH1ProposalCandidate({ ...input, workItems: [{ ...item, dependencies: ['other'] }] })).toThrow();
    for (const field of ['projectId', 'agentId', 'functionId']) {
      expect(() => parseH1ProposalCandidate({ ...input, workItems: [{ ...item, [field]: 'other' }] })).toThrow();
    }
  });
});
