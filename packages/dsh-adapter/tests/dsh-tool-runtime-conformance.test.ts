/* global AbortController */
import { Context } from '@deepseek-ai/cordis';
import ToolRuntime from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import { expect, test } from 'vitest';
import { apply } from '../src/dsh-tool-guard-plugin.js';

const policy = {
  attemptId: 'runtime-attempt', functionRef: { id: 'dsh', version: '1' }, proposalDigest: 'sha256:proposal', grantRef: 'grant', projectSnapshotVersion: 1, baselineCommit: 'a'.repeat(40), leaseFence: 1, budget: 2, runtimeProfileDigest: 'sha256:profile',
  capabilityBindings: {
    shell: { toolNames: ['bash'], targets: ['workspace'] },
    filesystem: { toolNames: ['fs_read'], targets: ['workspace'] },
    network: { toolNames: ['web_fetch'], targets: ['https://example.test'] },
    plugin: { toolNames: ['plugin'], targets: ['reviewer'] }
  }
};

test('public ToolRuntime invokes the fixture body only for its exact immutable binding', async () => {
  const ctx = new Context();
  let calls = 0;
  try {
    await ctx.plugin(SystemPrompt);
    await ctx.plugin(ToolRuntime);
    const runtime = ctx.tools;
    type FixtureCallId = Parameters<typeof runtime.execute>[0]['callId'];
    runtime.register({ name: 'bash', description: 'fixture', parameters: { type: 'object', properties: { cwd: { type: 'string' } }, required: ['cwd'], additionalProperties: false }, output: { schema: { type: 'string' }, render: () => [] }, execute: async () => { calls += 1; return 'ok'; } });
    apply(ctx, { policy, bindings: { bash: { targetArgument: 'cwd' } } });
    const signal = new AbortController().signal;
    const denied = await runtime.execute({ callId: 'denied' as FixtureCallId, name: 'bash', arguments: { cwd: 'outside' }, signal });
    const unknown = await runtime.execute({ callId: 'unknown' as FixtureCallId, name: 'other', arguments: {}, signal });
    const allowed = await runtime.execute({ callId: 'allowed' as FixtureCallId, name: 'bash', arguments: { cwd: 'workspace' }, signal });
    expect(denied.isError).toBe(true); expect(unknown.isError).toBe(true);
    expect(allowed.isError).toBe(false); expect(calls).toBe(1);
  } finally { await ctx.fiber.dispose(); }
});
