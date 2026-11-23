/* global process */
import { ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { DshProcessHost } from '../src/dsh-process-host.js';

describe('DshProcessHost', () => {
  it('does not accept a fabricated termination callback as proof', async () => {
    const host = new DshProcessHost();
    expect(host.start('forged', '.').started).toBe(true);
    let calls = 0;
    expect(await host.cancel('forged', async () => { calls += 1; return true; })).toEqual({ cancelled: false });
    expect(calls).toBe(0);
    expect(host.start('forged', '.').started).toBe(false);
  });

  it('does not reuse an Attempt after the root process emits exit', () => {
    const child = new ChildProcess();
    const host = new DshProcessHost(() => child);
    expect(host.startProcess({ attemptId: 'original', worktree: '.', command: 'fixture', args: [] }).started).toBe(true);
    child.emit('exit', 0, null);
    expect(host.start('original', '.').started).toBe(false);
  });

  it('does not signal a root process without whole-tree ownership proof', async () => {
    const child = new ChildProcess();
    const kill = vi.spyOn(child, 'kill').mockImplementation(signal => { child.emit('exit', null, signal); return true; });
    const host = new DshProcessHost(() => child);
    host.startProcess({ attemptId: 'a', worktree: '.', command: 'fixture', args: [] });
    expect(await host.cancelProcess('a', 20)).toEqual({ cancelled: false, steps: [] });
    expect(kill).not.toHaveBeenCalled();
  });

  it('creates at most one owned process handle per Attempt', () => {
    const host = new DshProcessHost();
    expect(host.start('attempt-1', 'worktree-1').started).toBe(true);
    expect(host.start('attempt-1', 'worktree-1').started).toBe(false);
  });

  it('does not report cancellation from an injected callback', async () => {
    const host = new DshProcessHost();
    host.start('attempt-1', 'worktree-1');
    expect(await host.cancel('attempt-1', async () => false)).toEqual({ cancelled: false });
    expect(await host.cancel('attempt-1', async () => true)).toEqual({ cancelled: false });
    expect(host.start('attempt-1', '.').started).toBe(false);
  });

  it('does not signal a dedicated fixture process without whole-tree proof', async () => {
    let fixture: ChildProcess | undefined;
    let ready: Promise<unknown[]> | undefined;
    const host = new DshProcessHost((command, args, options) => {
      fixture = spawn(command, args, { ...options, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
      ready = once(fixture, 'message', { signal: globalThis.AbortSignal.timeout(4000) });
      return fixture;
    });
    try {
      expect(host.startProcess({ attemptId: 'attempt-2', worktree: process.cwd(), command: process.execPath,
        args: ['-e', "process.send('ready'); setInterval(() => {}, 1000)"] }).started).toBe(true);
      expect(await ready).toEqual(['ready', undefined]);
      const pid = fixture?.pid;
      if (!pid) throw new Error('Missing owned fixture');
      const result = await host.cancelProcess('attempt-2', 500);
      expect(result).toEqual({ cancelled: false, steps: [] });
      expect(() => process.kill(pid, 0)).not.toThrow();
    } finally {
      if (fixture?.exitCode === null && fixture.signalCode === null) {
        const exited = once(fixture, 'exit');
        fixture.kill('SIGKILL');
        await exited;
      }
    }
  });

  it('does not report a failed spawn as termination', async () => {
    const child = new ChildProcess();
    const kill = vi.spyOn(child, 'kill').mockReturnValue(false);
    const host = new DshProcessHost(() => child);
    host.startProcess({ attemptId: 'missing', worktree: '.', command: 'missing', args: [] });
    child.emit('error', new Error('ENOENT'));
    expect(await host.cancelProcess('missing', 500)).toEqual({ cancelled: false, steps: [] });
    expect(host.start('missing', '.').started).toBe(false);
    expect(kill).not.toHaveBeenCalled();
  });

  it('retains an Attempt tombstone even when spawning throws synchronously', () => {
    const host = new DshProcessHost(() => { throw new Error('spawn failed'); });
    expect(host.startProcess({ attemptId: 'a', worktree: '.', command: 'controlled', args: [] })).toEqual({ started: false });
    expect(host.start('a', '.').started).toBe(false);
  });
});
