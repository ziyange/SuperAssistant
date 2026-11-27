'use strict';
/* global __dirname, __filename */

// Unsigned, disposable packaging fixture only; this is not a release or sandbox test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const process = require('node:process');
const console = require('node:console');
const { Buffer } = require('node:buffer');
const { setTimeout } = require('node:timers');
const { captureFixtureDirectory } = require('./package-fixture-cleanup.cjs');

if (process.argv[2] === '--launch') {
  const [, , , exe, profile] = process.argv;
  const child = spawn(exe, ['--no-error-dialogs', `--user-data-dir=${profile}`], {
    cwd: path.dirname(exe), windowsHide: true,
    env: { ...process.env, SA_PACKAGE_FIXTURE_PROFILE: profile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  child.on('error', () => { process.stdout.write(JSON.stringify({ error: true }) + '\n'); });
  child.on('close', (code, signal) => {
    process.stdout.write(JSON.stringify({ code, signal, ready: output.includes('SA_PACKAGE_FIXTURE_READY'),
      integrity: /asar_file_validator\.cc:\d+\].*failed to validate block.*asar file stream/i.test(output), output: output.slice(-8192) }) + '\n');
  });
} else {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

async function main() {
  assert.equal(process.platform, 'win32');
  const root = path.resolve(__dirname, '../../../..');
  const bundle = path.resolve(process.argv[2] || '');
  const temp = fs.realpathSync.native(os.tmpdir());
  assert.equal(path.dirname(path.dirname(bundle)), temp, 'bundle must be in an isolated temporary output');
  assert.match(path.basename(path.dirname(bundle)), /^sa-package-output-[a-z0-9]+$/);
  function checkTree(entry) {
    const info = fs.lstatSync(entry);
    assert.ok(!info.isSymbolicLink(), `fixture links are forbidden: ${entry}`);
    assert.equal(fs.realpathSync.native(entry).toLowerCase(), path.resolve(entry).toLowerCase(), 'fixture path must be canonical');
    if (info.isDirectory()) for (const name of fs.readdirSync(entry)) checkTree(path.join(entry, name));
    else assert.ok(info.isFile() && info.nlink === 1, `fixture must contain independent regular files: ${entry}`);
  }
  checkTree(path.dirname(bundle));
  const archive = path.join(bundle, 'resources', 'app.asar');
  const asar = await import(pathToFileURL(require.resolve('@electron/asar')).href);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'apps/desktop/packaging/runtime-manifest.json'), 'utf8'));
  const expected = new Set(manifest.entries.map(entry => entry.to));
  for (const item of ['bootstrap.mjs', 'package.json', 'node_modules/@super-assistant/domain/package.json',
    'node_modules/@super-assistant/persistence/package.json', 'node_modules/@super-assistant/codex-adapter/package.json']) expected.add(item);
  const actual = new Set();
  for (const item of asar.listPackage(archive)) {
    const relative = item.replace(/^[\\/]+/, '');
    if (!asar.statFile(archive, relative).files) actual.add(relative.replaceAll('\\', '/'));
  }
  assert.deepEqual([...actual].sort(), [...expected].sort(), 'bundle must contain exactly the explicit runtime manifest');
  const unpacked = [...actual].filter(item => asar.statFile(archive, item.replaceAll('/', path.sep)).unpacked).sort();
  assert.deepEqual(unpacked, ['dist/native/process_owner.node', 'dist/native/wincred_native.node',
    'node_modules/better-sqlite3/prebuilds/win32-x64.node'].sort());
  function listFiles(directory, prefix = '') {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      assert.ok(!entry.isSymbolicLink(), 'unpacked fixture may not contain links');
      return entry.isDirectory() ? listFiles(path.join(directory, entry.name), name) : [name];
    });
  }
  assert.deepEqual(listFiles(path.join(bundle, 'resources', 'app.asar.unpacked')).sort(), unpacked);
  const exe = path.join(bundle, 'SuperAssistant-Test.exe');
  const addon = require(path.join(root, 'apps/desktop/native/build/Release/process_owner.node'));
  const profile = fs.mkdtempSync(path.join(temp, 'sa-package-profile-'));
  const clone = fs.mkdtempSync(path.join(temp, 'sa-package-clone-'));
  const cleanupProfile = captureFixtureDirectory(profile);
  const cleanupClone = captureFixtureDirectory(clone);
  let safeToClean = false;
  try {
    const normal = await launch(addon, exe, profile, root);
    assert.equal(normal.code, 0, JSON.stringify(normal));
    assert.equal(normal.ready, true, JSON.stringify(normal));
    const copy = path.join(clone, 'bundle');
    fs.cpSync(bundle, copy, { recursive: true, errorOnExist: true, force: false });
    checkTree(copy);
    const copyArchive = path.join(copy, 'resources', 'app.asar');
    assert.notEqual(fs.statSync(copyArchive).ino, fs.statSync(archive).ino, 'tamper target must be an independent copy');
    const entry = asar.statFile(copyArchive, path.join('dist', 'renderer', 'index.html'));
    const offset = 8 + asar.getRawHeader(copyArchive).headerSize + Number(entry.offset);
    const fd = fs.openSync(copyArchive, 'r+');
    try {
      const byte = Buffer.alloc(1);
      assert.equal(fs.readSync(fd, byte, 0, 1, offset), 1);
      byte[0] ^= 1;
      assert.equal(fs.writeSync(fd, byte, 0, 1, offset), 1);
    } finally { fs.closeSync(fd); }
    const tamperedProfile = fs.mkdtempSync(path.join(temp, 'sa-package-profile-'));
    const cleanupTamperedProfile = captureFixtureDirectory(tamperedProfile);
    let tamperedVerified = false;
    try {
      const changed = await launch(addon, path.join(copy, 'SuperAssistant-Test.exe'), tamperedProfile, root);
      assert.equal(changed.ready, false, JSON.stringify(changed));
      assert.notEqual(changed.code, 0, JSON.stringify(changed));
      assert.equal(changed.integrity, true, JSON.stringify(changed));
      tamperedVerified = true;
    } finally {
      if (tamperedVerified) await cleanupTamperedProfile();
      else console.error(`Fixture profile retained: ${tamperedProfile}`);
    }
    safeToClean = true;
  } finally {
    if (safeToClean) {
      await cleanupProfile();
      await cleanupClone();
    } else console.error(`Fixture evidence retained: ${profile}; ${clone}`);
  }
  console.log(`package manifest ${actual.size} files, native exclusions, startup, tamper rejection and cleanup: PASS`);
}

async function launch(addon, exe, profile, cwd) {
  const owner = await addon.start(process.execPath, [__filename, '--launch', exe, profile], cwd);
  try {
    let output = '';
    const deadline = Date.now() + 30000;
    while (!output.includes('\n') && Date.now() < deadline) {
      const part = await Promise.race([owner.read(), new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('fixture read timeout')), 30000);
        timer.unref();
      })]);
      output += part.toString('utf8');
      assert.ok(output.length < 65536, 'fixture output exceeded limit');
    }
    assert.ok(output.includes('\n'), 'fixture did not exit before deadline');
    return JSON.parse(output.split('\n')[0]);
  } finally { assert.equal(await owner.stop(), 'TERMINATED', 'owned fixture process tree must terminate'); }
}
