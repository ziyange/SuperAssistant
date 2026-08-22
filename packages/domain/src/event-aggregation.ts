export interface AggregationInput { rawEventId: string; key: string; occurredAt: string; }
export interface EventGroup { correlationKey: string; rawEventIds: readonly string[]; count: number; }

export function aggregateEvents(events: readonly AggregationInput[], windowMs: number): readonly EventGroup[] {
  if (!Number.isInteger(windowMs) || windowMs < 1) throw new Error('MONITORING_WINDOW_INVALID');
  const groups: Array<{ key: string; startedAt: number; rawEventIds: string[] }> = [];
  for (const event of events) {
    const at = Date.parse(event.occurredAt);
    const current = groups.find((group) => group.key === event.key && at - group.startedAt < windowMs);
    if (current) current.rawEventIds.push(event.rawEventId);
    else groups.push({ key: event.key, startedAt: at, rawEventIds: [event.rawEventId] });
  }
  return groups.map((group) => Object.freeze({ correlationKey: group.key, rawEventIds: Object.freeze([...group.rawEventIds]), count: group.rawEventIds.length }));
}
