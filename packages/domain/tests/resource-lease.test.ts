import { expect, test } from 'vitest';
import { acquireResourceLease, canWriteWithFence, releaseResourceLease } from '../src/resource-lease.js';

test('fences stale resource owners and releases only its current lease', () => {
  const first = acquireResourceLease({ leaseId: 'lease-1', resourceKey: 'worktree:project-1', attemptId: 'attempt-1', fencingToken: 1, expiresAt: '2026-08-13T00:01:00.000Z' });
  const second = acquireResourceLease({ leaseId: 'lease-2', resourceKey: 'worktree:project-1', attemptId: 'attempt-2', fencingToken: 2, expiresAt: '2026-08-13T00:01:00.000Z' });
  expect(canWriteWithFence(first, 2)).toBe(false);
  expect(canWriteWithFence(second, 2)).toBe(true);
  expect(releaseResourceLease(second).state).toBe('RELEASED');
});
