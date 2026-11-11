import { isValidNotificationTargetRef } from './notification-policy.js';
export interface NotificationOutboxRow { idempotencyKey: string; workspaceId: string; principal: string; priority: 'NORMAL' | 'EMERGENCY'; aggregateKey?: string; targetRef: string; attempts: number; }
export function hasValidNotificationScope(row: Pick<NotificationOutboxRow, 'idempotencyKey' | 'workspaceId' | 'principal'>): boolean {
  return [row.idempotencyKey, row.workspaceId, row.principal].every(value => typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127));
}
// eslint-disable-next-line no-unused-vars -- names document the storage contract.
export interface NotificationOutboxStore { insert(row: NotificationOutboxRow): Promise<boolean>; claim(limit: number): Promise<readonly NotificationOutboxRow[]>; beginDelivery(claim: NotificationOutboxRow): Promise<boolean>; markDelivered(claim: NotificationOutboxRow): Promise<boolean>; reconcile?(claim: NotificationOutboxRow, outcome: 'DELIVERED' | 'FINAL_NOT_DELIVERED', evidenceRef: string): Promise<boolean>; }
// eslint-disable-next-line no-unused-vars -- names document the trusted server-side ports.
export interface NotificationDeliveryPorts { authorize(workspaceId: string, principal: string, targetRef: string): Promise<boolean>; deliver(idempotencyKey: string): Promise<void>; }
// eslint-disable-next-line no-unused-vars -- the key identifies the authoritative channel operation.
export interface NotificationReconciliationPort { status(idempotencyKey: string): Promise<{ outcome: 'UNKNOWN' } | { outcome: 'DELIVERED' | 'FINAL_NOT_DELIVERED'; evidenceRef: string }>; }
export class NotificationOutbox {
  // eslint-disable-next-line no-unused-vars -- TypeScript parameter property.
  constructor(private readonly store: NotificationOutboxStore) {}
  async enqueue(row: NotificationOutboxRow) { if (!hasValidNotificationScope(row)) throw new Error('NOTIFICATION_SCOPE_INVALID'); if (!isValidNotificationTargetRef(row.targetRef)) throw new Error('NOTIFICATION_TARGET_INVALID'); return this.store.insert({ ...row, attempts: 0 }); }
  async claim(limit: number) {
    if (!Number.isSafeInteger(limit)) throw new Error('NOTIFICATION_CLAIM_LIMIT_INVALID');
    const bounded = Math.min(Math.max(limit, 1), 20);
    const claims = await this.store.claim(bounded);
    if (!Array.isArray(claims) || claims.length > bounded) throw new Error('NOTIFICATION_CLAIM_LIMIT_EXCEEDED');
    return claims;
  }
  async beginDelivery(claim: NotificationOutboxRow): Promise<boolean> {
    if (!claim.idempotencyKey || !Number.isSafeInteger(claim.attempts) || claim.attempts <= 0) return false;
    return (await this.store.beginDelivery(claim)) === true;
  }
  async acknowledge(claim: NotificationOutboxRow): Promise<boolean> {
    if (!claim.idempotencyKey || !Number.isSafeInteger(claim.attempts) || claim.attempts <= 0) return false;
    return (await this.store.markDelivered(claim)) === true;
  }
  async deliverClaim(claim: NotificationOutboxRow, ports: NotificationDeliveryPorts): Promise<'DENIED' | 'NOT_STARTED' | 'UNKNOWN' | 'DELIVERED'> {
    if (!hasValidNotificationScope(claim) || !isValidNotificationTargetRef(claim.targetRef) || !Number.isSafeInteger(claim.attempts) || claim.attempts <= 0) return 'DENIED';
    try {
      if (await ports.authorize(claim.workspaceId, claim.principal, claim.targetRef) !== true) return 'DENIED';
      if (!await this.beginDelivery(claim)) return 'NOT_STARTED';
      await ports.deliver(claim.idempotencyKey);
      return await this.acknowledge(claim) ? 'DELIVERED' : 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }
  async deliverAvailable(limit: number, ports: NotificationDeliveryPorts): Promise<{ delivered: number; denied: number; notStarted: number; unknown: number }> {
    const counts = { delivered: 0, denied: 0, notStarted: 0, unknown: 0 };
    for (const claim of await this.claim(limit)) {
      const result = await this.deliverClaim(claim, ports);
      if (result === 'DELIVERED') counts.delivered += 1;
      else if (result === 'DENIED') counts.denied += 1;
      else if (result === 'NOT_STARTED') counts.notStarted += 1;
      else counts.unknown += 1;
    }
    return counts;
  }
  async reconcileClaim(claim: NotificationOutboxRow, port: NotificationReconciliationPort): Promise<'UNKNOWN' | 'RETRYABLE' | 'DELIVERED'> {
    if (!hasValidNotificationScope(claim) || !isValidNotificationTargetRef(claim.targetRef) || !Number.isSafeInteger(claim.attempts) || claim.attempts <= 0 || this.store.reconcile === undefined) return 'UNKNOWN';
    try {
      const result = await port.status(claim.idempotencyKey);
      if (result.outcome === 'UNKNOWN') return 'UNKNOWN';
      if ((result.outcome !== 'DELIVERED' && result.outcome !== 'FINAL_NOT_DELIVERED') || typeof result.evidenceRef !== 'string' || !/^evidence:\S+$/.test(result.evidenceRef) || result.evidenceRef.length > 512) return 'UNKNOWN';
      if (!await this.store.reconcile(claim, result.outcome, result.evidenceRef)) return 'UNKNOWN';
      return result.outcome === 'DELIVERED' ? 'DELIVERED' : 'RETRYABLE';
    } catch {
      return 'UNKNOWN';
    }
  }
}
