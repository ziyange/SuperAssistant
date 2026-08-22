/* eslint-disable no-unused-vars -- port parameter names are part of the public contract. */
import type { MonitoringStatus } from '@super-assistant/domain';

export interface MonitoringStatusReadPort {
  get(projectId: string): Readonly<MonitoringStatus>;
}

export function projectMonitoringStatusForRenderer(port: MonitoringStatusReadPort, input: Readonly<{ projectId: string }>): Readonly<MonitoringStatus> {
  return port.get(input.projectId);
}
