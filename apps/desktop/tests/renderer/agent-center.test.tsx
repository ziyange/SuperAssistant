// @vitest-environment jsdom
/* global window */
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AgentCenter } from '../../src/renderer/agent-center.js';
import { App } from '../../src/renderer/App.js';

test('shows a connection error before availability and has no execute control', () => {
  render(<AgentCenter connection="AUTH_REQUIRED" availability="AVAILABLE" version="0.121.0" functions={['develop']} />);
  expect(screen.getByText('AUTH_REQUIRED')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Repair authentication' })).toBeNull();
  expect(screen.queryByText(/execute/i)).not.toBeInTheDocument();
});

test('after restart shows the saved version as unavailable and requiring recheck', async () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'superAssistant');
  Object.defineProperty(window, 'superAssistant', { configurable: true, value: {
    async getOnboarding() { return { onboarding: { completed: false } }; },
    async listTasks() { return { tasks: [] }; },
    async getCodexRegistration() { return { codexRegistration: { state: 'RECHECK_REQUIRED', version: '0.121.0' } }; }
  } });
  const view = render(<App />);
  try {
    const content = within(view.container);
    fireEvent.click(content.getByRole('button', { name: 'Agent Center' }));
    await waitFor(() => expect(content.getByText('Codex 0.121.0')).toBeInTheDocument());
    expect(content.getByText('UNAVAILABLE')).toBeInTheDocument();
    expect(content.getByText('Codex registration requires a new check.')).toBeInTheDocument();
    expect(content.queryByText('CONNECTED')).not.toBeInTheDocument();
  } finally {
    view.unmount();
    if (previous) Object.defineProperty(window, 'superAssistant', previous);
    else Reflect.deleteProperty(window, 'superAssistant');
  }
});
