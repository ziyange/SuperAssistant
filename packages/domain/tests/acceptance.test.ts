import { expect, test } from 'vitest';
import { deriveAcceptance } from '../src/acceptance.js';

test('requires accepted required Work Items, evidence, and no open Decision before completion', () => {
  expect(deriveAcceptance({ requiredWorkItems: [{ workItemId: 'work-1', accepted: true, evidenceCount: 1 }], openDecisionCount: 0 })).toEqual({ state: 'ACCEPTED' });
  expect(deriveAcceptance({ requiredWorkItems: [{ workItemId: 'work-1', accepted: true, evidenceCount: 0 }], openDecisionCount: 0 })).toEqual({ state: 'PENDING', reason: 'MISSING_EVIDENCE' });
  expect(deriveAcceptance({ requiredWorkItems: [{ workItemId: 'work-1', accepted: false, evidenceCount: 1 }], openDecisionCount: 0 })).toEqual({ state: 'REJECTED', remediationFor: 'work-1' });
  expect(deriveAcceptance({ requiredWorkItems: [{ workItemId: 'work-1', accepted: true, evidenceCount: 1 }], openDecisionCount: 1 })).toEqual({ state: 'PENDING', reason: 'OPEN_DECISION' });
});
