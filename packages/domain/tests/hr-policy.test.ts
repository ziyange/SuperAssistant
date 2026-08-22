import { expect, test } from 'vitest';
import { evaluateHrAction } from '../src/hr-policy.js';

test('requires an L4 human Decision for any employment action', () => {
  expect(evaluateHrAction({ dataClassification: 'SENSITIVE', intent: 'EMPLOYMENT_ACTION', hasHumanDecision: false })).toEqual({ allowed: false, reason: 'HUMAN_DECISION_REQUIRED' });
});

test('rejects unclassified HR data before it can be processed', () => {
  expect(evaluateHrAction({ dataClassification: 'UNKNOWN', intent: 'ANALYSIS', hasHumanDecision: false })).toEqual({ allowed: false, reason: 'DATA_CLASSIFICATION_REQUIRED' });
});
