import { expect, test } from 'vitest';
import { createQualityEvidence, remediationFromRejection } from '../src/quality-evidence.js';

test('rejects self-authored Inspector evidence and keeps remediation in the original Task', () => {
  expect(() => createQualityEvidence({ taskId: 'task-1', workItemId: 'work-1', executorAgentId: 'agent-1', evaluatorAgentId: 'agent-1', role: 'INSPECTOR', outcome: 'REJECTED' })).toThrow('QUALITY_EVIDENCE_NOT_INDEPENDENT');
  expect(remediationFromRejection({ taskId: 'task-1', workItemId: 'work-1', executorAgentId: 'agent-1', evaluatorAgentId: 'agent-2', role: 'INSPECTOR', outcome: 'REJECTED' })).toEqual({ taskId: 'task-1', remediationFor: 'work-1' });
});
