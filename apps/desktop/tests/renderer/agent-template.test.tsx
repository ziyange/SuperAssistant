/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AgentTemplate } from '../../src/renderer/agent-template.js';

test('shows pinned Template and Function version provenance', () => {
  render(<AgentTemplate template={{ name: 'Developer', version: '1.0.0', functions: [{ name: 'Implement', version: '2.1.0' }] }} />);
  expect(screen.getByText('Developer v1.0.0')).toBeTruthy();
  expect(screen.getByText('Implement v2.1.0')).toBeTruthy();
});
