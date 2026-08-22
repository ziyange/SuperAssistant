import { expect, test } from 'vitest';
import { acceptAuthenticatedWebhook, createCollectorQueue } from '../src/monitoring-collector.js';

test('rejects an invalid webhook signature before accepting its payload', () => {
  expect(() => acceptAuthenticatedWebhook({ payload: 'event', signature: 'sha256=bad', secret: 'test-secret' })).toThrow('MONITORING_WEBHOOK_SIGNATURE_INVALID');
});

test('makes bounded collector backpressure explicit without dropping accepted items', () => {
  const queue = createCollectorQueue(1);
  expect(queue.enqueue('first')).toEqual({ accepted: true, depth: 1 });
  expect(queue.enqueue('second')).toEqual({ accepted: false, reason: 'MONITORING_BACKPRESSURE', depth: 1 });
  expect(queue.drain()).toEqual(['first']);
});
