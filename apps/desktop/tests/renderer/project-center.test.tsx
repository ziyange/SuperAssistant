/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ProjectCenter } from '../../src/renderer/project-center.js';

test('renders project status and metadata provenance without raw command detail', () => {
  render(<ProjectCenter projects={[{ id: 'p1', name: 'Demo', status: 'ACTIVE', repository: 'demo', branch: 'main', provenance: 'DISCOVERED' }]} />);
  expect(screen.getByText('Demo')).toBeTruthy(); expect(screen.getByText('ACTIVE')).toBeTruthy(); expect(screen.getByText(/Discovered/)).toBeTruthy(); expect(screen.queryByText(/git -C/i)).toBeNull();
});
