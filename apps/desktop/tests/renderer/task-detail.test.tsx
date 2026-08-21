/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TaskDetail } from '../../src/renderer/task-detail.js';

test('keeps cancellation truthful until process and lease evidence exist', () => {
  render(<TaskDetail task={{ goal: 'Cancel work', state: 'CANCELLING', projectName: 'Project', agentName: 'Codex', activity: [], artifacts: [], decisions: [{ decisionId: 'decision-1', taskId: 'task-1', question: 'Grant network access?', level: 'L4', status: 'OPEN' }] }} />);
  expect(screen.getByText(/process stops and leases release/)).toBeTruthy();
  expect(screen.getByText('Grant network access?')).toBeTruthy();
  expect(screen.getByText('Risk: L4')).toBeTruthy();
});
