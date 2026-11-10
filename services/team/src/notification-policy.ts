export interface QuietHours { workspaceId: string; principal: string; startHour: number; endHour: number }
export type NotificationDeepLink = Readonly<{ kind: 'TASK' | 'DECISION'; id: string }>;
export function isValidNotificationTargetRef(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('target:') && value.length > 7 && !/\s/.test(value) && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
function withinQuietHours(hour: number, quietHours: QuietHours): boolean {
  return quietHours.startHour < quietHours.endHour ? hour >= quietHours.startHour && hour < quietHours.endHour : hour >= quietHours.startHour || hour < quietHours.endHour;
}
export function decideNotificationDelivery(input: Readonly<{ workspaceId: string; principal: string; authorized: boolean; priority: 'NORMAL' | 'EMERGENCY'; hour: number; quietHours?: QuietHours; aggregateKey?: string; pendingAggregateCount?: number }>): Readonly<{ deliver: boolean; reason?: 'AUTHORIZATION_DENIED' | 'QUIET_HOURS'; audit?: 'EMERGENCY_BYPASS'; aggregateCount?: number }> {
  if (!input.authorized) return { deliver: false, reason: 'AUTHORIZATION_DENIED' };
  const scopedQuiet = input.quietHours !== undefined && input.quietHours.workspaceId === input.workspaceId && input.quietHours.principal === input.principal && withinQuietHours(input.hour, input.quietHours);
  if (scopedQuiet && input.priority !== 'EMERGENCY') return { deliver: false, reason: 'QUIET_HOURS' };
  if (scopedQuiet && input.priority === 'EMERGENCY') return { deliver: true, audit: 'EMERGENCY_BYPASS' };
  return input.aggregateKey === undefined ? { deliver: true } : { deliver: true, aggregateCount: (input.pendingAggregateCount ?? 0) + 1 };
}

/** Authorize the opaque reference before resolving its server-owned target. */
export async function resolveNotificationDeepLink(input: Readonly<{
  workspaceId: string;
  principal: string;
  targetRef: string;
  requested?: NotificationDeepLink;
}>, ports: Readonly<{
  // eslint-disable-next-line no-unused-vars -- names document the port contract.
  authorize: (workspaceId: string, principal: string, targetRef: string) => Promise<boolean>;
  // eslint-disable-next-line no-unused-vars -- names document the port contract.
  resolve: (workspaceId: string, targetRef: string) => Promise<NotificationDeepLink | undefined>;
}>): Promise<NotificationDeepLink | undefined> {
  if (!input.workspaceId || !input.principal || !isValidNotificationTargetRef(input.targetRef)) return undefined;
  try {
    if (!await ports.authorize(input.workspaceId, input.principal, input.targetRef)) return undefined;
    const target = await ports.resolve(input.workspaceId, input.targetRef);
    if (target === undefined || (target.kind !== 'TASK' && target.kind !== 'DECISION') || !target.id) return undefined;
    if (input.requested !== undefined && (input.requested.kind !== target.kind || input.requested.id !== target.id)) return undefined;
    return { kind: target.kind, id: target.id };
  } catch {
    return undefined;
  }
}
