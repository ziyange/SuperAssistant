import { createHash } from 'node:crypto';
import { constants, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function fail(code) { throw new Error(code); }
function samePath(a, b) { return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b; }
function inside(parent, child) {
  const part = relative(parent, child);
  return part === '' || (!part.startsWith('..' + sep) && part !== '..' && !isAbsolute(part));
}
function existingDirectory(path, error) {
  try {
    const info = lstatSync(path);
    if (!info.isDirectory() || info.isSymbolicLink() || !samePath(realpathSync.native(path), path)) fail(error);
  } catch { fail(error); }
}

function safeFile(path) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || !samePath(realpathSync.native(path), path)) fail('UNSAFE_RUNTIME_INPUT');
}
function copyFile(source, destination) {
  safeFile(source);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination, constants.COPYFILE_EXCL);
}
function writeNew(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, { flag: 'wx' });
}

const bootstrap = `import { app } from 'electron';
import { basename, dirname, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { realpathSync, readdirSync } from 'node:fs';
const profile = process.env.SA_PACKAGE_FIXTURE_PROFILE;
const equal = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
try {
  if (!profile || !isAbsolute(profile) || !/^sa-package-profile-[a-z0-9]+$/i.test(basename(profile)) ||
      !equal(realpathSync.native(profile), profile) || !equal(dirname(profile), realpathSync.native(tmpdir())) || readdirSync(profile).length) throw new Error('profile');
  app.setPath('userData', profile);
  app.once('browser-window-created', (_event, window) => window.webContents.once('did-finish-load', () => { console.log('SA_PACKAGE_FIXTURE_READY'); app.quit(); }));
  await import('./dist/main/main.js');
} catch { app.exit(1); }
`;

function stageInputs(source, stage) {
  const manifestPath = join(source, 'apps', 'desktop', 'packaging', 'runtime-manifest.json');
  safeFile(manifestPath);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.entries) || manifest.entries.length < 1 || manifest.entries.length > 1000) fail('INVALID_RUNTIME_MANIFEST');
  const seenFrom = new Set(), seenTo = new Set();
  for (const entry of manifest.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)
      || typeof entry.from !== 'string' || typeof entry.to !== 'string'
      || !/^[a-z0-9@._/-]+$/i.test(entry.from) || !/^[a-z0-9@._/-]+$/i.test(entry.to)
      || entry.from.split('/').some(part => !part || part === '.' || part === '..')
      || entry.to.split('/').some(part => !part || part === '.' || part === '..')) fail('INVALID_RUNTIME_MANIFEST');
    let target;
    if (/^apps\/desktop\/dist\/(?:main|preload|renderer)\/[a-zA-Z0-9@._/-]+$/.test(entry.from)) target = entry.from.slice('apps/desktop/'.length);
    else if (['apps/desktop/dist/native/wincred_native.node', 'apps/desktop/dist/native/process_owner.node'].includes(entry.from)) target = entry.from.slice('apps/desktop/'.length);
    else if (/^packages\/(?:domain|persistence|codex-adapter)\/dist\/[a-zA-Z0-9@._/-]+$/.test(entry.from)) target = entry.from.replace(/^packages\/([^/]+)\/dist\//, 'node_modules/@super-assistant/$1/dist/');
    else if (/^node_modules\/zod\/[a-zA-Z0-9@._/-]+$/.test(entry.from) || /^node_modules\/better-sqlite3\/(?:lib\/[a-zA-Z0-9@._/-]+|package\.json|prebuilds\/win32-x64\.node)$/.test(entry.from)) target = entry.from;
    else fail('INVALID_RUNTIME_MANIFEST');
    const dependency = entry.from.startsWith('node_modules/');
    if (target !== entry.to || seenFrom.has(entry.from.toLowerCase()) || seenTo.has(entry.to.toLowerCase())
      || entry.kind !== (dependency ? 'dependency' : 'build')
      || (dependency ? !/^[a-f0-9]{64}$/.test(entry.sha256) : 'sha256' in entry)
      || !['.js', '.cjs', '.mjs', '.json', '.html', '.css', '.node', '.sql'].includes(extname(entry.from).toLowerCase())) fail('INVALID_RUNTIME_MANIFEST');
    seenFrom.add(entry.from.toLowerCase()); seenTo.add(entry.to.toLowerCase());
    const from = resolve(source, ...entry.from.split('/')), to = resolve(stage, ...entry.to.split('/'));
    if (!inside(source, from) || !inside(stage, to)) fail('INVALID_RUNTIME_MANIFEST');
    safeFile(from);
    if (lstatSync(from).size > 100 * 1024 * 1024) fail('UNSAFE_RUNTIME_INPUT');
    if (dependency && createHash('sha256').update(readFileSync(from)).digest('hex') !== entry.sha256) fail('RUNTIME_DEPENDENCY_MISMATCH');
    copyFile(from, to);
  }
  for (const required of ['apps/desktop/dist/main/main.js', 'apps/desktop/dist/preload/index.cjs', 'apps/desktop/dist/renderer/index.html', 'apps/desktop/dist/native/wincred_native.node', 'apps/desktop/dist/native/process_owner.node', 'node_modules/better-sqlite3/prebuilds/win32-x64.node']) {
    if (!seenFrom.has(required.toLowerCase())) fail('MISSING_RUNTIME_INPUT');
  }
  for (const name of ['domain', 'persistence', 'codex-adapter']) {
    const target = join(stage, 'node_modules', '@super-assistant', name);
    if (!seenTo.has(('node_modules/@super-assistant/' + name + '/dist/index.js').toLowerCase())) fail('MISSING_RUNTIME_INPUT');
    writeNew(join(target, 'package.json'), JSON.stringify({ name: '@super-assistant/' + name, version: '0.1.0', type: 'module', exports: { '.': './dist/index.js' } }));
  }
  writeNew(join(stage, 'package.json'), JSON.stringify({ name: 'super-assistant-package-fixture', version: '0.1.0', private: true, type: 'module', main: 'bootstrap.mjs' }));
  writeNew(join(stage, 'bootstrap.mjs'), bootstrap);
}

function electronVersion(source) {
  const packagePath = join(source, 'package.json');
  safeFile(packagePath);
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
  const version = manifest?.devDependencies?.electron;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) fail('ELECTRON_VERSION_MISMATCH');
  return version;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--source' || args[2] !== '--output'
      || !isAbsolute(args[1]) || !isAbsolute(args[3])) fail('INVALID_ARGUMENTS');
  const source = resolve(args[1]), output = resolve(args[3]);
  existingDirectory(output, 'UNSAFE_OUTPUT_PATH');
  const tempParent = realpathSync.native(tmpdir());
  if (!samePath(dirname(output), tempParent) || !/^sa-package-output-[a-z0-9]+$/i.test(basename(output))) fail('UNSAFE_OUTPUT_PATH');
  if (readdirSync(output).length !== 0) fail('OUTPUT_NOT_EMPTY');
  existingDirectory(source, 'UNSAFE_SOURCE_PATH');
  if (!samePath(source, resolve(dirname(fileURLToPath(import.meta.url)), '../../..'))) fail('UNSAFE_SOURCE_PATH');
  if (inside(source, output) || inside(output, source)) fail('UNSAFE_OUTPUT_PATH');
  try {
    const mainFile = resolve(source, 'apps/desktop/dist/main/main.js');
    if (!lstatSync(mainFile).isFile() || !samePath(realpathSync.native(mainFile), mainFile)) fail('MISSING_RUNTIME_INPUT');
  } catch { fail('MISSING_RUNTIME_INPUT'); }
  if (process.platform !== 'win32' || process.arch !== 'x64') fail('UNSUPPORTED_PLATFORM');
  const temporary = mkdtempSync(join(tempParent, 'sa-package-stage-'));
  try {
    const stage = join(temporary, 'app');
    mkdirSync(stage);
    stageInputs(source, stage);
    const version = electronVersion(source);
    const { packager } = await import('@electron/packager');
    const { flipFuses, getCurrentFuseWire, FuseVersion, FuseV1Options, FuseState } = await import('@electron/fuses');
    existingDirectory(output, 'UNSAFE_OUTPUT_PATH');
    if (readdirSync(output).length !== 0) fail('OUTPUT_NOT_EMPTY');
    const paths = await packager({ dir: stage, out: output, name: 'SuperAssistant-Test', platform: 'win32', arch: 'x64',
      electronVersion: version, asar: { unpack: '**/*.node' }, prune: false, overwrite: false, quiet: true, tmpdir: temporary,
      download: { cacheRoot: join(temporary, 'electron-cache'), tempDirectory: temporary, mirrorOptions: { resolveAssetURL: details => {
        if (details.version !== 'v' + version) fail('ELECTRON_VERSION_MISMATCH');
        const name = details.isGeneric && details.artifactName === 'SHASUMS256.txt' ? 'SHASUMS256.txt'
          : details.artifactName === 'electron' && details.platform === 'win32' && details.arch === 'x64' ? `electron-v${version}-win32-x64.zip` : '';
        if (!name) fail('UNEXPECTED_ELECTRON_DOWNLOAD');
        return `https://github.com/electron/electron/releases/download/v${version}/${name}`;
      } } } });
    if (paths.length !== 1 || !inside(output, paths[0]) || samePath(output, paths[0])) fail('UNSAFE_PACKAGE_RESULT');
    const executable = join(paths[0], 'SuperAssistant-Test.exe');
    safeFile(executable);
    await flipFuses(executable, { version: FuseVersion.V1, [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false, [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true, [FuseV1Options.OnlyLoadAppFromAsar]: true });
    const wire = await getCurrentFuseWire(executable);
    if (wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation] !== FuseState.ENABLE
      || wire[FuseV1Options.OnlyLoadAppFromAsar] !== FuseState.ENABLE
      || wire[FuseV1Options.RunAsNode] !== FuseState.DISABLE) fail('FUSE_VERIFICATION_FAILED');
    process.stdout.write('UNSIGNED_TEST_BUNDLE=' + paths[0] + '\n');
  } finally {
    if (samePath(dirname(temporary), tempParent) && basename(temporary).startsWith('sa-package-stage-')) rmSync(temporary, { recursive: true, force: true });
  }
}

main().catch(error => { process.stderr.write(String(error?.message ?? 'PACKAGING_FAILED') + '\n'); process.exitCode = 1; });
