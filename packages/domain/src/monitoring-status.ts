export type MonitoringCollectorState = 'IDLE' | 'BACKPRESSURE' | 'UNAVAILABLE';

export interface MonitoringStatus {
  readonly rawEventCount: number;
  readonly aggregateCount: number;
  readonly blockedFollowUpCount: number;
  readonly collector: MonitoringCollectorState;
}

export function createMonitoringStatus(input: MonitoringStatus): Readonly<MonitoringStatus> {
  if (![input.rawEventCount, input.aggregateCount, input.blockedFollowUpCount].every((count) => Number.isInteger(count) && count >= 0)) throw new Error('MONITORING_STATUS_COUNT_INVALID');
  return Object.freeze({ ...input });
}
