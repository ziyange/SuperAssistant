/* eslint-disable no-unused-vars -- queue method parameter is part of the public contract. */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

export function acceptAuthenticatedWebhook(input: Readonly<{ payload: string; signature: string; secret: string }>): Readonly<{ payload: string }> {
  const expected = `sha256=${createHmac('sha256', input.secret).update(input.payload).digest('hex')}`;
  const actual = Buffer.from(input.signature);
  const expectedValue = Buffer.from(expected);
  if (actual.length !== expectedValue.length || !timingSafeEqual(actual, expectedValue)) throw new Error('MONITORING_WEBHOOK_SIGNATURE_INVALID');
  return Object.freeze({ payload: input.payload });
}

export function createCollectorQueue(limit: number): Readonly<{ enqueue(_value: string): Readonly<{ accepted: boolean; reason?: 'MONITORING_BACKPRESSURE'; depth: number }>; drain(): readonly string[] }> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('MONITORING_QUEUE_LIMIT_INVALID');
  const values: string[] = [];
  return Object.freeze({
    enqueue(value) {
      if (values.length >= limit) return { accepted: false, reason: 'MONITORING_BACKPRESSURE', depth: values.length };
      values.push(value); return { accepted: true, depth: values.length };
    },
    drain() { return values.splice(0); }
  });
}
