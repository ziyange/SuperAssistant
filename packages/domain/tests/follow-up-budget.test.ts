import { expect, test } from 'vitest';
import { evaluateFollowUp } from '../src/follow-up-budget.js';

test('blocks a follow-up during cooldown before proposal creation', () => {
  expect(evaluateFollowUp({ now: 1000, lastFollowUpAt: 900, cooldownMs: 200, active: 0, concurrencyLimit: 2, used: 0, budget: 10 })).toEqual({ allowed: false, reason: 'COOLDOWN' });
});

test('blocks over-budget or over-concurrency follow-ups before authorization', () => {
  expect(evaluateFollowUp({ now: 1000, lastFollowUpAt: 0, cooldownMs: 1, active: 2, concurrencyLimit: 2, used: 0, budget: 10 })).toEqual({ allowed: false, reason: 'CONCURRENCY' });
  expect(evaluateFollowUp({ now: 1000, lastFollowUpAt: 0, cooldownMs: 1, active: 0, concurrencyLimit: 2, used: 10, budget: 10 })).toEqual({ allowed: false, reason: 'BUDGET' });
});
