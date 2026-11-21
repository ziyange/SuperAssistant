/* global process */
import { ChildProcess, spawn } from 'node:child_process';
import { once } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
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
      expect(result.cancelled).toBe(true);
      expect([['TERMINATE'], ['TERMINATE', 'KILL']]).toContainEqual(result.steps);
      expect(() => process.kill(pid, 0)).toThrow(expect.objectContaining({ code: 'ESRCH' }));
    } finally { if (fixture?.exitCode === null && fixture.signalCode === null) fixture.kill('SIGKILL'); }
  });

  it('does not report a failed spawn as termination', async () => {
    vi.useFakeTimers();
    try {
      const child = new ChildProcess();
      vi.spyOn(child, 'kill').mockReturnValue(false);
      const host = new DshProcessHost(() => child);
      host.startProcess({ attemptId: 'missing', worktree: '.', command: 'missing', args: [] });
      const cancellation = host.cancelProcess('missing', 500);
      // Node reports a negative exitCode and an error (no exit event) on ENOENT.
      Object.defineProperty(child, 'exitCode', { value: -4058 });
      child.emit('error', new Error('ENOENT'));
      await vi.advanceTimersByTimeAsync(1000);
      expect((await cancellation).cancelled).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it.each(['graceful', 'forced', 'unconfirmed'] as const)('retains ownership until actual exit: %s', async mode => {
    vi.useFakeTimers();
    try {
      const child = new ChildProcess();
      const signals: unknown[] = [];
      vi.spyOn(child, 'kill').mockImplementation(signal => {
        signals.push(signal);
        if ((mode === 'graceful' && signal === 'SIGTERM') || (mode === 'forced' && signal === 'SIGKILL')) child.emit('exit', null, signal);
        return true;
      });
      const host = new DshProcessHost(() => child);
      host.startProcess({ attemptId: 'a', worktree: '.', command: 'controlled', args: [] });
      expect(await host.cancel('a', async () => true)).toEqual({ cancelled: false });
      const pending = host.cancelProcess('a', 500);
      const duplicate = host.cancelProcess('a', 500);
      await vi.advanceTimersByTimeAsync(499);
      expect(signals).toEqual(['SIGTERM']);
      await vi.advanceTimersByTimeAsync(501);
      const expected = { cancelled: mode !== 'unconfirmed', steps: mode === 'graceful' ? ['TERMINATE'] : ['TERMINATE', 'KILL'] };
      expect(await pending).toEqual(expected);
      if (mode !== 'graceful') expect(await duplicate).toEqual(expected);
      expect(signals).toEqual(mode === 'graceful' ? ['SIGTERM'] : ['SIGTERM', 'SIGKILL']);
      expect(host.start('a', '.').started).toBe(mode !== 'unconfirmed');
      if (mode === 'unconfirmed') {
        child.emit('exit', null, 'SIGKILL');
        expect(host.start('a', '.').started).toBe(true);
      }
    } finally { vi.useRealTimers(); }
  });
});
