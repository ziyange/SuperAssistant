import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const directory = process.argv[3];
if (!directory) throw new Error('Missing disposable fixture directory');
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });
if (!child.pid) throw new Error('Fixture child unavailable');
writeFileSync(join(directory, 'parent.pid'), String(process.pid), { flag: 'wx' });
writeFileSync(join(directory, 'child.pid'), String(child.pid), { flag: 'wx' });
await import('../../../../packages/codex-adapter/tests/fixtures/execution-app-server.mjs');
