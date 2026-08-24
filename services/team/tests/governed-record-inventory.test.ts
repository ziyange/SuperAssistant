import { expect, test } from 'vitest';
import { GovernedRecordInventory } from '../src/governed-record-inventory.js';

test('accounts for every governed record class within one workspace inventory', () => {
  const inventory = new GovernedRecordInventory();
  const result = inventory.build({ workspaceId: 'workspace-a', records: [
    { id: 'attempt-1', class: 'ATTEMPT', payload: '{"state":"COMPLETED"}' },
    { id: 'grant-1', class: 'GRANT', payload: '{"state":"CONSUMED"}' },
    { id: 'hold-1', class: 'LEGAL_HOLD', payload: '{"active":true}' },
    { id: 'rollback-1', class: 'ROLLBACK', payload: '{"state":"APPLIED"}' },
    { id: 'evidence-1', class: 'EVIDENCE', payload: '{"digest":"sha256:aaa"}' },
    { id: 'audit-1', class: 'AUDIT', payload: '{"event":"retention"}' },
    { id: 'retention-1', class: 'RETENTION', payload: '{"policy":"v1"}' }
  ] });

  expect(result.classes).toEqual(['ATTEMPT', 'AUDIT', 'EVIDENCE', 'GRANT', 'LEGAL_HOLD', 'RETENTION', 'ROLLBACK']);
  expect(result.digest).toMatch(/^sha256:/);
});
