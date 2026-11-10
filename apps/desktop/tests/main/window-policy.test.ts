import { describe, expect, test } from 'vitest';
import { createWindowOptions, isAllowedNavigation, isTrustedIpcSender } from '../../src/main/window-policy.js';

describe('window policy', () => {
  test('accepts IPC only from the exact application file in its own main frame', () => {
    const app = 'file:///C:/app/renderer/index.html';
    expect(isTrustedIpcSender(app, app, true, true)).toBe(true);
    expect(isTrustedIpcSender('file:///C:/other/index.html', app, true, true)).toBe(false);
    expect(isTrustedIpcSender('http://127.0.0.1:5173.attacker.test/', app, true, true)).toBe(false);
    expect(isTrustedIpcSender('', app, true, true)).toBe(false);
    expect(isTrustedIpcSender(app, app, false, true)).toBe(false);
    expect(isTrustedIpcSender(app, app, true, false)).toBe(false);
  });
  test('creates a sandboxed and isolated renderer window', () => {
    const options = createWindowOptions('C:/app/preload.js');
    expect(options.webPreferences).toMatchObject({ contextIsolation: true, sandbox: true, nodeIntegration: false, preload: 'C:/app/preload.js' });
  });

  test('allows only the configured application origin', () => {
    expect(isAllowedNavigation('http://localhost:5173/app', 'http://localhost:5173')).toBe(true);
    expect(isAllowedNavigation('https://example.invalid', 'http://localhost:5173')).toBe(false);
  });

  test('rejects navigation to any file except the exact bundled renderer document', () => {
    const app = 'file:///C:/app/renderer/index.html';
    expect(isAllowedNavigation(app, app)).toBe(true);
    expect(isAllowedNavigation('file:///C:/other/untrusted.html', app)).toBe(false);
    expect(isAllowedNavigation('file:///C:/app/renderer/%2e%2e/untrusted.html', app)).toBe(false);
    expect(isAllowedNavigation('file://server/C:/app/renderer/index.html', app)).toBe(false);
    expect(isAllowedNavigation(app + '?mode=other', app)).toBe(false);
    expect(isAllowedNavigation(app + '#other', app)).toBe(false);
    expect(isAllowedNavigation('https://example.invalid', app)).toBe(false);
  });
});
