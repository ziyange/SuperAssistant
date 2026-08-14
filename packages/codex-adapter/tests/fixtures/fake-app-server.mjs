/* global process, setTimeout */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const mode = process.env.FAKE_APP_SERVER_MODE ?? 'success';
if (mode === 'timeout') setTimeout(() => undefined, 10_000);
if (mode === 'exit') process.exit(17);
if (mode === 'tree') {
  const descendant = spawn(process.execPath, ['-e', 'setTimeout(() => undefined, 10000)'], { stdio: 'ignore', windowsHide: true });
  process.stdout.write(`child:${String(descendant.pid)}\n`);
  setTimeout(() => undefined, 10_000);
}
const fixtures = {
  success: { version: '0.121.0', authenticated: true, capabilities: ['develop'] },
  auth_required: { version: '0.121.0', authenticated: false, capabilities: [] },
  incompatible: { version: '0.120.0', authenticated: true, capabilities: ['develop'] },
  malformed: '{not-json}'
};
if (mode !== 'timeout' && mode !== 'exit' && mode !== 'tree') process.stdout.write(`${typeof fixtures[mode] === 'string' ? fixtures[mode] : JSON.stringify(fixtures[mode] ?? fixtures.success)}\n`);

const executionFixtures = {
  execution_success: { state: 'RUNNING', events: [{ sequence: 1, type: 'EXECUTION_STARTED' }, { sequence: 2, type: 'EXECUTION_SUCCEEDED' }] },
  execution_failure: { state: 'FAILED', events: [{ sequence: 1, type: 'EXECUTION_STARTED' }, { sequence: 2, type: 'EXECUTION_FAILED' }] },
  execution_disconnect: { state: 'INDETERMINATE', events: [] }
};
if (Object.hasOwn(executionFixtures, mode)) createInterface({ input: process.stdin }).once('line', () => process.stdout.write(`${JSON.stringify(executionFixtures[mode])}\n`));
if (mode === 'execution_crash') createInterface({ input: process.stdin }).once('line', () => process.exit(19));
