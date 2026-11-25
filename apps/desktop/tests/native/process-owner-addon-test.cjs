const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { existsSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { Buffer } = require('node:buffer');
const process = require('node:process');
const console = require('node:console');
const { setTimeout } = require('node:timers');
const ownerAddon = require(resolve(process.argv[2]));

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Fixture did not become ready');
    await new Promise(resolveWait => setTimeout(resolveWait, 50));
  }
}

async function main() {
  const directory = mkdtempSync(join(tmpdir(), 'super-assistant-owner-addon-'));
  const wrapper = resolve('apps/desktop/tests/native/owned-execution-wrapper.mjs');
  let owner;
  let unrelated;
  try {
    assert.throws(() => ownerAddon.start('relative.exe', [], directory));
    assert.throws(() => ownerAddon.start(join(directory, 'missing.exe'), [], directory));
    unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { windowsHide: true, stdio: 'ignore' });
    assert.ok(unrelated.pid);
    owner = await ownerAddon.start(process.execPath, [wrapper, 'normal', directory], directory);
    assert.throws(() => owner.write(Buffer.alloc(0)));
    assert.throws(() => owner.write(Buffer.alloc(1048577)));
    assert.throws(() => owner.read('unexpected'));
    const parentFile = join(directory, 'parent.pid'), childFile = join(directory, 'child.pid');
    await waitFor(() => existsSync(parentFile) && existsSync(childFile), 15000);
    const pids = [Number(readFileSync(parentFile, 'utf8')), Number(readFileSync(childFile, 'utf8'))];
    assert.ok(pids.every(pid => Number.isSafeInteger(pid) && pid > 0));
    for (const pid of pids) process.kill(pid, 0);
    const request = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'super_assistant', version: '1' } } }) + '\n');
    await owner.write(request);
    let output = '';
    while (!output.includes('\n')) {
      const part = await Promise.race([owner.read(), new Promise((_, reject) => setTimeout(() => reject(new Error('read timeout')), 10000))]);
      assert.ok(Buffer.isBuffer(part));
      output += part.toString('utf8');
      assert.ok(output.length < 65536);
    }
    assert.equal(JSON.parse(output).result.userAgent, 'fixture/0.121.0');
    assert.equal(await owner.stop(), 'TERMINATED');
    for (const pid of pids) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    process.kill(unrelated.pid, 0);
    await assert.rejects(owner.stop());
    console.log('owned fixture process tree and fake App Server: PASS');
  } finally {
    if (owner) await owner.stop().catch(() => {});
    if (unrelated && unrelated.exitCode === null && unrelated.signalCode === null) {
      unrelated.kill();
      await new Promise(resolveWait => unrelated.once('close', resolveWait));
    }
    // This directory was created by this test and contains only its own fixture data.
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(() => { console.error('owner addon integration failed'); process.exitCode = 1; });
