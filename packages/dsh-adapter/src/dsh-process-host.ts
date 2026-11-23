import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

type CancelResult = { cancelled: boolean; steps: string[] };
type Handle = { worktree: string; child?: ChildProcess };
function spawnOwned(command: string, args: string[], options: SpawnOptions): ChildProcess {
  return spawn(command, args, options);
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
    const handle: Handle = { worktree: input.worktree };
    this.handles.set(input.attemptId, handle);
    let child: ChildProcess;
    try { child = this.spawnOwned(input.command, [...input.args], { cwd: input.worktree, stdio: 'ignore', windowsHide: true }); }
    catch { return { started: false }; }
    handle.child = child;
    const forgetChild = () => { if (this.handles.get(input.attemptId) === handle) delete handle.child; };
    child.once('exit', forgetChild);
    child.on('error', () => { if (child.pid === undefined) forgetChild(); });
    return { started: true };
  }
  async cancel(_attemptId: string, _terminate: () => Promise<boolean>): Promise<{ cancelled: boolean }> {
    void _attemptId; void _terminate;
    return { cancelled: false };
  }
  async cancelProcess(_attemptId: string, _timeoutMs: number): Promise<CancelResult> {
    // A root-only handle cannot attest the whole tree or justify signalling it.
    void _attemptId; void _timeoutMs;
    return { cancelled: false, steps: [] };
  }
}
