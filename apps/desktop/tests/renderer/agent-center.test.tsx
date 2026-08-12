// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AgentCenter } from '../../src/renderer/agent-center.js';

test('shows a connection error before availability and has no execute control', () => {
  render(<AgentCenter connection="AUTH_REQUIRED" availability="AVAILABLE" version="0.121.0" functions={['develop']} />);
  expect(screen.getByText('AUTH_REQUIRED')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Repair authentication' })).toBeInTheDocument();
  expect(screen.queryByText(/execute/i)).not.toBeInTheDocument();
});
