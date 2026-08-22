export function recoverScheduledCollection(schedule: Readonly<{ scheduleId: string; dueAt: string; lastRunId: string | null }>, now: string): Readonly<{ scheduleId: string; action: 'COLLECT_ONCE' | 'NOOP' }> {
  return Object.freeze({ scheduleId: schedule.scheduleId, action: schedule.lastRunId === null && schedule.dueAt <= now ? 'COLLECT_ONCE' : 'NOOP' });
}
