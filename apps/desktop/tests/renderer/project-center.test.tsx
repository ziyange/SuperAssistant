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
