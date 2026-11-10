/** @vitest-environment jsdom */
/* global window */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Navigation } from '../../src/renderer/navigation.js';
import { App } from '../../src/renderer/App.js';

describe('primary navigation', () => {
  test('exposes exactly five destinations and starts at Super Assistant', () => {
    const seen: string[] = [];
    render(<Navigation current="super-assistant" onNavigate={(destination) => seen.push(destination)} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Super Assistant' }).getAttribute('aria-current')).toBe('page');
    fireEvent.click(screen.getByRole('button', { name: 'Project Center' }));
    expect(seen).toEqual(['project-center']);
    expect(screen.queryByRole('button', { name: /Template/i })).toBeNull();
  });
});

test('onboarding routes to real views without claiming an unavailable Task started', async () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'superAssistant');
  let completedWrites = 0;
  Object.defineProperty(window, 'superAssistant', { configurable: true, value: {
    async getOnboarding() { return { onboarding: { completed: false } }; },
    async setOnboarding() { completedWrites += 1; return { onboarding: { completed: true } }; },
    async listTasks() { return { tasks: [] }; },
    async listProjects() { return { projects: [] }; }
  } });
  const view = render(<App />);
  try {
    const content = within(view.container);
    fireEvent.click(content.getByRole('button', { name: 'Settings' }));
    expect(content.getByRole('button', { name: 'Start Task' })).toHaveProperty('disabled', true);
    fireEvent.click(content.getByRole('button', { name: 'Add Project' }));
    await waitFor(() => expect(content.getByRole('region', { name: 'Project Center' })).toBeTruthy());
    fireEvent.click(content.getByRole('button', { name: 'Settings' }));
    fireEvent.click(content.getByRole('button', { name: 'Connect Codex' }));
    expect(content.getByRole('region', { name: 'Agent Center' })).toBeTruthy();
    expect(content.getByText('UNAVAILABLE')).toBeTruthy();
    expect(completedWrites).toBe(0);
  } finally {
    view.unmount();
    if (previous) Object.defineProperty(window, 'superAssistant', previous);
    else Reflect.deleteProperty(window, 'superAssistant');
  }
});

test('Agent Center shows a user-triggered sanitized last Codex check', async () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'superAssistant');
  let calls = 0;
  Object.defineProperty(window, 'superAssistant', { configurable: true, value: {
    async getOnboarding() { return { onboarding: { completed: false } }; },
    async listTasks() { return { tasks: [] }; },
    async listProjects() { return { projects: [] }; },
    async checkCodex() { calls += 1; return { codex: { state: 'CHECKED', connection: 'VERSION_UNSUPPORTED', availability: 'UNAVAILABLE', version: '0.157.1', observedAt: '2026-11-09T00:00:00.000Z' } }; }
  } });
  const view = render(<App />);
  try {
    const content = within(view.container);
    fireEvent.click(content.getByRole('button', { name: 'Agent Center' }));
    expect(calls).toBe(0);
    fireEvent.click(content.getByRole('button', { name: 'Check Codex' }));
    await waitFor(() => expect(content.getByText('VERSION_UNSUPPORTED')).toBeTruthy());
    expect(content.getByText(/Last check/)).toBeTruthy();
    expect(calls).toBe(1);
    expect(content.queryByRole('button', { name: 'Repair authentication' })).toBeNull();
  } finally {
    view.unmount();
    if (previous) Object.defineProperty(window, 'superAssistant', previous);
    else Reflect.deleteProperty(window, 'superAssistant');
  }
});
