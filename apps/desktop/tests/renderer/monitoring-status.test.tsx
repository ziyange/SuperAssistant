/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { MonitoringStatus } from '../../src/renderer/monitoring-status.js';

test('renders redacted monitoring counters and an unavailable collector honestly', () => {
  render(<MonitoringStatus status={{ rawEventCount: 3, aggregateCount: 1, blockedFollowUpCount: 2, collector: 'UNAVAILABLE' }} />);
  expect(screen.getByRole('region', { name: 'Monitoring status' })).toBeTruthy();
  expect(screen.getByText('Collector unavailable')).toBeTruthy();
  expect(screen.getByText('Raw evidence: 3')).toBeTruthy();
  expect(screen.queryByText('{}')).toBeNull();
});
