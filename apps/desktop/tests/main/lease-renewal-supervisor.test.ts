import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createFoundationDatabase, SqliteResourceLeaseRepository } from '../../../../packages/persistence/src/index.js';

const identity = { leaseId: 'lease-1', attemptId: 'attempt-1', fencingToken: 1 };
const start = '2026-08-13T00:00:00.000Z';
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(start)); });
afterEach(() => { vi.useRealTimers(); });

async function supervisorClass() {
  const module = await import('../../src/main/lease-renewal-supervisor.js').catch(() => null);
  expect(module?.LeaseRenewalSupervisor).toBeTypeOf('function');
  if (!module) throw new Error('Supervisor is unavailable.');
  return module.LeaseRenewalSupervisor;
}

function fixture() {
  const db = createFoundationDatabase(':memory:');
  db.pragma('foreign_keys = OFF');
  db.prepare("INSERT INTO execution_attempts VALUES ('attempt-1', 'work-1', 'request-1', 'key-1', 'RUNNING', 0, ?)").run(start);
  db.pragma('foreign_keys = ON');
  const lease = new SqliteResourceLeaseRepository(db);
  lease.acquire({ ...identity, resourceKey: 'project:p', createdAt: start });
  return { db, lease };
}

test('renews the real SQLite lease every ten seconds and stop does not release it', async () => {
  const Supervisor = await supervisorClass();
  const { db, lease } = fixture();
  try {
    const losses: string[] = [];
    const supervisor = new Supervisor(identity, lease, () => true, () => { losses.push('lost'); });
    expect(supervisor.start()).toBe(true);
    expect(supervisor.start()).toBe(false);
    vi.advanceTimersByTime(20_000);
    expect(db.prepare("SELECT renewed_at, expires_at, state FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ renewed_at: '2026-08-13T00:00:20.000Z', expires_at: '2026-08-13T00:00:50.000Z', state: 'ACTIVE' });
    supervisor.stop(); supervisor.stop();
    vi.advanceTimersByTime(30_000);
    expect(supervisor.snapshot()).toEqual({ state: 'STOPPED', notificationFailed: false });
    expect(db.prepare("SELECT renewed_at, state FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ renewed_at: '2026-08-13T00:00:20.000Z', state: 'ACTIVE' });
    expect(losses).toEqual([]);
    expect(supervisor.start()).toBe(false);
  } finally { db.close(); }
});

test('a stalled timer detects expiration without reassigning the lease', async () => {
  const Supervisor = await supervisorClass();
  const { db, lease } = fixture();
  try {
    const losses: string[] = [];
    const supervisor = new Supervisor(identity, lease, () => true, () => { losses.push('lost'); });
    expect(supervisor.start()).toBe(true);
    vi.setSystemTime(new Date('2026-08-13T00:00:31.000Z'));
    vi.advanceTimersByTime(10_000);
    expect(supervisor.snapshot()).toEqual({ state: 'LOST', notificationFailed: false });
    expect(losses).toEqual(['lost']);
    vi.advanceTimersByTime(60_000);
    expect(losses).toEqual(['lost']);
    expect(db.prepare("SELECT state FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ state: 'ACTIVE' });
    expect(supervisor.start()).toBe(false);
  } finally { db.close(); }
});

test('lost ownership stops renewal once and preserves the lease', async () => {
  const Supervisor = await supervisorClass();
  const { db, lease } = fixture();
  try {
    let alive = true;
    let losses = 0;
    const supervisor = new Supervisor(identity, lease, () => alive, () => { losses++; });
    expect(supervisor.start()).toBe(true);
    alive = false;
    vi.advanceTimersByTime(10_000);
    expect(supervisor.snapshot()).toEqual({ state: 'LOST', notificationFailed: false });
    expect(losses).toBe(1);
    expect(db.prepare("SELECT renewed_at, state FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ renewed_at: start, state: 'ACTIVE' });
    vi.advanceTimersByTime(30_000);
    expect(losses).toBe(1);
  } finally { db.close(); }
});

test('check errors fail closed and a loss-notification error is observable', async () => {
  const Supervisor = await supervisorClass();
  const { db, lease } = fixture();
  try {
    const supervisor = new Supervisor(identity, lease, () => { throw new Error('unknown owner'); }, () => { throw new Error('notification failed'); });
    expect(supervisor.start()).toBe(false);
    expect(supervisor.snapshot()).toEqual({ state: 'LOST', notificationFailed: true });
    expect(db.prepare("SELECT state FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ state: 'ACTIVE' });
    expect(supervisor.start()).toBe(false);
  } finally { db.close(); }
});

test('stopping during an ownership callback prevents a later renewal', async () => {
  const Supervisor = await supervisorClass();
  const { db, lease } = fixture();
  try {
    let checks = 0;
    let supervisor: InstanceType<typeof Supervisor>;
    supervisor = new Supervisor(identity, lease, () => { checks++; if (checks === 2) supervisor.stop(); return true; }, () => {});
    expect(supervisor.start()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(supervisor.snapshot().state).toBe('STOPPED');
    expect(db.prepare("SELECT renewed_at FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ renewed_at: start });
    expect(vi.getTimerCount()).toBe(0);
  } finally { db.close(); }
});

test('stopping inside the initial ownership callback cannot be overwritten by start', async () => {
  const Supervisor = await supervisorClass();
  const { db, lease } = fixture();
  try {
    let supervisor: InstanceType<typeof Supervisor>;
    supervisor = new Supervisor(identity, lease, () => { supervisor.stop(); return true; }, () => {});
    expect(supervisor.start()).toBe(false);
    expect(supervisor.snapshot().state).toBe('STOPPED');
    expect(vi.getTimerCount()).toBe(0);
  } finally { db.close(); }
});

test.each(['false', 'throw'])('a renewal that returns %s stops and notifies once', async kind => {
  const Supervisor = await supervisorClass();
  const { db, lease } = fixture();
  try {
    let losses = 0;
    const port = {
      canWrite: (claim: typeof identity) => lease.canWrite(claim),
      renew: () => { if (kind === 'throw') throw new Error('database unavailable'); return false; }
    };
    const supervisor = new Supervisor(identity, port, () => true, () => { losses++; });
    expect(supervisor.start()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(supervisor.snapshot()).toEqual({ state: 'LOST', notificationFailed: false });
    expect(losses).toBe(1);
    expect(db.prepare("SELECT state FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ state: 'ACTIVE' });
    vi.advanceTimersByTime(30_000);
    expect(losses).toBe(1);
  } finally { db.close(); }
});

test('copies the lease identity before it can be changed by the caller', async () => {
  const Supervisor = await supervisorClass();
  const { db, lease } = fixture();
  try {
    const input = { ...identity };
    const supervisor = new Supervisor(input, lease, () => true, () => {});
    input.fencingToken = 99;
    expect(supervisor.start()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(db.prepare("SELECT renewed_at FROM resource_leases WHERE lease_id = 'lease-1'").get()).toEqual({ renewed_at: '2026-08-13T00:00:10.000Z' });
    supervisor.stop();
  } finally { db.close(); }
});

test('an asynchronous loss-notification rejection is recorded', async () => {
  const Supervisor = await supervisorClass();
  const { db, lease } = fixture();
  try {
    // eslint-disable-next-line no-unused-vars -- parameter names document the callback signature.
    let rejectNotification: (error: Error) => void = () => {};
    const pending = new Promise<void>((_resolve, reject) => { rejectNotification = reject; });
    void pending.catch(() => {});
    const supervisor = new Supervisor(identity, lease, () => false, () => pending);
    expect(supervisor.start()).toBe(false);
    rejectNotification(new Error('notification failed'));
    await Promise.resolve();
    await Promise.resolve();
    expect(supervisor.snapshot()).toEqual({ state: 'LOST', notificationFailed: true });
  } finally { db.close(); }
});

test('a reentrant start during the ownership check cannot create two timers', async () => {
  const Supervisor = await supervisorClass();
  const { db, lease } = fixture();
  try {
    let checks = 0;
    let nested: boolean | undefined;
    let supervisor: InstanceType<typeof Supervisor>;
    supervisor = new Supervisor(identity, lease, () => {
      checks++;
      if (checks === 1) nested = supervisor.start();
      return true;
    }, () => {});
    expect(supervisor.start()).toBe(true);
    expect(nested).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    supervisor.stop();
    expect(vi.getTimerCount()).toBe(0);
  } finally { db.close(); }
});
