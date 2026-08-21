/* global process */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

test('runtime workspace packages expose emitted ESM artifacts', () => {
  expect(existsSync(resolve(repositoryRoot, 'packages/domain/dist/index.js'))).toBe(true);
  expect(existsSync(resolve(repositoryRoot, 'packages/persistence/dist/index.js'))).toBe(true);
  expect(existsSync(resolve(repositoryRoot, 'apps/desktop/dist/main/main.js'))).toBe(true);
  expect(existsSync(resolve(repositoryRoot, 'apps/desktop/dist/preload/index.js'))).toBe(true);
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', "import('@super-assistant/persistence').then((module) => console.log(typeof module.createFoundationDatabase))"], { cwd: repositoryRoot, encoding: 'utf8' });
  expect(output.trim()).toBe('function');
});
