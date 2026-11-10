/* global setTimeout, clearTimeout */
/* eslint-disable no-unused-vars -- names document the port contract. */
type LeaseIdentity = Readonly<{ leaseId: string; attemptId: string; fencingToken: number }>;
type LeasePort = Readonly<{
  canWrite: (identity: LeaseIdentity) => boolean;
  renew: (identity: LeaseIdentity) => boolean;
}>;
type SupervisorState = 'IDLE' | 'ACTIVE' | 'LOST' | 'STOPPED';

/** Isolated timing component; callers own worker proof and durable recovery. */
export class LeaseRenewalSupervisor {
  private readonly identity: LeaseIdentity;
  private state: SupervisorState = 'IDLE';
  private starting = false;
  private notificationFailed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(identity: LeaseIdentity, private readonly lease: LeasePort, private readonly ownerAlive: () => boolean, private readonly onLost: () => void | Promise<void>) {
    this.identity = Object.freeze({ ...identity });
  }

  snapshot(): Readonly<{ state: SupervisorState; notificationFailed: boolean }> {
    return { state: this.state, notificationFailed: this.notificationFailed };
  }

  start(): boolean {
    if (this.state !== 'IDLE' || this.starting) return false;
    this.starting = true;
    try {
      if (this.ownerAlive() !== true) { this.lost(); return false; }
      if (this.snapshot().state !== 'IDLE') return false;
      if (this.lease.canWrite(this.identity) !== true) { this.lost(); return false; }
      if (this.snapshot().state !== 'IDLE') return false;
    } catch { this.lost(); return false; }
    finally { this.starting = false; }
    this.state = 'ACTIVE';
    this.schedule();
    return true;
  }

  stop(): void {
    if (this.state === 'STOPPED' || this.state === 'LOST') return;
    this.state = 'STOPPED';
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.state !== 'ACTIVE') return;
      try {
        if (this.ownerAlive() !== true) { this.lost(); return; }
        if (this.snapshot().state !== 'ACTIVE') return;
        if (this.lease.renew(this.identity) !== true) { this.lost(); return; }
        if (this.snapshot().state !== 'ACTIVE') return;
      } catch { this.lost(); return; }
      this.schedule();
    }, 10_000);
  }

  private lost(): void {
    if (this.state === 'LOST' || this.state === 'STOPPED') return;
    this.state = 'LOST';
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    try {
      const result = this.onLost();
      if (result !== undefined) void Promise.resolve(result).catch(() => { this.notificationFailed = true; });
    } catch { this.notificationFailed = true; }
  }
}
