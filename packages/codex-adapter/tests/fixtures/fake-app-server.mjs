/* global process, setTimeout */
import { spawn } from 'node:child_process';
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
if (mode !== 'timeout' && mode !== 'exit' && mode !== 'tree') process.stdout.write(`${typeof fixtures[mode] === 'string' ? fixtures[mode] : JSON.stringify(fixtures[mode])}\n`);
