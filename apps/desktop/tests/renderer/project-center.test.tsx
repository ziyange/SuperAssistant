/** @vitest-environment jsdom */
/* global window */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ProjectCenter } from '../../src/renderer/project-center.js';
import { App } from '../../src/renderer/App.js';

test('renders project status and metadata provenance without raw command detail', () => {
  render(<ProjectCenter projects={[{ id: 'p1', name: 'Demo', status: 'ACTIVE', repository: 'demo', branch: 'main', provenance: 'DISCOVERED' }]} />);
  expect(screen.getByText('Demo')).toBeTruthy(); expect(screen.getByText('ACTIVE')).toBeTruthy(); expect(screen.getByText(/Discovered/)).toBeTruthy(); expect(screen.queryByText(/git -C/i)).toBeNull();
});

test('exposes folder selection and communicates loading and safe errors', () => {
  let selections = 0;
  const view = render(<ProjectCenter projects={[]} onAdd={() => { selections += 1; }} loading={false} error="Project path could not be validated." />);
  fireEvent.click(screen.getByRole('button', { name: 'Add Project' }));
  expect(selections).toBe(1);
  expect(screen.getByText('Project path could not be validated.')).toBeTruthy();
  view.rerender(<ProjectCenter projects={[]} onAdd={() => { selections += 1; }} loading={true} />);
  expect(screen.getByRole('button', { name: 'Add Project' })).toHaveProperty('disabled', true);
});

test('explicitly configures Codex without claiming execution is ready', () => {
  const assigned: string[] = [];
  const project = { id: 'p1', name: 'Demo', status: 'ACTIVE' as const, repository: null, branch: null, provenance: 'DISCOVERED' as const, codexAssigned: false, hasDefaultAgent: false };
  const view = render(<ProjectCenter projects={[project]} codexRegistered onAssignCodex={id => { assigned.push(id); }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Assign Codex to Demo' }));
  expect(assigned).toEqual(['p1']);
  view.rerender(<ProjectCenter projects={[{ ...project, codexAssigned: true, hasDefaultAgent: true }]} codexRegistered onAssignCodex={id => { assigned.push(id); }} />);
  expect(screen.getByText('Codex configured; recheck required.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Assign Codex to Demo' })).toBeNull();
  view.rerender(<ProjectCenter projects={[{ ...project, hasDefaultAgent: true }]} codexRegistered onAssignCodex={id => { assigned.push(id); }} />);
  expect(screen.getByText('Another agent is configured.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Assign Codex to Demo' })).toBeNull();
});

test('App refreshes Project Center after an authorized chooser response', async () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'superAssistant');
  const project = { id: 'p1', name: 'Demo', status: 'ACTIVE', repository: null, branch: null, provenance: 'DISCOVERED' };
  Object.defineProperty(window, 'superAssistant', { configurable: true, value: {
    async getOnboarding() { return { onboarding: { completed: false } }; },
    async listTasks() { return { tasks: [] }; },
    async listProjects() { return { projects: [] }; },
    async chooseProject() { return { status: 'REGISTERED', projects: [project] }; }
  } });
  const view = render(<App />);
  try {
    const content = within(view.container);
    fireEvent.click(content.getByRole('button', { name: 'Project Center' }));
    await waitFor(() => expect(content.getByRole('button', { name: 'Add Project' })).toHaveProperty('disabled', false));
    fireEvent.click(content.getByRole('button', { name: 'Add Project' }));
    await waitFor(() => expect(content.getByText('Demo')).toBeTruthy());
    expect(content.getByText('Project registered.')).toBeTruthy();
  } finally {
    view.unmount();
    if (previous) Object.defineProperty(window, 'superAssistant', previous);
    else Reflect.deleteProperty(window, 'superAssistant');
  }
});

test('App sends only the chosen Project ID and refreshes the configured card', async () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'superAssistant');
  const calls: string[] = [];
  const project = { id: 'p1', name: 'Demo', status: 'ACTIVE', repository: null, branch: null, provenance: 'DISCOVERED', codexAssigned: false, hasDefaultAgent: false };
  Object.defineProperty(window, 'superAssistant', { configurable: true, value: {
    async getOnboarding() { return { onboarding: { completed: false } }; },
    async getCodexRegistration() { return { codexRegistration: { state: 'RECHECK_REQUIRED', version: '0.121.0' } }; },
    async listTasks() { return { tasks: [] }; },
    async listProjects() { return { projects: [project] }; },
    async assignProjectCodex(id: string) { calls.push(id); return { status: 'ASSIGNED', projects: [{ ...project, codexAssigned: true, hasDefaultAgent: true }] }; }
  } });
  const view = render(<App />);
  try {
    const content = within(view.container);
    fireEvent.click(content.getByRole('button', { name: 'Project Center' }));
    await waitFor(() => expect(content.getByRole('button', { name: 'Assign Codex to Demo' })).toBeTruthy());
    fireEvent.click(content.getByRole('button', { name: 'Assign Codex to Demo' }));
    await waitFor(() => expect(content.getByText('Codex configured; recheck required.')).toBeTruthy());
    expect(calls).toEqual(['p1']);
    expect(content.queryByRole('button', { name: 'Assign Codex to Demo' })).toBeNull();
  } finally {
    view.unmount();
    if (previous) Object.defineProperty(window, 'superAssistant', previous);
    else Reflect.deleteProperty(window, 'superAssistant');
  }
});
