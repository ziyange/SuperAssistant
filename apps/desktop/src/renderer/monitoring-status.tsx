import type { MonitoringStatusRendererProjection } from '../shared/ipc-contract.js';

export function MonitoringStatus({ status }: Readonly<{ status: MonitoringStatusRendererProjection | undefined }>) {
  if (!status) return <section aria-label="Monitoring status"><h2>Monitoring status</h2><p>Monitoring status unavailable</p></section>;
  const collector = status.collector === 'BACKPRESSURE' ? 'Collector backpressure' : status.collector === 'UNAVAILABLE' ? 'Collector unavailable' : 'Collector idle';
  return <section aria-label="Monitoring status"><h2>Monitoring status</h2><p>{collector}</p><p>Raw evidence: {status.rawEventCount}</p><p>Aggregates: {status.aggregateCount}</p><p>Blocked follow-ups: {status.blockedFollowUpCount}</p></section>;
}
