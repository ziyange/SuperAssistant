/* global process, URL */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const compiler = resolve(root, 'node_modules/typescript/bin/tsc');

test.each(['codex-adapter', 'dsh-adapter'])('%s TypeScript project includes actual source and tests', (name) => {
  const output = execFileSync(process.execPath, [compiler, '--listFilesOnly', '-p', `packages/${name}/tsconfig.json`], { cwd: root, encoding: 'utf8' }).replaceAll('\\', '/');
  expect(output).toContain(`/packages/${name}/src/index.ts`);
  expect(output).toContain(`/packages/${name}/tests/`);
}, 30_000);
