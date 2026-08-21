/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ArtifactView } from '../../src/renderer/artifact-view.js';

test('shows quarantined Artifact evidence as non-executable metadata', () => {
  render(<ArtifactView artifact={{ logicalName: 'result.txt', mimeType: 'text/plain', checksum: 'sha256:abc', state: 'QUARANTINED' }} />);
  expect(screen.getByText('Artifact quarantined')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});
