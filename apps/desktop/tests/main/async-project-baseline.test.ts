/* global setImmediate */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { readProjectHeadAsync } from '../../src/main/async-project-baseline.js';
import { projectGitEnvironment } from '../../src/main/project-git-baseline.js';

test('queries the exact Git baseline without blocking the caller event loop', async () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'sa-async-head-'));
  const project = join(root, 'project');
  try {
    execFileSync('git', ['init', '--quiet', project], { env: projectGitEnvironment() });
    execFileSync('git', ['-C', project, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'base'], { env: projectGitEnvironment() });
    const expected = execFileSync('git', ['-C', project, 'rev-parse', 'HEAD'], { encoding: 'utf8', env: projectGitEnvironment() }).trim();
    const pending = readProjectHeadAsync(realpathSync(project));
    let eventLoopRan = false;
    await new Promise<void>(resolve => setImmediate(() => { eventLoopRan = true; resolve(); }));
    expect(eventLoopRan).toBe(true);
    expect(await pending).toBe(expected);
    expect(await readProjectHeadAsync(root)).toBeNull();
    expect(await readProjectHeadAsync(join(root, 'missing'))).toBeNull();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30000);
