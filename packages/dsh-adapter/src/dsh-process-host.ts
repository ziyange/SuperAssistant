import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

type CancelResult = { cancelled: boolean; steps: string[] };
type Handle = { worktree: string; child?: ChildProcess; exited?: boolean; cancelling?: Promise<CancelResult> };
function spawnOwned(command: string, args: string[], options: SpawnOptions): ChildProcess {
  return spawn(command, args, options);
}

// A successfully sent signal is not exit evidence. Attach before signalling:
// retain only an actual exit event, not kill() success or a spawn error's errno.
function signalAndObserve(child: ChildProcess, signal: 'SIGTERM' | 'SIGKILL', ms: number, hasExited: () => boolean): Promise<boolean> {
  if (hasExited()) return Promise.resolve(true);
  return new Promise(resolve => {
    const finish = (observed: boolean) => {
      globalThis.clearTimeout(timer);
      child.off('exit', onExit);
      resolve(observed);
    };
    const onExit = () => finish(true);
    const timer = globalThis.setTimeout(() => finish(hasExited()), ms);
    child.once('exit', onExit);
    try { child.kill(signal); } catch { /* Still wait for actual exit until the deadline. */ }
  });
}

export class DshProcessHost {
  private readonly handles = new Map<string, Handle>();
  private readonly spawnOwned: typeof spawnOwned;
  constructor(spawner = spawnOwned) { this.spawnOwned = spawner; }

  start(attemptId: string, worktree: string): { started: boolean } {
    if (this.handles.has(attemptId)) return { started: false };
    this.handles.set(attemptId, { worktree });
    return { started: true };
  }
  startProcess(input: { attemptId: string; worktree: string; command: string; args: readonly string[] }): { started: boolean } {
    if (this.handles.has(input.attemptId)) return { started: false };
    const child = this.spawnOwned(input.command, [...input.args], { cwd: input.worktree, stdio: 'ignore', windowsHide: true });
    const handle: Handle = { worktree: input.worktree, child, exited: false };
    this.handles.set(input.attemptId, handle);
    const retire = () => { if (this.handles.get(input.attemptId) === handle) this.handles.delete(input.attemptId); };
    child.once('exit', () => { handle.exited = true; retire(); });
    child.on('error', () => { if (child.pid === undefined) retire(); });
    return { started: true };
  }
  async cancel(attemptId: string, terminate: () => Promise<boolean>): Promise<{ cancelled: boolean }> {
    const handle = this.handles.get(attemptId);
    if (!handle || handle.child || !(await terminate()) || this.handles.get(attemptId) !== handle) return { cancelled: false };
    this.handles.delete(attemptId);
    return { cancelled: true };
  }
  async cancelProcess(attemptId: string, timeoutMs: number): Promise<CancelResult> {
    const handle = this.handles.get(attemptId);
    const child = handle?.child;
    if (!handle || !child || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) return { cancelled: false, steps: [] };
    if (handle.cancelling) return handle.cancelling;
    handle.cancelling = (async () => {
      const steps = ['TERMINATE'];
      const hasExited = () => handle.exited === true;
      if (await signalAndObserve(child, 'SIGTERM', timeoutMs, hasExited)) return { cancelled: true, steps };
      if (this.handles.get(attemptId) !== handle) return { cancelled: false, steps };
      steps.push('KILL');
      return { cancelled: await signalAndObserve(child, 'SIGKILL', timeoutMs, hasExited), steps };
    })();
    try { return await handle.cancelling; } finally { delete handle.cancelling; }
  }
}
