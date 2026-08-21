/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { TaskDetail } from '../../src/renderer/task-detail.js';

test('keeps cancellation truthful until process and lease evidence exist', () => {
  render(<TaskDetail task={{ goal: 'Cancel work', state: 'CANCELLING', projectName: 'Project', agentName: 'Codex', activity: [], artifacts: [] }} />);
  expect(screen.getByText(/process stops and leases release/)).toBeTruthy();
});
