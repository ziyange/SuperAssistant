import { execFileSync } from 'node:child_process';
import { lstatSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, parse, resolve } from 'node:path';
import process from 'node:process';

export function isFullGitCommit(value: string): boolean {
  return (value.length === 40 || value.length === 64) && !/[^a-f0-9]/.test(value);
}

export function projectGitEnvironment() {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_ALLOW_PROTOCOL = '';
  return env;
}

function isAbsoluteProjectPath(path: string): boolean {
  return isAbsolute(path) && !Array.from(path).some(character => character.charCodeAt(0) < 32) && (process.platform !== 'win32' || /^[a-z]:[\\/]/i.test(path));
}

export function readProjectHead(path: string): string | null {
  try {
    if (!isAbsoluteProjectPath(path)) return null;
    const canonical = realpathSync(path);
    if (!isAbsoluteProjectPath(canonical) || resolve(path) !== canonical || canonical === parse(canonical).root || !statSync(canonical).isDirectory()) return null;
    const metadata = lstatSync(join(canonical, '.git'));
    if (!metadata.isDirectory() && !metadata.isFile()) return null;
    const output = execFileSync('git', [
      '--no-optional-locks', '--no-replace-objects', '--no-lazy-fetch',
      '-C', canonical, 'rev-parse', '--path-format=absolute', '--show-toplevel', '--verify', 'HEAD^{commit}'
    ], { encoding: 'utf8', env: projectGitEnvironment(), timeout: 4000, maxBuffer: 16_384, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'ignore'] });
    const [root, commit, ...extra] = output.replace(/\r?\n$/, '').split(/\r?\n/);
    if (!root || !commit || extra.length || !isAbsoluteProjectPath(root) || !isFullGitCommit(commit)) return null;
    if (realpathSync.native(root) !== realpathSync.native(canonical)) return null;
    return commit;
  } catch {
    return null;
  }
}
