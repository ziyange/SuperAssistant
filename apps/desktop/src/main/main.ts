/* global process */
import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type Database from 'better-sqlite3';
import { createFoundationDatabase, SqliteAcceptanceRepository, SqliteArtifactRepository, SqliteAuditExportRepository, SqliteDecisionRepository, SqliteHistoryRepository, SqliteMonitoringStatusRepository, SqliteProjectChangeRepository, SqliteTaskProjectionQuery } from '@super-assistant/persistence';
import { routeIpc, type OnboardingPort } from './ipc-router.js';
import { createWindowOptions, isAllowedNavigation } from './window-policy.js';
import { unavailableTeamPort } from './team-ipc.js';

let onboarding = { completed: false };
const onboardingPort: OnboardingPort = { get: async () => onboarding, set: async (next) => (onboarding = { completed: next.completed }) };
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
let database: Database.Database | undefined;

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
  database = createFoundationDatabase(join(app.getPath('userData'), 'super-assistant.sqlite'));
  const taskPort = new SqliteTaskProjectionQuery(database);
  const artifactPort = new SqliteArtifactRepository(database);
  const decisionPort = new SqliteDecisionRepository(database);
  const historyPort = new SqliteHistoryRepository(database);
  const changePort = new SqliteProjectChangeRepository(database);
  const acceptancePort = new SqliteAcceptanceRepository(database);
  const auditExportPort = new SqliteAuditExportRepository(database);
  const monitoringStatusPort = new SqliteMonitoringStatusRepository(database);
  const teamPort = unavailableTeamPort();
  const routeTrustedIpc = (event: IpcMainInvokeEvent, channel: string, payload: unknown) => {
    if (!senderIsTrusted(event.senderFrame?.url ?? '')) throw new Error('Untrusted IPC sender.');
    return routeIpc({ channel, payload }, onboardingPort, undefined, taskPort, artifactPort, decisionPort, historyPort, changePort, acceptancePort, auditExportPort, monitoringStatusPort, teamPort);
  };
  ipcMain.handle('onboarding:get', (event, payload) => {
    return routeTrustedIpc(event, 'onboarding:get', payload);
  });
  ipcMain.handle('onboarding:set', (event, payload) => {
    return routeTrustedIpc(event, 'onboarding:set', payload);
  });
  ipcMain.handle('task:get', (event, payload) => routeTrustedIpc(event, 'task:get', payload));
  ipcMain.handle('task:list', (event, payload) => routeTrustedIpc(event, 'task:list', payload));
  ipcMain.handle('artifact:get', (event, payload) => routeTrustedIpc(event, 'artifact:get', payload));
  ipcMain.handle('decision:get', (event, payload) => routeTrustedIpc(event, 'decision:get', payload));
  ipcMain.handle('decision:list', (event, payload) => routeTrustedIpc(event, 'decision:list', payload));
  ipcMain.handle('history:list', (event, payload) => routeTrustedIpc(event, 'history:list', payload));
  ipcMain.handle('project-change:list', (event, payload) => routeTrustedIpc(event, 'project-change:list', payload));
  ipcMain.handle('acceptance:list', (event, payload) => routeTrustedIpc(event, 'acceptance:list', payload));
  ipcMain.handle('audit-export:create', (event, payload) => routeTrustedIpc(event, 'audit-export:create', payload));
  ipcMain.handle('monitoring:status', (event, payload) => routeTrustedIpc(event, 'monitoring:status', payload));
  ipcMain.handle('team:workspace', (event, payload) => routeTrustedIpc(event, 'team:workspace', payload));
  await createWindow();
});

app.on('before-quit', () => database?.close());

app.on('web-contents-created', (_event, contents) => contents.setWindowOpenHandler(() => ({ action: 'deny' })));
app.on('browser-window-created', (_event, window) => window.webContents.on('will-navigate', (event, target) => { if (!isAllowedNavigation(target, 'file://')) event.preventDefault(); }));
