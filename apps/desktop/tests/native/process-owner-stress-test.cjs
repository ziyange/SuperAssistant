/* global __filename */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { Buffer } = require('node:buffer');
const process = require('node:process');
const console = require('node:console');
const { setTimeout, clearTimeout } = require('node:timers');

async function subject(directory, addonPath) {
  const addon = require(addonPath);
  const owner = addon.start(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], directory);
  const pending = [owner.read().catch(() => null), owner.write(Buffer.alloc(1048576)).catch(() => null)];
  await assert.rejects(owner.write(Buffer.alloc(1048576, 1)));
  await assert.rejects(owner.write(Buffer.alloc(1048576, 2)));
  await new Promise(resolveWait => setTimeout(resolveWait, 200));
  assert.equal(await owner.stop(), 'TERMINATED');
  await Promise.all(pending);
  console.log('bounded stop under blocked I/O: PASS');
}

function abandoned(directory, addonPath, suffix) {
  const addon = require(addonPath);
  const pidFile = join(directory, 'abandoned-' + suffix + '.pid');
  const code = "require('node:fs').writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {}, 1000)";
  const owner = addon.start(process.execPath, ['-e', code, pidFile], directory);
  owner.read().catch(() => null);
  owner.write(Buffer.alloc(1048576)).catch(() => null);
}

async function verifyAbandoned(directory, addonPath, delayed) {
  const suffix = delayed ? 'delayed' : 'normal';
  const env = { ...process.env };
  if (delayed) env.SA_OWNER_TEST_DELAY = '1';
  else delete env.SA_OWNER_TEST_DELAY;
  const started = Date.now();
  const child = spawn(process.execPath, [__filename, '--abandon', directory, addonPath, suffix], {
    stdio: 'ignore', windowsHide: true, env
  });
  const outcome = await new Promise(resolveWait => {
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, 10000);
    child.once('close', code => { clearTimeout(timer); resolveWait(timedOut ? 'timeout' : code); });
  });
  const pidFile = join(directory, 'abandoned-' + suffix + '.pid');
  assert.ok(existsSync(pidFile), 'the owned child must have started');
  const pid = Number(readFileSync(pidFile, 'utf8'));
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try { process.kill(pid, 0); await new Promise(resolveWait => setTimeout(resolveWait, 50)); }
    catch (error) { if (error.code === 'ESRCH') break; throw error; }
  }
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  assert.equal(outcome, 0, 'abandoned I/O must not hold the application open indefinitely');
  if (delayed) assert.ok(Date.now() - started >= 4000, 'the test-only scheduling delay must have occurred');
}

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'super-assistant-owner-stress-'));
  const addonPath = resolve('apps/desktop/native/build/Release/process_owner.node');
  try {
    const child = spawn(process.execPath, [__filename, '--subject', directory, addonPath], {
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
    });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    const outcome = await new Promise(resolveWait => {
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill(); }, 10000);
      child.once('close', code => { clearTimeout(timer); resolveWait(timedOut ? 'timeout' : code); });
    });
    assert.equal(outcome, 0, 'the owned Job must terminate despite blocked I/O');
    assert.match(output, /bounded stop under blocked I\/O: PASS/);
    await verifyAbandoned(directory, addonPath, false);
    await verifyAbandoned(directory, resolve('apps/desktop/native/build/Release/process_owner_test.node'), true);
    console.log('bounded stop under blocked I/O: PASS');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[2] === '--subject') {
  subject(process.argv[3], process.argv[4]).catch(() => { process.exitCode = 1; });
} else if (process.argv[2] === '--abandon') {
  abandoned(process.argv[3], process.argv[4], process.argv[5]);
} else main().catch(error => { console.error('owner stress test failed:', error.message); process.exitCode = 1; });
