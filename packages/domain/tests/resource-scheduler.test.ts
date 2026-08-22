import { expect, test } from 'vitest';
import { scheduleResources } from '../src/resource-scheduler.js';

test('blocks overlapping writes while admitting nonconflicting resource claims', () => {
  const scheduled = scheduleResources([
    { attemptId: 'a1', resources: ['project:one'] },
    { attemptId: 'a2', resources: ['project:one'] },
    { attemptId: 'a3', resources: ['project:two'] }
  ]);
  expect(scheduled).toEqual({ granted: [{ attemptId: 'a1', fencingTokens: { 'project:one': 1 } }, { attemptId: 'a3', fencingTokens: { 'project:two': 1 } }], blocked: ['a2'] });
});

test('treats colon-delimited ancestors and descendants as conflicts without matching raw prefixes', () => {
  const scheduled = scheduleResources([
    { attemptId: 'child-first', resources: ['project:one:file:src/index.ts'] },
    { attemptId: 'parent-second', resources: ['project:one'] },
    { attemptId: 'unrelated-prefix', resources: ['project:one-other'] }
  ]);

  expect(scheduled.granted.map((entry) => entry.attemptId)).toEqual(['child-first', 'unrelated-prefix']);
  expect(scheduled.blocked).toEqual(['parent-second']);
});
