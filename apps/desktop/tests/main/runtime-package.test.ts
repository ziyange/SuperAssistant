/* global process */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

test('runtime workspace packages expose emitted ESM artifacts', () => {
  expect(existsSync(resolve(repositoryRoot, 'packages/domain/dist/index.js'))).toBe(true);
  expect(existsSync(resolve(repositoryRoot, 'packages/persistence/dist/index.js'))).toBe(true);
  expect(existsSync(resolve(repositoryRoot, 'apps/desktop/dist/main/main.js'))).toBe(true);
  const preload = resolve(repositoryRoot, 'apps/desktop/dist/preload/index.cjs');
  expect(existsSync(preload)).toBe(true);
  execFileSync(process.execPath, ['--check', preload], { cwd: repositoryRoot });
  const source = readFileSync(preload, 'utf8');
  const externalRequires = [...source.matchAll(/\brequire\(["']([^"']+)["']\)/g)].map(match => match[1]);
  expect(externalRequires).toEqual(['electron']);
  expect(source).not.toMatch(/^\s*(?:import|export)\s/m);
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', "import('@super-assistant/persistence').then((module) => console.log(typeof module.createFoundationDatabase))"], { cwd: repositoryRoot, encoding: 'utf8' });
  expect(output.trim()).toBe('function');
});

test('Codex Adapter package resolves its built supervisor through Node ESM', () => {
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', "import('@super-assistant/codex-adapter').then((module) => console.log(typeof module.createAppServerDiscoverySupervisor))"], { cwd: repositoryRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  expect(output.trim()).toBe('function');
});
