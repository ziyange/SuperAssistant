/* global process */
import { describe, expect, it } from 'vitest';
import { DshProcessHost } from '../src/dsh-process-host.js';

describe('DshProcessHost', () => {
  it('creates at most one owned process handle per Attempt', () => {
    const host = new DshProcessHost();
    expect(host.start('attempt-1', 'worktree-1').started).toBe(true);
    expect(host.start('attempt-1', 'worktree-1').started).toBe(false);
  });

  it('does not report cancellation before termination evidence', async () => {
    const host = new DshProcessHost();
    host.start('attempt-1', 'worktree-1');
    expect(await host.cancel('attempt-1', async () => false)).toEqual({ cancelled: false });
    expect(await host.cancel('attempt-1', async () => true)).toEqual({ cancelled: true });
  });

  it('owns and terminates a dedicated fixture process for an Attempt', async () => {
    const host = new DshProcessHost();
    expect(host.startProcess({ attemptId: 'attempt-2', worktree: process.cwd(), command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'] }).started).toBe(true);
    expect(await host.cancelProcess('attempt-2', 500)).toEqual({ cancelled: true, steps: ['TERMINATE'] });
  });
});
