/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { ArtifactView } from '../../src/renderer/artifact-view.js';

test('shows quarantined Artifact evidence as non-executable metadata', () => {
  render(<ArtifactView artifact={{ logicalName: 'result.txt', mimeType: 'text/plain', checksum: 'sha256:abc', state: 'QUARANTINED' }} />);
  expect(screen.getByText('Artifact quarantined')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('renders malicious HTML as download-only metadata without active content', () => {
  render(<ArtifactView artifact={{ logicalName: '<script>alert(1)</script>', mimeType: 'text/html', checksum: 'sha256:def', state: 'DOWNLOAD_ONLY' }} />);
  expect(screen.getByText('Download only')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
  expect(globalThis.document.querySelector('script')).toBeNull();
});
