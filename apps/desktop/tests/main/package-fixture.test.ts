import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir as systemTmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import process from 'node:process';
import { expect, test } from 'vitest';

// Windows CI may provide TEMP as an 8.3 alias; test the canonical directory.
function tmpdir(): string { return realpathSync.native(systemTmpdir()); }

function run(source: string, output: string) {
  return spawnSync(process.execPath, [join(source, 'apps/desktop/scripts/package-fixture.mjs'), '--source', source, '--output', output],
    { encoding: 'utf8', timeout: 15000, windowsHide: true });
}

function fixtureSource(root: string): string {
  const source = join(root, 'source');
  mkdirSync(join(source, 'apps/desktop/scripts'), { recursive: true });
  copyFileSync(resolve('apps/desktop/scripts/package-fixture.mjs'), join(source, 'apps/desktop/scripts/package-fixture.mjs'));
  return source;
}

test('refuses an existing nonempty output without changing its file', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-package-guard-'));
  const output = mkdtempSync(join(tmpdir(), 'sa-package-output-'));
  try {
    const source = fixtureSource(root);
    writeFileSync(join(output, 'keep.txt'), 'keep');
    const result = run(source, output);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('OUTPUT_NOT_EMPTY');
    expect(readFileSync(join(output, 'keep.txt'), 'utf8')).toBe('keep');
  } finally { rmSync(output, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
});

test('rejects missing runtime inputs before populating an empty output', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-package-guard-'));
  const output = mkdtempSync(join(tmpdir(), 'sa-package-output-'));
  try {
    const source = fixtureSource(root);
    const result = run(source, output);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('MISSING_RUNTIME_INPUT');
  } finally { rmSync(output, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
});

test('rejects a symlinked output directory before touching its target', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-package-guard-'));
  const output = join(tmpdir(), 'sa-package-output-' + randomBytes(8).toString('hex'));
  try {
    const source = fixtureSource(root), target = join(root, 'target');
    mkdirSync(target);
    symlinkSync(target, output, process.platform === 'win32' ? 'junction' : 'dir');
    const result = run(source, output);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('UNSAFE_OUTPUT_PATH');
  } finally { try { unlinkSync(output); } catch { /* absent link */ } rmSync(root, { recursive: true, force: true }); }
});

test('rejects manifest path traversal without reading or copying the escaped file', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-package-guard-'));
  const output = mkdtempSync(join(tmpdir(), 'sa-package-output-'));
  try {
    const source = fixtureSource(root);
    mkdirSync(join(source, 'apps/desktop/dist/main'), { recursive: true });
    mkdirSync(join(source, 'apps/desktop/packaging'), { recursive: true });
    writeFileSync(join(source, 'apps/desktop/dist/main/main.js'), 'fixture');
    writeFileSync(join(root, 'outside.json'), 'private');
    writeFileSync(join(source, 'apps/desktop/packaging/runtime-manifest.json'), JSON.stringify({ version: 1, entries: [{ from: '../outside.json', to: 'dist/main/outside.json', kind: 'build' }] }));
    const result = run(source, output);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('INVALID_RUNTIME_MANIFEST');
    expect(readFileSync(join(root, 'outside.json'), 'utf8')).toBe('private');
  } finally { rmSync(output, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
});

test('rejects a manifest reached through a linked source directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-package-guard-'));
  const output = mkdtempSync(join(tmpdir(), 'sa-package-output-'));
  try {
    const source = fixtureSource(root), outside = join(root, 'outside');
    mkdirSync(join(source, 'apps/desktop/dist/main'), { recursive: true });
    mkdirSync(outside);
    writeFileSync(join(source, 'apps/desktop/dist/main/main.js'), 'fixture');
    writeFileSync(join(outside, 'runtime-manifest.json'), JSON.stringify({ version: 1, entries: [] }));
    symlinkSync(outside, join(source, 'apps/desktop/packaging'), process.platform === 'win32' ? 'junction' : 'dir');
    const result = run(source, output);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('UNSAFE_RUNTIME_INPUT');
  } finally { rmSync(output, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
});

test.skipIf(process.platform !== 'win32')('rejects case-altered dependency paths that omit integrity hashes', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-package-guard-'));
  const output = mkdtempSync(join(tmpdir(), 'sa-package-output-'));
  try {
    const source = fixtureSource(root);
    mkdirSync(join(source, 'apps/desktop/dist/main'), { recursive: true });
    mkdirSync(join(source, 'apps/desktop/packaging'), { recursive: true });
    mkdirSync(join(source, 'node_modules/zod'), { recursive: true });
    writeFileSync(join(source, 'apps/desktop/dist/main/main.js'), 'fixture');
    writeFileSync(join(source, 'node_modules/zod/index.js'), 'fixture');
    writeFileSync(join(source, 'apps/desktop/packaging/runtime-manifest.json'), JSON.stringify({ version: 1, entries: [{ from: 'Node_modules/zod/index.js', to: 'Node_modules/zod/index.js', kind: 'build' }] }));
    const result = run(source, output);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('INVALID_RUNTIME_MANIFEST');
  } finally { rmSync(output, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
});

test('rejects a source root different from the script-owned repository', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-package-guard-'));
  const output = mkdtempSync(join(tmpdir(), 'sa-package-output-'));
  try {
    const source = fixtureSource(root), other = join(root, 'other');
    mkdirSync(other);
    const result = spawnSync(process.execPath, [join(source, 'apps/desktop/scripts/package-fixture.mjs'), '--source', other, '--output', output],
      { encoding: 'utf8', timeout: 15000, windowsHide: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('UNSAFE_SOURCE_PATH');
  } finally { rmSync(output, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
});

test.skipIf(process.platform !== 'win32')('refuses a linked package before touching its target', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-package-guard-'));
  const output = join(tmpdir(), 'sa-package-output-' + randomBytes(16).toString('hex'));
  mkdirSync(output);
  const bundle = join(output, 'bundle'), target = join(root, 'target');
  try {
    mkdirSync(bundle);
    mkdirSync(target);
    writeFileSync(join(target, 'app.asar'), 'untouched');
    symlinkSync(target, join(bundle, 'resources'), 'junction');
    const result = spawnSync(process.execPath, [resolve('apps/desktop/tests/native/package-fixture-smoke.cjs'), bundle],
      { encoding: 'utf8', timeout: 15000, windowsHide: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('fixture links are forbidden');
    expect(readFileSync(join(target, 'app.asar'), 'utf8')).toBe('untouched');
  } finally {
    try { unlinkSync(join(bundle, 'resources')); } catch { /* absent link */ }
    rmSync(output, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test.skipIf(process.platform !== 'win32')('rejects a dependency whose content does not match its manifest hash', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-package-guard-'));
  const output = mkdtempSync(join(tmpdir(), 'sa-package-output-'));
  try {
    const source = fixtureSource(root);
    mkdirSync(join(source, 'apps/desktop/dist/main'), { recursive: true });
    mkdirSync(join(source, 'apps/desktop/packaging'), { recursive: true });
    mkdirSync(join(source, 'node_modules/zod'), { recursive: true });
    writeFileSync(join(source, 'apps/desktop/dist/main/main.js'), 'fixture');
    writeFileSync(join(source, 'node_modules/zod/index.js'), 'changed');
    writeFileSync(join(source, 'apps/desktop/packaging/runtime-manifest.json'), JSON.stringify({ version: 1, entries: [{ from: 'node_modules/zod/index.js', to: 'node_modules/zod/index.js', kind: 'dependency', sha256: '0'.repeat(64) }] }));
    const result = run(source, output);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('RUNTIME_DEPENDENCY_MISMATCH');
  } finally { rmSync(output, { recursive: true, force: true }); rmSync(root, { recursive: true, force: true }); }
});
