import { expect, test, vi } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { GitWorktreeService } from '../../src/main/worktree-service.js';

function git(path: string, ...args: string[]) { return execFileSync('git', ['-C', path, ...args], { encoding: 'utf8' }).trim(); }
test('creates distinct isolated task worktrees without changing the original', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-worktree-')); const repository = join(root, 'repo'); const worktrees = join(root, 'worktrees');
  try {
    execFileSync('git', ['init', '-q', '-b', 'main', repository]);
    // One real Git transaction seeds a tracked file and returns its commit.
    const baselineCommit = execFileSync('git', ['-C', repository, 'fast-import', '--quiet', '--done'], {
      encoding: 'utf8', input: ['commit refs/heads/main', 'mark :1', 'committer Test <test@example.invalid> 1000000000 +0000',
        'data 8', 'baseline', 'M 100644 inline source.txt', 'data 8', 'original', '', 'get-mark :1', 'done', ''].join('\n')
    }).trim();
    git(repository, 'read-tree', '-u', '--reset', 'HEAD');
    const before = git(repository, 'status', '--porcelain') + readFileSync(join(repository, 'source.txt'), 'utf8');
    const input = { projectId: 'project' as never, projectPath: repository, worktreeRoot: worktrees, baselineCommit };
    const service = new GitWorktreeService();
    vi.stubEnv('GIT_DIR', join(root, 'unrelated.git'));
    vi.stubEnv('GIT_WORK_TREE', root);
    const [one, two] = (() => {
      try {
        return [service.create({ ...input, taskId: 'task-one' as never }), service.create({ ...input, taskId: 'task-two' as never })] as const;
      } finally { vi.unstubAllEnvs(); }
    })();
    expect(one.baselineCommit).toBe(baselineCommit);
    expect(two.baselineCommit).toBe(baselineCommit);
    const records = git(repository, 'worktree', 'list', '--porcelain', '-z').split('\0\0').map(record => record.split('\0'));
    const original = records.find(([line]) => line?.startsWith('worktree ') && realpathSync.native(line.slice(9)) === realpathSync.native(repository));
    expect(original).toEqual(expect.arrayContaining(['HEAD ' + baselineCommit, 'branch refs/heads/main']));
    for (const checkout of [one, two]) {
      const entry = records.find(([line]) => line?.startsWith('worktree ') && realpathSync.native(line.slice(9)) === realpathSync.native(checkout.path));
      expect(entry).toContain('HEAD ' + baselineCommit);
      expect(entry).toContain('branch refs/heads/' + checkout.branch);
      expect(readFileSync(join(checkout.path, 'source.txt'), 'utf8')).toBe('original');
    }
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
    const input = { projectId: 'project' as never, taskId: 'task-one' as never, projectPath: repository, worktreeRoot: worktrees, baselineCommit: git(repository, 'rev-parse', 'HEAD') };
    expect(() => new GitWorktreeService().create(input)).toThrow();
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
    const input = { projectId: 'project' as never, taskId: 'task-one' as never, projectPath: repository, worktreeRoot: worktrees, baselineCommit: git(repository, 'rev-parse', 'HEAD') };
    expect(() => new GitWorktreeService().create(input)).toThrow();
    expect(existsSync(created)).toBe(false);
    expect(readFileSync(join(repository, 'source.txt'), 'utf8')).toBe('original');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

test('rejects a missing, abbreviated, or stale approved commit before creating any worktree', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-worktree-baseline-'));
  const repository = join(root, 'repo');
  const worktrees = join(root, 'worktrees');
  try {
    execFileSync('git', ['init', repository]);
    git(repository, 'config', 'user.email', 'fixture@example.invalid');
    git(repository, 'config', 'user.name', 'Fixture');
    git(repository, 'commit', '--allow-empty', '-m', 'approved');
    const approved = git(repository, 'rev-parse', 'HEAD');
    git(repository, 'commit', '--allow-empty', '-m', 'advanced');
    const registered = git(repository, 'worktree', 'list', '--porcelain');
    const branches = git(repository, 'branch', '--list');
    const service = new GitWorktreeService();
    for (const baselineCommit of [undefined as unknown as string, approved.slice(0, 12), approved]) {
      const input = { projectId: 'project' as never, taskId: 'task-one' as never, projectPath: repository, worktreeRoot: worktrees, baselineCommit };
      expect(() => service.create(input)).toThrow('WORKTREE_BASELINE_UNVERIFIED');
      expect(existsSync(worktrees)).toBe(false);
      expect(git(repository, 'worktree', 'list', '--porcelain')).toBe(registered);
      expect(git(repository, 'branch', '--list')).toBe(branches);
    }
  } finally { removeBaselineFixture(root); }
}, 30_000);

test('does not return an active worktree when the source HEAD advances during checkout', () => {
  const root = mkdtempSync(join(tmpdir(), 'sa-worktree-baseline-'));
  const repository = join(root, 'repo');
  const worktrees = join(root, 'worktrees');
  try {
    execFileSync('git', ['init', repository]);
    git(repository, 'config', 'user.email', 'fixture@example.invalid');
    git(repository, 'config', 'user.name', 'Fixture');
    git(repository, 'commit', '--allow-empty', '-m', 'approved');
    const baselineCommit = git(repository, 'rev-parse', 'HEAD');
    const advanced = git(repository, 'commit-tree', git(repository, 'rev-parse', 'HEAD^{tree}'), '-p', baselineCommit, '-m', 'advanced');
    const hook = join(repository, '.git', 'hooks', 'post-checkout');
    const source = repository.replaceAll('\\', '/').replaceAll("'", "'\\''");
    writeFileSync(hook, "#!/bin/sh\nunset GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE\n" +
      "git -C '" + source + "' update-ref HEAD " + advanced + "\n");
    chmodSync(hook, 0o755);
    const input = { projectId: 'project' as never, taskId: 'task-one' as never, projectPath: repository, worktreeRoot: worktrees, baselineCommit };
    expect(() => new GitWorktreeService().create(input)).toThrow('WORKTREE_BASELINE_UNVERIFIED');
    expect(git(repository, 'rev-parse', 'HEAD')).toBe(advanced);
    expect(existsSync(join(worktrees, 'project-task-one'))).toBe(false);
    expect(git(repository, 'branch', '--list', 'codex/phase-001-task-one')).toBe('');
  } finally { removeBaselineFixture(root); }
}, 30_000);

function removeBaselineFixture(root: string): void {
  const parent = realpathSync.native(tmpdir());
  const canonical = realpathSync.native(root);
  if (dirname(canonical) === parent && basename(canonical).startsWith('sa-worktree-baseline-')) rmSync(canonical, { recursive: true, force: true });
}
