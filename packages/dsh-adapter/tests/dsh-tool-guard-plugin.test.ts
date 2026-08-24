/* global URL */
/* eslint-disable no-unused-vars -- fixture callback parameter names demonstrate the public ToolRuntime contract. */
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { mountDshToolGuard } from '../src/dsh-tool-guard-plugin.js';
import { mountImmutableDshToolGuard } from '../src/dsh-tool-guard-plugin.js';

test('mounts the Super Assistant guard through the public ToolRuntime shape', () => {
  let mounted: ((execution: { name: string; target: string }) => string | undefined) | undefined;
  const dispose = mountDshToolGuard({ guard: guard => { mounted = guard; return () => { mounted = undefined; }; } }, { authorize: request => request.target === 'fixture' ? { allowed: true } : { allowed: false, reason: 'TARGET_DENIED' } }, execution => ({ toolName: execution.name, target: execution.target, grant: 'g', snapshot: 's', fence: 1 }));
  expect(mounted?.({ name: 'bash', target: 'fixture' })).toBeUndefined();
  expect(mounted?.({ name: 'bash', target: 'outside' })).toBe('TARGET_DENIED');
  dispose();
  expect(mounted).toBeUndefined();
});

test('mounts a static Attempt policy and cannot accept a caller-supplied authority value', () => {
  let mounted: ((execution: { name: string; target: string; grant: string }) => string | undefined) | undefined;
  mountImmutableDshToolGuard({ guard: guard => { mounted = guard; return () => {}; } }, {
    attemptId: 'attempt-1', functionRef: { id: 'dsh', version: '1' }, proposalDigest: 'sha256:proposal', grantRef: 'grant-1', projectSnapshotVersion: 1, baselineCommit: 'a'.repeat(40), leaseFence: 2, budget: 1, runtimeProfileDigest: 'sha256:profile',
    capabilityBindings: {
      shell: { toolNames: ['bash'], targets: ['workspace'] },
      filesystem: { toolNames: ['read_file'], targets: ['workspace'] },
      network: { toolNames: ['web_fetch'], targets: ['https://example.test'] },
      plugin: { toolNames: ['plugin_call'], targets: ['reviewer'] }
    }
  }, execution => ({ toolName: execution.name, target: execution.target }));
  expect(mounted?.({ name: 'bash', target: 'workspace', grant: 'forged' })).toBeUndefined();
  expect(mounted?.({ name: 'bash', target: 'outside', grant: 'grant-1' })).toBe('TARGET_DENIED');
});

test('disposable profile contains only the configuration-relative Guard reference', () => {
  const fixture = readFileSync(new URL('../fixtures/production.cordis.yml', import.meta.url), 'utf8');
  const profilePackage = readFileSync(new URL('../fixtures/profile/package.json', import.meta.url), 'utf8');
  expect(fixture).toContain('path: ../dist/dsh-tool-guard-plugin.js');
  expect(fixture).not.toMatch(/provider|credential|shell|filesystem|network/i);
  expect(profilePackage).toContain('"@deepseek-ai/dsh-tools": "0.1.0-rc.8"');
});
