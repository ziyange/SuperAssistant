/* global process */
import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { routeIpc, type OnboardingPort } from './ipc-router.js';
import { createWindowOptions, isAllowedNavigation } from './window-policy.js';

let onboarding = { completed: false };
const onboardingPort: OnboardingPort = { get: async () => onboarding, set: async (next) => (onboarding = { completed: next.completed }) };
const moduleDirectory = dirname(fileURLToPath(import.meta.url));

function senderIsTrusted(senderUrl: string): boolean {
  return senderUrl.startsWith('file:') || senderUrl.startsWith(process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173');
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow(createWindowOptions(join(moduleDirectory, '../preload/index.js')));
  const origin = process.env.VITE_DEV_SERVER_URL ?? 'file://';
  window.webContents.on('will-navigate', (event, target) => { if (!isAllowedNavigation(target, origin)) event.preventDefault(); });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  await window.loadFile(join(moduleDirectory, '../renderer/index.html'));
}

app.whenReady().then(async () => {
  ipcMain.handle('onboarding:get', (event, payload) => {
    if (!senderIsTrusted(event.senderFrame?.url ?? '')) throw new Error('Untrusted IPC sender.');
    return routeIpc({ channel: 'onboarding:get', payload }, onboardingPort);
  });
  ipcMain.handle('onboarding:set', (event, payload) => {
    if (!senderIsTrusted(event.senderFrame?.url ?? '')) throw new Error('Untrusted IPC sender.');
    return routeIpc({ channel: 'onboarding:set', payload }, onboardingPort);
  });
  await createWindow();
});

app.on('web-contents-created', (_event, contents) => contents.setWindowOpenHandler(() => ({ action: 'deny' })));
app.on('browser-window-created', (_event, window) => window.webContents.on('will-navigate', (event, target) => { if (!isAllowedNavigation(target, 'file://')) event.preventDefault(); }));
