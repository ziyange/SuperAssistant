import { expect, test } from 'vitest';
import { createQualityEvidence, remediationFromRejection } from '../src/quality-evidence.js';
import { scheduleResources } from '../src/resource-scheduler.js';
import { createWorkItemGraph, readyWorkItems } from '../src/work-item-graph.js';

const graphCases = [
  ['dag-01-empty-graph', [], [], [], []],
  ['dag-02-one-root-is-ready', ['a'], [], [], ['a']],
  ['dag-03-one-dependency-blocks-child', ['a', 'b'], [{ from: 'a', to: 'b' }], [], ['a']],
  ['dag-04-accepted-parent-releases-child', ['a', 'b'], [{ from: 'a', to: 'b' }], ['a'], ['b']],
  ['dag-05-two-independent-roots-are-ready', ['a', 'b'], [], [], ['a', 'b']],
  ['dag-06-join-waits-for-every-parent', ['a', 'b', 'c'], [{ from: 'a', to: 'c' }, { from: 'b', to: 'c' }], ['a'], ['b']],
  ['dag-07-join-releases-after-every-parent', ['a', 'b', 'c'], [{ from: 'a', to: 'c' }, { from: 'b', to: 'c' }], ['a', 'b'], ['c']],
  ['dag-08-chain-releases-one-level-at-a-time', ['a', 'b', 'c'], [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }], ['a'], ['b']],
  ['dag-09-accepted-nodes-are-not-ready-again', ['a'], [], ['a'], []],
  ['dag-10-unknown-edge-node-fails-closed', ['a'], [{ from: 'a', to: 'missing' }], [], 'WORK_ITEM_GRAPH_UNKNOWN_NODE']
] as const;

test.each(graphCases)('%s', (_name, nodes, edges, accepted, expected) => {
  if (typeof expected === 'string') {
    expect(() => createWorkItemGraph({ taskId: 'task-1', nodes, edges })).toThrow(expected);
    return;
  }
  expect(readyWorkItems(createWorkItemGraph({ taskId: 'task-1', nodes, edges }), accepted)).toEqual(expected);
});

test('dag-11-cycle-fails-closed', () => {
  expect(() => createWorkItemGraph({ taskId: 'task-1', nodes: ['a', 'b'], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }] })).toThrow('WORK_ITEM_GRAPH_CYCLE');
});

const schedulerCases = [
  ['resource-12-first-claim-is-granted', [{ attemptId: 'a1', resources: ['project:one'] }], ['a1'], []],
  ['resource-13-exact-overlap-is-blocked', [{ attemptId: 'a1', resources: ['project:one'] }, { attemptId: 'a2', resources: ['project:one'] }], ['a1'], ['a2']],
  ['resource-14-disjoint-projects-are-granted', [{ attemptId: 'a1', resources: ['project:one'] }, { attemptId: 'a2', resources: ['project:two'] }], ['a1', 'a2'], []],
  ['resource-15-duplicate-claim-is-normalized', [{ attemptId: 'a1', resources: ['project:one', 'project:one'] }], ['a1'], []],
  ['resource-16-multi-resource-claim-is-granted', [{ attemptId: 'a1', resources: ['project:one', 'project:two'] }], ['a1'], []],
  ['resource-17-any-overlap-blocks-whole-request', [{ attemptId: 'a1', resources: ['project:one'] }, { attemptId: 'a2', resources: ['project:one', 'project:two'] }], ['a1'], ['a2']],
  ['resource-18-empty-claim-is-granted', [{ attemptId: 'a1', resources: [] }], ['a1'], []],
  ['resource-19-token-starts-at-one', [{ attemptId: 'a1', resources: ['project:one'] }], ['a1'], []],
  ['resource-20-tokens-are-per-resource', [{ attemptId: 'a1', resources: ['project:one', 'project:two'] }], ['a1'], []],
  ['resource-21-parent-resource-blocks-descendant-write', [{ attemptId: 'a1', resources: ['project:one'] }, { attemptId: 'a2', resources: ['project:one:file:src/index.ts'] }], ['a1'], ['a2']]
] as const;

test.each(schedulerCases)('%s', (_name, requests, granted, blocked) => {
  const result = scheduleResources(requests);
  expect(result.granted.map((entry) => entry.attemptId)).toEqual(granted);
  expect(result.blocked).toEqual(blocked);
});

test('resource-22-granted-fence-is-monotonic-within-a-request', () => {
  expect(scheduleResources([{ attemptId: 'a1', resources: ['project:one'] }]).granted[0]?.fencingTokens).toEqual({ 'project:one': 1 });
});

const qualityCases = [
  ['quality-23-tester-acceptance-is-independent', 'TESTER', 'ACCEPTED', 'agent-2', false],
  ['quality-24-inspector-acceptance-is-independent', 'INSPECTOR', 'ACCEPTED', 'agent-2', false],
  ['quality-25-tester-rejection-is-independent', 'TESTER', 'REJECTED', 'agent-2', false],
  ['quality-26-inspector-rejection-is-independent', 'INSPECTOR', 'REJECTED', 'agent-2', false],
  ['quality-27-tester-self-verification-fails', 'TESTER', 'ACCEPTED', 'agent-1', true],
  ['quality-28-inspector-self-verification-fails', 'INSPECTOR', 'ACCEPTED', 'agent-1', true],
  ['quality-29-remediation-keeps-task-identity', 'INSPECTOR', 'REJECTED', 'agent-2', false],
  ['quality-30-remediation-keeps-work-item-identity', 'TESTER', 'REJECTED', 'agent-2', false]
] as const;

test.each(qualityCases)('%s', (_name, role, outcome, evaluatorAgentId, shouldReject) => {
  const evidence = { taskId: 'task-1', workItemId: 'work-1', executorAgentId: 'agent-1', evaluatorAgentId, role, outcome } as const;
  if (shouldReject) {
    expect(() => createQualityEvidence(evidence)).toThrow('QUALITY_EVIDENCE_NOT_INDEPENDENT');
    return;
  }
  expect(createQualityEvidence(evidence).taskId).toBe('task-1');
  if (outcome === 'REJECTED') expect(remediationFromRejection(evidence)).toEqual({ taskId: 'task-1', remediationFor: 'work-1' });
});
