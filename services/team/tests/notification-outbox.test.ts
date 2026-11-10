import { expect, test } from 'vitest'; import { NotificationOutbox } from '../src/notification-outbox.js';
test('uses idempotency key and bounded claim size', async () => { let rows = 0; const outbox = new NotificationOutbox({ async insert() { rows += 1; return rows === 1; }, async claim(limit) { return Array.from({ length: limit }, (_, index) => ({ idempotencyKey: String(index), workspaceId: 'w', principal: 'p', priority: 'NORMAL' as const, targetRef: 'target:t', attempts: 0 })); }, async beginDelivery() { return false; }, async markDelivered() { return false; } }); expect(await outbox.enqueue({ idempotencyKey: 'a', workspaceId: 'w', principal: 'p', priority: 'NORMAL', targetRef: 'target:t', attempts: 9 })).toBe(true); expect((await outbox.claim(99))).toHaveLength(20); });

test('rejects stale delivery acknowledgements and passes the claim generation to durable storage', async () => {
  let generation = 0;
  let delivered = false;
  const outbox = new NotificationOutbox({
    async insert() { return true; },
    async claim() { generation += 1; return [{ idempotencyKey: 'n', workspaceId: 'w', principal: 'p', priority: 'NORMAL' as const, targetRef: 'target:t', attempts: generation }]; },
    async beginDelivery() { return true; },
    async markDelivered(claim) { if (claim.attempts !== generation || delivered) return false; delivered = true; return true; }
  });
  const first = (await outbox.claim(1))[0];
  const second = (await outbox.claim(1))[0];
  if (first === undefined || second === undefined) throw new Error('Expected both claims');
  expect(outbox).toHaveProperty('acknowledge', expect.any(Function));
  expect(await outbox.acknowledge(first)).toBe(false);
  expect(await outbox.acknowledge(second)).toBe(true);
  expect(await outbox.acknowledge(second)).toBe(false);
});

test('rejects invalid claim limits before reaching storage', async () => {
  let calls = 0;
  const outbox = new NotificationOutbox({
    async insert() { return true; },
    async claim() { calls += 1; return []; },
    async beginDelivery() { return false; },
    async markDelivered() { return false; }
  });
  await expect(outbox.claim(Number.NaN)).rejects.toThrow('NOTIFICATION_CLAIM_LIMIT_INVALID');
  await expect(outbox.claim(Infinity)).rejects.toThrow('NOTIFICATION_CLAIM_LIMIT_INVALID');
  await expect(outbox.claim(1.5)).rejects.toThrow('NOTIFICATION_CLAIM_LIMIT_INVALID');
  expect(calls).toBe(0);
});

test('rejects malformed opaque references before storing a notification', async () => {
  let writes = 0;
  const outbox = new NotificationOutbox({
    async insert() { writes += 1; return true; },
    async claim() { return []; },
    async beginDelivery() { return false; },
    async markDelivered() { return false; }
  });
  const row = { idempotencyKey: 'n', workspaceId: 'w', principal: 'p', priority: 'NORMAL' as const, targetRef: 'target:', attempts: 0 };
  await expect(outbox.enqueue(row)).rejects.toThrow('NOTIFICATION_TARGET_INVALID');
  await expect(outbox.enqueue({ ...row, targetRef: 'target:good\nforged' })).rejects.toThrow('NOTIFICATION_TARGET_INVALID');
  await expect(outbox.enqueue({ ...row, targetRef: 'target:good trailing' })).rejects.toThrow('NOTIFICATION_TARGET_INVALID');
  expect(writes).toBe(0);
});

test('rejects empty or control-bearing notification scope before storage', async () => {
  let writes = 0;
  const outbox = new NotificationOutbox({
    async insert() { writes += 1; return true; }, async claim() { return []; },
    async beginDelivery() { return false; }, async markDelivered() { return false; }
  });
  const valid = { idempotencyKey: 'key', workspaceId: 'workspace', principal: 'user', priority: 'NORMAL' as const, targetRef: 'target:t', attempts: 0 };
  for (const invalid of [{ ...valid, idempotencyKey: '' }, { ...valid, workspaceId: ' ' }, { ...valid, principal: '\nuser' }]) {
    await expect(outbox.enqueue(invalid)).rejects.toThrow('NOTIFICATION_SCOPE_INVALID');
  }
  expect(writes).toBe(0);
});

test('reauthorizes and atomically starts a claim before a single channel send', async () => {
  let started = false;
  let sends = 0;
  let acknowledgements = 0;
  const claim = { idempotencyKey: 'key', workspaceId: 'w', principal: 'p', priority: 'NORMAL' as const, targetRef: 'target:t', attempts: 1 };
  const outbox = new NotificationOutbox({
    async insert() { return true; }, async claim() { return [claim]; },
    async beginDelivery(item) { if (item.attempts !== 1 || started) return false; started = true; return true; },
    async markDelivered(item) { if (item.attempts !== 1 || !started) return false; acknowledgements += 1; return true; }
  });
  const ports = { async authorize(workspaceId: string, principal: string, targetRef: string) { return workspaceId === 'w' && principal === 'p' && targetRef === 'target:t'; }, async deliver(key: string) { expect(key).toBe('key'); sends += 1; } };
  expect(outbox).toHaveProperty('deliverClaim', expect.any(Function));
  expect(await outbox.deliverClaim({ ...claim, principal: 'other' }, ports)).toBe('DENIED');
  expect(sends).toBe(0);
  const results = await Promise.all([outbox.deliverClaim(claim, ports), outbox.deliverClaim(claim, ports)]);
  expect(results.sort()).toEqual(['DELIVERED', 'NOT_STARTED']);
  expect(sends).toBe(1);
  expect(acknowledgements).toBe(1);
});

test('an uncertain channel result never authorizes a second send', async () => {
  let started = false;
  let sends = 0;
  let acknowledgements = 0;
  const claim = { idempotencyKey: 'key', workspaceId: 'w', principal: 'p', priority: 'NORMAL' as const, targetRef: 'target:t', attempts: 1 };
  const outbox = new NotificationOutbox({
    async insert() { return true; }, async claim() { return [claim]; },
    async beginDelivery() { if (started) return false; started = true; return true; },
    async markDelivered() { acknowledgements += 1; return true; }
  });
  const ports = { async authorize() { return true; }, async deliver() { sends += 1; throw new Error('outcome unknown'); } };
  expect(await outbox.deliverClaim(claim, ports)).toBe('UNKNOWN');
  expect(await outbox.deliverClaim(claim, ports)).toBe('NOT_STARTED');
  expect(sends).toBe(1);
  expect(acknowledgements).toBe(0);
});

test('an acknowledgement failure after sending remains unknown without a second send', async () => {
  let started = false;
  let sends = 0;
  const claim = { idempotencyKey: 'key', workspaceId: 'w', principal: 'p', priority: 'NORMAL' as const, targetRef: 'target:t', attempts: 1 };
  const outbox = new NotificationOutbox({
    async insert() { return true; }, async claim() { return [claim]; },
    async beginDelivery() { if (started) return false; started = true; return true; },
    async markDelivered() { throw new Error('database unavailable'); }
  });
  const ports = { async authorize() { return true; }, async deliver() { sends += 1; } };
  expect(await outbox.deliverClaim(claim, ports)).toBe('UNKNOWN');
  expect(await outbox.deliverClaim(claim, ports)).toBe('NOT_STARTED');
  expect(sends).toBe(1);
});

test('bounded batch independently counts denied, delivered and unknown notifications', async () => {
  const rows = ['ok', 'denied', 'unknown'].map(idempotencyKey => ({ idempotencyKey, workspaceId: 'w', principal: idempotencyKey, priority: 'NORMAL' as const, targetRef: `target:${idempotencyKey}`, attempts: 1 }));
  let requested = 0;
  const delivered: string[] = [];
  const outbox = new NotificationOutbox({
    async insert() { return true; },
    async claim(limit) { requested = limit; return rows; },
    async beginDelivery() { return true; },
    async markDelivered(row) { return row.idempotencyKey === 'ok'; }
  });
  const ports = {
    async authorize(_workspace: string, principal: string) { return principal !== 'denied'; },
    async deliver(key: string) { delivered.push(key); if (key === 'unknown') throw new Error('uncertain'); }
  };
  expect(outbox).toHaveProperty('deliverAvailable', expect.any(Function));
  expect(await outbox.deliverAvailable(99, ports)).toEqual({ delivered: 1, denied: 1, notStarted: 0, unknown: 1 });
  expect(requested).toBe(20);
  expect(delivered).toEqual(['ok', 'unknown']);
});

test('rejects an overfull storage batch before sending anything', async () => {
  let sends = 0;
  const outbox = new NotificationOutbox({
    async insert() { return true; },
    async claim() { return Array.from({ length: 21 }, (_, index) => ({ idempotencyKey: `key-${index}`, workspaceId: 'w', principal: 'p', priority: 'NORMAL' as const, targetRef: 'target:t', attempts: 1 })); },
    async beginDelivery() { return true; }, async markDelivered() { return true; }
  });
  await expect(outbox.deliverAvailable(20, { async authorize() { return true; }, async deliver() { sends += 1; } })).rejects.toThrow('NOTIFICATION_CLAIM_LIMIT_EXCEEDED');
  expect(sends).toBe(0);
});
