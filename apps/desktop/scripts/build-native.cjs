/* global __dirname */
const { execFileSync } = require('node:child_process');
const { copyFileSync, mkdirSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const process = require('node:process');

if (process.platform === 'win32') {
  const desktop = resolve(__dirname, '..');
  const native = resolve(desktop, 'native');
  let gyp;
  try {
    if (require('node-gyp/package.json').version !== '11.5.0') throw new Error('Wrong node-gyp version');
    gyp = require.resolve('node-gyp/bin/node-gyp.js');
  } catch {
    const embedded = resolve(dirname(process.execPath), 'node_modules', 'npm', 'node_modules', 'node-gyp');
    if (require(resolve(embedded, 'package.json')).version !== '11.5.0') throw new Error('Pinned node-gyp is unavailable');
    gyp = resolve(embedded, 'bin', 'node-gyp.js');
  }
  execFileSync(process.execPath, [gyp, 'rebuild', '--directory', native], { stdio: 'inherit' });
  const output = resolve(desktop, 'dist', 'native');
  mkdirSync(output, { recursive: true });
  copyFileSync(resolve(native, 'build', 'Release', 'wincred_native.node'), resolve(output, 'wincred_native.node'));
}
