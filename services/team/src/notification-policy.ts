export interface QuietHours { workspaceId: string; principal: string; startHour: number; endHour: number }
export type NotificationDeepLink = Readonly<{ kind: 'TASK' | 'DECISION'; id: string }>;
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

/** Resolves a notification link only after its target has been re-authorized. */
export function resolveNotificationDeepLink(input: Readonly<{
  authorized: boolean;
  taskId?: string;
  decisionId?: string;
}>): NotificationDeepLink | undefined {
  if (!input.authorized || (input.taskId === undefined) === (input.decisionId === undefined)) return undefined;
  return input.taskId === undefined
    ? { kind: 'DECISION', id: input.decisionId as string }
    : { kind: 'TASK', id: input.taskId };
}
