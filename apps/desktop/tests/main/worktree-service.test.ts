import { expect, test } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
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

test('preserves an untracked file created during a failed worktree setup', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-worktree-dirty-'));
  const repository = join(root, 'repo');
  const worktrees = join(root, 'worktrees');
  const created = join(worktrees, 'project-task-one');
  try {
    execFileSync('git', ['init', repository]);
    git(repository, 'config', 'user.email', 'test@example.invalid');
    git(repository, 'config', 'user.name', 'Test');
    writeFileSync(join(repository, 'source.txt'), 'original');
    git(repository, 'add', '.');
    git(repository, 'commit', '-m', 'baseline');
    git(repository, 'branch', 'codex/phase-001-task-one');
    const hook = join(repository, '.git', 'hooks', 'post-checkout');
    writeFileSync(hook, '#!/bin/sh\nprintf preserved > user-evidence.txt\n');
    chmodSync(hook, 0o755);
    expect(() => new GitWorktreeService().create({ projectId: 'project' as never, taskId: 'task-one' as never, projectPath: repository, worktreeRoot: worktrees })).toThrow();
    expect(existsSync(join(created, 'user-evidence.txt'))).toBe(true);
    expect(readFileSync(join(created, 'user-evidence.txt'), 'utf8')).toBe('preserved');
    const canonical = (path: string) => {
      const resolved = realpathSync.native(path);
      return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    const registered = git(repository, 'worktree', 'list', '--porcelain').split('\n')
      .filter((line) => line.startsWith('worktree ')).map((line) => canonical(line.slice('worktree '.length)));
    expect(registered).toContain(canonical(created));
    expect(registered).not.toContain(canonical(root));
    expect(readFileSync(join(repository, 'source.txt'), 'utf8')).toBe('original');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

test('cleans a newly created worktree on branch conflict when it is clean', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-worktree-clean-'));
  const repository = join(root, 'repo');
  const worktrees = join(root, 'worktrees');
  const created = join(worktrees, 'project-task-one');
  try {
    execFileSync('git', ['init', repository]);
    git(repository, 'config', 'user.email', 'test@example.invalid');
    git(repository, 'config', 'user.name', 'Test');
    writeFileSync(join(repository, 'source.txt'), 'original');
    git(repository, 'add', '.');
    git(repository, 'commit', '-m', 'baseline');
    git(repository, 'branch', 'codex/phase-001-task-one');
    expect(() => new GitWorktreeService().create({ projectId: 'project' as never, taskId: 'task-one' as never, projectPath: repository, worktreeRoot: worktrees })).toThrow();
    expect(existsSync(created)).toBe(false);
    expect(readFileSync(join(repository, 'source.txt'), 'utf8')).toBe('original');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
