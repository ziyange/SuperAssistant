// @vitest-environment jsdom
/* global window */
import { expect, test } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { App } from '../../src/renderer/App.js';

const now = '2026-11-19T00:00:00.000Z';
const getOnboarding = async () => ({ onboarding: { completed: false } });

test('read failures are not presented as an empty Task list or as verified absence of Decisions', async () => {
  let disconnected = false;
  const previous = Object.getOwnPropertyDescriptor(window, 'superAssistant');
  Object.defineProperty(window, 'superAssistant', { configurable: true, value: {
    getOnboarding, listProjects: async () => ({ projects: [] }),
    listTasks: async () => {
      if (disconnected) throw new Error('unavailable');
      return { tasks: [{taskId: 'a', goal: 'Existing local Task', state: 'RUNNING', projectName: 'Project', agentName: 'Codex', activity: [], updatedAt: now}] };
    },
    listDecisions: async () => { throw new Error('unavailable'); },
    checkCodex: async () => { disconnected = true; throw new Error('unavailable'); }
  } });
  try {
    render(createElement(App));
    fireEvent.click(screen.getByRole('button', {name: 'Task Center'}));
    expect(await screen.findByText('Decision status could not be loaded.')).toBeTruthy();
    expect(screen.getByText('Existing local Task')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Agent Center'}));
    fireEvent.click(screen.getByRole('button', {name: 'Check Codex'}));
    expect(await screen.findByText('Codex check unavailable.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Task Center'}));
    expect(await screen.findByText('Task status could not be loaded.')).toBeTruthy();
    expect(screen.queryByText('No Tasks yet.')).toBeNull();
    expect(screen.queryByText('Existing local Task')).toBeNull();
  } finally {
    cleanup();
    if (previous) Object.defineProperty(window, 'superAssistant', previous);
    else Reflect.deleteProperty(window, 'superAssistant');
  }
});

test('shows the persisted recovery result after Agent Center recheck even if earlier Decisions arrive late', async () => {
  let checked = false, reads = 0;
  let finishOld: () => void = () => undefined;
  const old = new Promise<{ decisions: [] }>(resolve => { finishOld = () => resolve({ decisions: [] }); });
  const previous = Object.getOwnPropertyDescriptor(window, 'superAssistant');
  Object.defineProperty(window, 'superAssistant', { configurable: true, value: {
    getOnboarding, listProjects: async () => ({ projects: [] }),
    listTasks: async () => { reads++; return { tasks: [{ taskId: 'a', goal: 'Recover this job', state: checked ? 'ACCEPTANCE_PENDING' : 'RUNNING / RECONCILING', projectName: 'Project', agentName: 'Codex', activity: [], updatedAt: now }] }; },
    listDecisions: () => checked ? Promise.resolve({ decisions: [] }) : old,
    checkCodex: async () => { checked = true; return { codex: { state: 'CHECKED', connection: 'CONNECTED', availability: 'AVAILABLE', version: '0.121.0', observedAt: now } }; }
  } });
  try {
    render(createElement(App));
    fireEvent.click(screen.getByRole('button', { name: 'Task Center' }));
    expect(await screen.findByText('RUNNING / RECONCILING')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Agent Center' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check Codex' }));
    expect(await screen.findByText('AVAILABLE')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Task Center' }));
    expect(await screen.findByText('ACCEPTANCE_PENDING')).toBeTruthy();
    await act(async () => { finishOld(); });
    expect(screen.queryByText('RUNNING / RECONCILING')).toBeNull();
    expect(reads).toBe(2);
  } finally {
    cleanup();
    if (previous) Object.defineProperty(window, 'superAssistant', previous);
    else Reflect.deleteProperty(window, 'superAssistant');
  }
});

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
