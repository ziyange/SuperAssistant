// @vitest-environment jsdom
/* global window */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { DecisionCenter } from '../../src/renderer/decision-center.js';
import { App } from '../../src/renderer/App.js';

afterEach(() => cleanup());

test('shows an open L3 Decision as a non-authorizing user gate', () => {
  render(<DecisionCenter decision={{ decisionId: 'decision-1', taskId: 'task-1', question: 'Grant network access?', level: 'L3', status: 'OPEN' }} />);
  expect(screen.getByRole('region', { name: 'Decision' }).textContent).toContain('AI recommendation is not authorization');
  expect(screen.getByText('Grant network access?')).toBeTruthy();
});

test('shows the canonical Task Decision on the Super Assistant home', async () => {
  window.superAssistant = { getOnboarding: async () => ({ onboarding: { completed: false } }), setOnboarding: async () => ({ onboarding: { completed: false } }), listTasks: async () => ({ tasks: [{ taskId: 'task-1', goal: 'Goal', projectName: 'Project', agentName: 'Codex', updatedAt: 'now', state: 'RUNNING', activity: [] }] }), listDecisions: async () => ({ decisions: [{ decisionId: 'decision-1', taskId: 'task-1', question: 'Grant network access?', level: 'L3', status: 'OPEN' }] }), getTask: async () => ({ task: { taskId: 'task-1', goal: 'Goal', projectName: 'Project', agentName: 'Codex', updatedAt: 'now', state: 'RUNNING', activity: [] } }), getArtifact: async () => ({ artifact: { logicalName: 'a', mimeType: 'text/plain', checksum: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', state: 'AVAILABLE' } }), getDecision: async () => ({ decision: { decisionId: 'decision-1', taskId: 'task-1', question: 'Grant network access?', level: 'L3', status: 'OPEN' } }) };
  render(<App />);
  expect(await screen.findByText('Grant network access?')).toBeTruthy();
});
