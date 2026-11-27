'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const process = require('node:process');
const { performance } = require('node:perf_hooks');
const { setTimeout: delay } = require('node:timers/promises');

// Fixture-only, exclusive-directory cleanup; this is not process termination proof.
function captureFixtureDirectory(directory) {
  const canonical = value => process.platform === 'win32' ? value.toLowerCase() : value;
  const temp = fs.realpathSync.native(os.tmpdir());
  if (typeof directory !== 'string' || !path.isAbsolute(directory)
      || canonical(path.dirname(directory)) !== canonical(temp)
      || !/^sa-package-(profile|clone)-[a-z0-9]+$/i.test(path.basename(directory))) {
    throw new Error('UNSAFE_FIXTURE_DIRECTORY');
  }
  const identity = fs.lstatSync(directory, { bigint: true });
  if (!identity.isDirectory() || identity.isSymbolicLink()
      || canonical(fs.realpathSync.native(directory)) !== canonical(directory)) {
    throw new Error('UNSAFE_FIXTURE_DIRECTORY');
  }
  function assertSameDirectory() {
    try {
      const current = fs.lstatSync(directory, { bigint: true });
      if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== identity.dev || current.ino !== identity.ino
          || canonical(fs.realpathSync.native(directory)) !== canonical(directory)) throw new Error('changed');
    } catch { throw Object.assign(new Error('FIXTURE_DIRECTORY_CHANGED'), { fixtureDirectory: directory }); }
  }
  async function removeOwned() {
    const started = performance.now();
    let previous;
    for (let attempt = 0; attempt <= 50; attempt += 1) {
      if (previous && performance.now() - started >= 5000) throw previous;
      assertSameDirectory();
      try {
        await fs.promises.rm(directory, { recursive: true, force: false });
        return;
      } catch (error) {
        if (!error || !['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error.code) || attempt === 50) throw error;
        previous = error;
        const remaining = 5000 - (performance.now() - started);
        if (remaining <= 0) throw error;
        await delay(Math.min(100, remaining));
      }
    }
    throw previous;
  }
  let pending;
  return function cleanup() {
    if (arguments.length !== 0) return Promise.reject(new Error('UNSAFE_FIXTURE_DIRECTORY'));
    if (!pending) pending = removeOwned();
    return pending;
  };
}

module.exports = { captureFixtureDirectory };
