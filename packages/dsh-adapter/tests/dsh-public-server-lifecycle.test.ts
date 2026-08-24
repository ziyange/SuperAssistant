/* global process */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

test('public SDK server accepts initialize then shutdown without a prompt or capability effect', async () => {
  const runner = resolve('packages/dsh-adapter/fixtures/sdk-server/runner.mjs');
  const child = spawn(process.execPath, [runner], { cwd: resolve('packages/dsh-adapter'), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  let stdout = ''; let stderr = '';
  child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8'); child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdin.write('{"jsonrpc":"2.0","id":"init","method":"initialize","params":{"cwd":"E:/fixture","provider":"fixture-provider","model":"fixture-model"}}\n');
  child.stdin.write('{"jsonrpc":"2.0","id":"stop","method":"shutdown"}\n'); child.stdin.end();
  await once(child, 'exit');
  expect(child.exitCode, stderr).toBe(0);
  expect(stdout).toContain('deepseek-harness-sdk-runtime');
  expect(stdout).toContain('"id":"stop"');
  expect(stdout).not.toContain('session/prompt');
});
