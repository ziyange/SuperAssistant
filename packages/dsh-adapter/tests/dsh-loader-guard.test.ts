/* global process */
/* eslint-disable no-unused-vars -- ToolRuntime guard callback parameter names document the public Loader contract. */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import { expect, test } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '..', '..');
const fixture = readFileSync(resolve(packageRoot, 'fixtures/loader/cordis.yml'), 'utf8');
const policy = {
  attemptId: 'loader-attempt', functionRef: { id: 'dsh', version: '1' }, proposalDigest: 'sha256:proposal', grantRef: 'grant-1', projectSnapshotVersion: 1, baselineCommit: 'a'.repeat(40), leaseFence: 1, budget: 2, runtimeProfileDigest: 'sha256:profile',
  capabilityBindings: {
    shell: { toolNames: ['bash'], targets: ['workspace'] },
    filesystem: { toolNames: ['fs_read'], targets: ['workspace'] },
    network: { toolNames: ['web_fetch'], targets: ['https://example.test'] },
    plugin: { toolNames: ['plugin'], targets: ['reviewer'] }
  }
};

test('the public Cordis Loader mounts the emitted Guard and denies before dispatch', async () => {
  execFileSync(process.execPath, [resolve(repositoryRoot, 'node_modules/typescript/bin/tsc'), '-p', resolve(packageRoot, 'tsconfig.build.json')], { cwd: repositoryRoot, stdio: 'pipe' });
  expect(fixture).toContain('name: ../../dist/dsh-tool-guard-plugin.js');
  expect(existsSync(resolve(packageRoot, 'dist/dsh-tool-guard-plugin.js'))).toBe(true);
  const guards: Array<(execution: { name: string; arguments: unknown }) => string | undefined> = [];
  let bodyCalls = 0;
  const ctx = new Context();
  ctx.baseUrl = pathToFileURL(`${resolve(packageRoot, 'fixtures/loader')}/`).href;
  ctx.provide('tools', { guard: (guard: (execution: { name: string; arguments: unknown }) => string | undefined) => { guards.push(guard); return () => { guards.pop(); }; } });
  try {
    await ctx.plugin(Loader);
    await ctx.loader.create({ name: '../../dist/dsh-tool-guard-plugin.js', config: { policy, bindings: { bash: { targetArgument: 'cwd' } } } });
    await ctx.loader.await();
    expect([...ctx.loader.entries()].some(entry => entry.options.name === '../../dist/dsh-tool-guard-plugin.js')).toBe(true);
    expect(guards).toHaveLength(1);
    const dispatch = (execution: { name: string; arguments: unknown }) => {
      const denied = guards[0]?.(execution);
      if (denied === undefined) bodyCalls += 1;
      return denied;
    };
    expect(dispatch({ name: 'bash', arguments: { cwd: 'workspace' } })).toBeUndefined();
    expect(dispatch({ name: 'bash', arguments: { cwd: 'outside' } })).toBe('TARGET_DENIED');
    expect(dispatch({ name: 'unknown', arguments: {} })).toBe('UNDECLARED_DSH_TOOL');
    expect(bodyCalls).toBe(1);
  } finally {
    await ctx.fiber.dispose();
  }
});
