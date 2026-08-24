import { expect, test } from 'vitest';
import { createDshAttemptPolicy } from '../src/dsh-attempt-policy.js';

const input = {
  attemptId: 'attempt-1',
  functionRef: { id: 'dsh-development', version: '1.0.0' },
  proposalDigest: 'sha256:proposal',
  grantRef: 'grant-1',
  projectSnapshotVersion: 7,
  baselineCommit: 'a'.repeat(40),
  leaseFence: 12,
  capabilityBindings: {
    shell: { toolNames: ['bash'], targets: ['E:/Projects/demo'] },
    filesystem: { toolNames: ['read_file'], targets: ['E:/Projects/demo/src'] },
    network: { toolNames: ['web_fetch'], targets: ['https://api.example.test'] },
    plugin: { toolNames: ['plugin_call'], targets: ['reviewer'], plugins: { reviewer: 'sha256:plugin' } }
  },
  budget: 4,
  runtimeProfileDigest: 'sha256:profile'
} as const;

test('canonicalizes and freezes a complete nonsecret Attempt policy', () => {
  const first = createDshAttemptPolicy(input);
  const second = createDshAttemptPolicy({ ...input, capabilityBindings: { ...input.capabilityBindings } });
  expect(first.policyDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(second.policyDigest).toBe(first.policyDigest);
  expect(Object.isFrozen(first)).toBe(true);
  expect(Object.isFrozen(first.capabilityBindings.shell.toolNames)).toBe(true);
  expect(() => { (first as { budget: number }).budget = 99; }).toThrow();
});

test('changes authority facts and rejects secret-bearing policy values', () => {
  const first = createDshAttemptPolicy(input);
  expect(createDshAttemptPolicy({ ...input, grantRef: 'grant-2' }).policyDigest).not.toBe(first.policyDigest);
  expect(createDshAttemptPolicy({ ...input, leaseFence: 13 }).policyDigest).not.toBe(first.policyDigest);
  expect(() => createDshAttemptPolicy({ ...input, grantRef: 'secret-value' })).toThrow('SECRET_POLICY_VALUE');
});
