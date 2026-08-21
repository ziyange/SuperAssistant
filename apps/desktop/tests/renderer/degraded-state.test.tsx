/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { DegradedState } from '../../src/renderer/degraded-state.js';

test('describes read-only degradation without claiming a retry is safe', () => {
  render(<DegradedState reason="Adapter status is unavailable." />);
  expect(screen.getByText(/Read-only diagnostics remain available/)).toBeTruthy();
  expect(screen.queryByText(/Retry now/)).toBeNull();
});
