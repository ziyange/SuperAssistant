const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { Buffer } = require('node:buffer');
const process = require('node:process');
const console = require('node:console');
const addon = require(process.argv[2]);

async function main() {
  const { WindowsNativeVault, loadBundledWindowsNativeVault } = await import('../../dist/main/windows-native-vault.js');
  const vault = new WindowsNativeVault(addon);
  const bundledVault = loadBundledWindowsNativeVault();
  assert.ok(bundledVault instanceof WindowsNativeVault);
  const production = require('../../dist/native/wincred_native.node');
  assert.equal(production.cleanup, undefined);
  assert.throws(() => production.read('invalid'));
  const ref = 'pkey-' + randomBytes(32).toString('hex');
  console.log('synthetic target: SuperAssistant/TestAddon/' + ref);
  let key;
  try {
    assert.throws(() => addon.read(ref + 'x'));
    assert.throws(() => addon.create(ref + '\\0'));
    assert.equal(await vault.read(ref), null);
    key = await vault.create(ref);
    assert.equal(Buffer.isBuffer(key) && key.length, 32);
    const observed = await vault.read(ref);
    assert.deepEqual(observed, key);
    vault.release(observed);
    await assert.rejects(vault.create(ref));
    const duplicates = await Promise.allSettled(Array.from({ length: 8 }, () => vault.create(ref)));
    assert.equal(duplicates.every(result => result.status === 'rejected'), true);
    const retained = await vault.read(ref);
    assert.deepEqual(retained, key);
    vault.release(retained);
    const wrong = Buffer.from(key);
    wrong[0] ^= 1;
    assert.equal(await addon.cleanup(ref, wrong), false);
    wrong.fill(0);
    assert.equal(await addon.cleanup(ref, key), true);
    assert.equal(await vault.read(ref), null);
    console.log('synthetic credential create/read/duplicate/exact cleanup: PASS');
  } finally {
    if (key) {
      await addon.cleanup(ref, key).catch(() => {});
      vault.release(key);
    }
  }
}

main().catch(() => { console.error('synthetic credential integration failed'); process.exitCode = 1; });
