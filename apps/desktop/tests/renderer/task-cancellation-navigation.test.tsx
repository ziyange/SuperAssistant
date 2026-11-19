// @vitest-environment jsdom
/* global window */
import { expect, test } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { App } from '../../src/renderer/App.js';

const now = '2026-11-19T00:00:00.000Z';
const getOnboarding = async () => ({ onboarding: { completed: false } });

test('keeps a confirmed cancellation across navigation and a late queued projection', async () => {
  let settleDecisions: () => void = () => undefined;
  const decisions = new Promise<{ decisions: [] }>(resolve => { settleDecisions = () => resolve({ decisions: [] }); });
  const previous = Object.getOwnPropertyDescriptor(window, 'superAssistant');
  Object.defineProperty(window, 'superAssistant', { configurable: true, value: {
    getOnboarding, listProjects: async () => ({ projects: [] }),
    listTasks: async () => ({ tasks: [{ taskId: 'old', goal: 'Queued job', state: 'QUEUED', projectName: 'Project', agentName: 'Codex', activity: [], updatedAt: now }] }),
    listDecisions: () => decisions, cancelQueuedTask: async () => ({ queuedCancellation: 'CANCELLED' })
  } });
  try {
    render(createElement(App));
    fireEvent.click(screen.getByRole('button', { name: 'Task Center' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel queued task' }));
    expect(await screen.findByText('CANCELLED')).toBeTruthy();
    await act(async () => { settleDecisions(); });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Task Center' }));
    expect(screen.queryByText('CANCELLED')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cancel queued task' })).toBeNull();
  } finally {
    cleanup();
    if (previous) Object.defineProperty(window, 'superAssistant', previous);
    else Reflect.deleteProperty(window, 'superAssistant');
  }
});
