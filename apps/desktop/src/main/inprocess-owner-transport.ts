/* eslint-disable no-unused-vars -- Native port parameters describe the main-process boundary. */
import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';

type NativeOwner = {
  write(bytes: Buffer): Promise<void>;
  read(): Promise<Buffer | null>;
  stop(): Promise<string>;
};

/** Job observations are not trusted installation or confinement attestation. */
export class InProcessOwnerTransport extends EventEmitter {
  readonly stdin: Writable;
  readonly stdout = new PassThrough({ highWaterMark: 1048576 });
  private closed = false;
  private stopping: Promise<'TERMINATED_UNVERIFIED' | 'UNKNOWN'> | undefined;

  constructor(private readonly owner: NativeOwner) {
    super();
    if (!owner || typeof owner.write !== 'function' || typeof owner.read !== 'function'
        || typeof owner.stop !== 'function') throw new Error('Owned transport unavailable');
    this.stdin = new Writable({
      highWaterMark: 1048576,
      write: (chunk: Buffer, _encoding, callback) => {
        if (this.closed || !Buffer.isBuffer(chunk) || chunk.length < 1 || chunk.length > 1048576) {
          callback(new Error('Owned transport unavailable')); return;
        }
        void Promise.resolve().then(() => owner.write(chunk)).then(() => callback(), () => callback(new Error('Owned transport unavailable')));
      }
    });
    this.stdin.on('error', () => this.fail());
    this.stdout.on('error', () => this.fail());
    this.stdin.once('close', () => { if (!this.closed && !this.stopping) this.fail(); });
    this.stdout.once('close', () => { if (!this.closed && !this.stopping) this.fail(); });
    void Promise.resolve().then(() => this.pump());
  }

  private async pump(): Promise<void> {
    try {
      while (!this.closed && !this.stopping) {
        const chunk = await this.owner.read();
        if (this.closed || this.stopping) return;
        if (chunk === null || !Buffer.isBuffer(chunk) || chunk.length > 12288) throw new Error('unavailable');
        if (chunk.length === 0) continue;
        if (!this.stdout.write(chunk)) {
          await new Promise<void>((resolve, reject) => {
            const cleanup = () => { this.stdout.off('drain', onDrain); this.stdout.off('close', onClose); };
            const onDrain = () => { cleanup(); resolve(); };
            const onClose = () => { cleanup(); reject(new Error('unavailable')); };
            this.stdout.once('drain', onDrain);
            this.stdout.once('close', onClose);
          });
        }
      }
    } catch { this.fail(); }
  }

  private finish(): void {
    if (this.closed) return;
    this.closed = true;
    this.stdin.destroy();
    this.stdout.destroy();
    this.emit('exit', null, null);
  }

  private fail(): void {
    this.finish();
    void this.stop();
  }

  onProtocolFailure(): void {
    void this.stop();
  }

  stop(): Promise<'TERMINATED_UNVERIFIED' | 'UNKNOWN'> {
    if (this.stopping) return this.stopping;
    this.stopping = Promise.resolve().then(() => this.owner.stop()).then(
      result => result === 'TERMINATED' ? 'TERMINATED_UNVERIFIED' as const : 'UNKNOWN' as const,
      () => 'UNKNOWN' as const
    ).finally(() => this.finish());
    return this.stopping;
  }
}
