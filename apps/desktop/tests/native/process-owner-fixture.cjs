/* global __filename, process, setInterval */
'use strict';
const { spawn } = require('node:child_process');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const [mode, root] = process.argv.slice(2);
if (!root || (mode !== 'parent' && mode !== 'child' && mode !== 'finish')) process.exit(2);
writeFileSync(join(root, mode + '.pid'), String(process.pid), { flag: 'wx' });
writeFileSync(join(root, mode + '.env'), process.env.SA_OWNER_SYNTHETIC_SECRET ? 'present' : 'absent', { flag: 'wx' });
if (mode === 'finish') process.exit(0);
if (mode === 'parent') {
  const child = spawn(process.execPath, [__filename, 'child', root], { stdio: 'ignore', windowsHide: true });
  child.on('error', () => process.exit(3));
}
setInterval(() => {}, 1000);
