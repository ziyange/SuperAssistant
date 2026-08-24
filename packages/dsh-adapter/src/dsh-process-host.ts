import { spawn, type ChildProcess } from 'node:child_process';

export class DshProcessHost {
  private readonly handles = new Map<string, { worktree: string; child?: ChildProcess }>();
  start(attemptId: string, worktree: string): { started: boolean } {
    if (this.handles.has(attemptId)) return { started: false };
    this.handles.set(attemptId, { worktree });
    return { started: true };
  }
  startProcess(input: { attemptId: string; worktree: string; command: string; args: readonly string[] }): { started: boolean } {
    if (this.handles.has(input.attemptId)) return { started: false };
    const child = spawn(input.command, [...input.args], { cwd: input.worktree, stdio: 'ignore', windowsHide: true });
    this.handles.set(input.attemptId, { worktree: input.worktree, child });
    child.once('exit', () => this.handles.delete(input.attemptId));
    return { started: true };
  }
  async cancel(attemptId: string, terminate: () => Promise<boolean>): Promise<{ cancelled: boolean }> {
    if (!this.handles.has(attemptId)) return { cancelled: false };
    if (!(await terminate())) return { cancelled: false };
    this.handles.delete(attemptId);
    return { cancelled: true };
  }
  async cancelProcess(attemptId: string, timeoutMs: number): Promise<{ cancelled: boolean; steps: string[] }> {
    const handle = this.handles.get(attemptId);
    if (!handle?.child) return { cancelled: false, steps: [] };
    const child = handle.child;
    const wait = () => new Promise<boolean>((resolve) => {
      if (child.exitCode !== null) return resolve(true);
      const onExit = () => { globalThis.clearTimeout(timer); resolve(true); };
      const timer = globalThis.setTimeout(() => { child.off('exit', onExit); resolve(false); }, timeoutMs);
      child.once('exit', onExit);
    });
    const steps = ['TERMINATE'];
    child.kill('SIGTERM');
    let cancelled = await wait();
    if (!cancelled) {
      steps.push('KILL');
      child.kill('SIGKILL');
      cancelled = await wait();
    }
    if (cancelled) this.handles.delete(attemptId);
    return { cancelled, steps };
  }
}
