/* global process */
import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { ManagedWorktree, WorktreeService } from '@super-assistant/domain';

function git(path: string, args: string[]): string { return execFileSync('git', ['-C', path, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function safeTaskPart(value: string): string { if (!/^[a-z0-9-]+$/i.test(value)) throw new Error('Task identity is unsafe for a branch or path.'); return value.toLowerCase(); }

export class GitWorktreeService implements WorktreeService {
  create(input: { projectId: ManagedWorktree['projectId']; taskId: ManagedWorktree['taskId']; projectPath: string; worktreeRoot: string }): ManagedWorktree {
    const source = realpathSync(input.projectPath); const root = resolve(input.worktreeRoot); if (!existsSync(source) || resolve(source) === resolve(process.cwd()) || !git(source, ['rev-parse', '--is-inside-work-tree']).includes('true')) throw new Error('Project path is not an accessible Git repository.');
    mkdirSync(root, { recursive: true }); const task = safeTaskPart(input.taskId); const project = safeTaskPart(input.projectId); const path = join(root, `${project}-${task}`); if (resolve(path).slice(0, root.length) !== root || existsSync(path)) throw new Error('Requested worktree path is unsafe or already exists.');
    const baselineCommit = git(source, ['rev-parse', 'HEAD']); const branch = `codex/phase-001-${task}`;
    try { execFileSync('git', ['-C', source, 'worktree', 'add', '--detach', path, baselineCommit], { stdio: 'pipe' }); execFileSync('git', ['-C', path, 'switch', '-c', branch], { stdio: 'pipe' }); }
    catch (error) { if (existsSync(path)) { try { execFileSync('git', ['-C', source, 'worktree', 'remove', path], { stdio: 'pipe' }); } catch { /* preserve dirty or ambiguous evidence */ } } throw error; }
    return { projectId: input.projectId, taskId: input.taskId, path, branch, baselineCommit, resourceKey: `project:${input.projectId}`, disposition: 'ACTIVE' };
  }
  reconcile(path: string): 'QUARANTINED' | 'UNKNOWN' { return existsSync(path) ? 'QUARANTINED' : 'UNKNOWN'; }
}
