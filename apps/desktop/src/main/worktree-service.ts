import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import type { CreateTaskWorktree, ManagedWorktree, WorktreeService } from '@super-assistant/domain';
import { isFullGitCommit, projectGitEnvironment, readProjectHead } from './project-git-baseline.js';

function git(path: string, args: readonly string[]): void {
  execFileSync('git', ['--no-replace-objects', '--no-lazy-fetch', '-C', path, ...args], {
    env: projectGitEnvironment(), timeout: 15_000, maxBuffer: 64_000, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
}
function safeTaskPart(value: string): string { if (!/^[a-z0-9-]+$/i.test(value)) throw new Error('Task identity is unsafe for a branch or path.'); return value.toLowerCase(); }

export class GitWorktreeService implements WorktreeService {
  create(input: CreateTaskWorktree): ManagedWorktree {
    const { baselineCommit } = input;
    if (typeof baselineCommit !== 'string' || !isFullGitCommit(baselineCommit) || readProjectHead(input.projectPath) !== baselineCommit) {
      throw new Error('WORKTREE_BASELINE_UNVERIFIED');
    }
    const source = realpathSync.native(input.projectPath);
    if (source === realpathSync.native(process.cwd())) throw new Error('Project path is not an accessible Git repository.');
    const task = safeTaskPart(input.taskId);
    const project = safeTaskPart(input.projectId);
    const root = resolve(input.worktreeRoot);
    const path = join(root, `${project}-${task}`);
    if (existsSync(path)) throw new Error('Requested worktree path already exists.');
    const branch = `codex/phase-001-${task}`;
    const verify = (checkout: string) => {
      if (readProjectHead(input.projectPath) !== baselineCommit || readProjectHead(checkout) !== baselineCommit) throw new Error('WORKTREE_BASELINE_UNVERIFIED');
    };
    mkdirSync(root, { recursive: true });
    let created = false;
    try {
      git(source, ['worktree', 'add', '--detach', '--', path, baselineCommit]);
      created = true;
      verify(path);
      git(path, ['switch', '-c', branch]);
      verify(path);
    } catch (error) {
      if (created && existsSync(path)) {
        try { git(source, ['worktree', 'remove', '--', path]); } catch { /* Preserve dirty or ambiguous evidence. */ }
      }
      throw error;
    }
    return { projectId: input.projectId, taskId: input.taskId, path, branch, baselineCommit, resourceKey: `project:${input.projectId}`, disposition: 'ACTIVE' };
  }
  reconcile(path: string): 'QUARANTINED' | 'UNKNOWN' { return existsSync(path) ? 'QUARANTINED' : 'UNKNOWN'; }
}
