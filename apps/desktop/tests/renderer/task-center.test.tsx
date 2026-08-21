/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TaskCenter } from '../../src/renderer/task-center.js';

test('shows deterministic reconciliation state without provider-native detail', () => {
  render(<TaskCenter tasks={[{ taskId: 'task-1', goal: 'Fix parser', state: 'RUNNING / RECONCILING', projectName: 'Project', agentName: 'Codex', updatedAt: '2026-08-14', activity: ['Working'], artifacts: [] }]} />);
  expect(screen.getByText(/No duplicate execution/)).toBeTruthy();
  expect(screen.queryByText(/thread|turn/i)).toBeNull();
});
