import { describe, expect, test } from 'vitest';
import { createWindowOptions, isAllowedNavigation } from '../../src/main/window-policy.js';

describe('window policy', () => {
  test('creates a sandboxed and isolated renderer window', () => {
    const options = createWindowOptions('C:/app/preload.js');
    expect(options.webPreferences).toMatchObject({ contextIsolation: true, sandbox: true, nodeIntegration: false, preload: 'C:/app/preload.js' });
  });

  test('allows only the configured application origin', () => {
    expect(isAllowedNavigation('http://localhost:5173/app', 'http://localhost:5173')).toBe(true);
    expect(isAllowedNavigation('https://example.invalid', 'http://localhost:5173')).toBe(false);
  });
});
