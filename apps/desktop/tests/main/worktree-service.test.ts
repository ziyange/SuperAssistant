import { expect, test } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GitWorktreeService } from '../../src/main/worktree-service.js';

function git(path: string, ...args: string[]) { return execFileSync('git', ['-C', path, ...args], { encoding: 'utf8' }).trim(); }
test('creates distinct isolated task worktrees without changing the original', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-worktree-')); const repository = join(root, 'repo'); const worktrees = join(root, 'worktrees');
  try {
    execFileSync('git', ['init', repository]); git(repository, 'config', 'user.email', 'test@example.invalid'); git(repository, 'config', 'user.name', 'Test'); writeFileSync(join(repository, 'source.txt'), 'original'); git(repository, 'add', '.'); git(repository, 'commit', '-m', 'baseline'); const before = git(repository, 'status', '--porcelain') + readFileSync(join(repository, 'source.txt'), 'utf8');
    const service = new GitWorktreeService(); const one = service.create({ projectId: 'project' as never, taskId: 'task-one' as never, projectPath: repository, worktreeRoot: worktrees }); const two = service.create({ projectId: 'project' as never, taskId: 'task-two' as never, projectPath: repository, worktreeRoot: worktrees });
    expect(one.path).not.toBe(two.path); expect(one.branch).not.toBe(two.branch); expect(git(repository, 'status', '--porcelain') + readFileSync(join(repository, 'source.txt'), 'utf8')).toBe(before);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 15_000);
