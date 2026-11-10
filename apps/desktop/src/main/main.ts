/* global process */
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, extname, isAbsolute, join } from 'node:path';
import { realpath, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type Database from 'better-sqlite3';
import { createFoundationDatabase, SqliteAcceptanceRepository, SqliteArtifactRepository, SqliteAuditExportRepository, SqliteDecisionRepository, SqliteHistoryRepository, SqliteMonitoringStatusRepository, SqliteOnboardingRepository, SqliteProjectChangeRepository, SqliteTaskProjectionQuery } from '@super-assistant/persistence';
import { codexDiscoveryEnvironment, createAppServerDiscoverySupervisor, createReadOnlyCodexLaunch, terminateProcessTree } from '@super-assistant/codex-adapter';
import { routeIpc } from './ipc-router.js';
import { createWindowOptions, isAllowedNavigation, isTrustedIpcSender } from './window-policy.js';
import { unavailableTeamPort } from './team-ipc.js';
import { LocalProjectCatalog } from './project-ipc.js';
import { createCodexDiscoveryCheck, createCodexProbe, createVersionProbe, type CodexCheck } from './codex-discovery-ipc.js';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
let database: Database.Database | undefined;

let applicationWindow: BrowserWindow | undefined;
let pendingCodexCheck: Promise<CodexCheck> | undefined;
const rendererPath = join(moduleDirectory, '../renderer/index.html');
const rendererUrl = pathToFileURL(rendererPath).href;

async function createWindow(): Promise<void> {
  const window = new BrowserWindow(createWindowOptions(join(moduleDirectory, '../preload/index.cjs')));
  applicationWindow = window;
  window.webContents.on('will-navigate', (event, target) => { if (!isAllowedNavigation(target, rendererUrl)) event.preventDefault(); });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  await window.loadFile(rendererPath);
}

app.whenReady().then(async () => {
  database = createFoundationDatabase(join(app.getPath('userData'), 'super-assistant.sqlite'));
  const onboardingPort = new SqliteOnboardingRepository(database);
  const taskPort = new SqliteTaskProjectionQuery(database);
  const artifactPort = new SqliteArtifactRepository(database);
  const decisionPort = new SqliteDecisionRepository(database);
  const historyPort = new SqliteHistoryRepository(database);
  const changePort = new SqliteProjectChangeRepository(database);
  const acceptancePort = new SqliteAcceptanceRepository(database);
  const auditExportPort = new SqliteAuditExportRepository(database);
  const monitoringStatusPort = new SqliteMonitoringStatusRepository(database);
  const teamPort = unavailableTeamPort();
  const readVersion = createVersionProbe(
    executable => spawn(executable, ['--version'], { cwd: app.getPath('userData'), env: codexDiscoveryEnvironment(process.env), windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'ignore'] }),
    async child => {
      if (typeof child.pid !== 'number' || child.pid <= 0) throw new Error('Version process unavailable.');
      await terminateProcessTree(child.pid);
    }
  );
  const inspectVersion = async (candidate: string): Promise<string> => {
    if (!isAbsolute(candidate) || extname(candidate).toLowerCase() !== '.exe') throw new Error('Invalid executable.');
    const executable = await realpath(candidate);
    if (extname(executable).toLowerCase() !== '.exe' || !(await stat(executable)).isFile()) throw new Error('Invalid executable.');
    return readVersion(executable);
  };
  const probe = createCodexProbe(inspectVersion, (executable, version) =>
    createAppServerDiscoverySupervisor(createReadOnlyCodexLaunch(executable, app.getPath('userData')), version));
  const checkCodex = createCodexDiscoveryCheck(async () => {
    if (process.platform !== 'win32') throw new Error('Codex discovery is available on Windows only.');
    if (!applicationWindow) throw new Error('Application window unavailable.');
    const result = await dialog.showOpenDialog(applicationWindow, { properties: ['openFile'], filters: [{ name: 'Executable', extensions: ['exe'] }] });
    const selected = result.canceled ? null : result.filePaths[0] ?? null;
    if (selected === null) return null;
    if (!isAbsolute(selected) || extname(selected).toLowerCase() !== '.exe') throw new Error('Invalid executable.');
    const canonical = await realpath(selected);
    if (extname(canonical).toLowerCase() !== '.exe' || !(await stat(canonical)).isFile()) throw new Error('Invalid executable.');
    return canonical;
  }, probe);
  const runCodexCheck = (): Promise<CodexCheck> => {
    if (!pendingCodexCheck) {
      const current = checkCodex();
      pendingCodexCheck = current;
      void current.finally(() => { if (pendingCodexCheck === current) pendingCodexCheck = undefined; });
    }
    return pendingCodexCheck;
  };
  const projectPort = new LocalProjectCatalog(database, async () => {
    if (!applicationWindow) throw new Error('Application window unavailable.');
    const result = await dialog.showOpenDialog(applicationWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  const routeTrustedIpc = (event: IpcMainInvokeEvent, channel: string, payload: unknown) => {
    if (!isTrustedIpcSender(event.senderFrame?.url ?? '', rendererUrl, event.sender === applicationWindow?.webContents, event.senderFrame === event.sender.mainFrame)) throw new Error('Untrusted IPC sender.');
    return routeIpc({ channel, payload }, onboardingPort, undefined, taskPort, artifactPort, decisionPort, historyPort, changePort, acceptancePort, auditExportPort, monitoringStatusPort, teamPort, projectPort, runCodexCheck);
  };
  ipcMain.handle('onboarding:get', (event, payload) => {
    return routeTrustedIpc(event, 'onboarding:get', payload);
  });
  ipcMain.handle('onboarding:set', (event, payload) => {
    return routeTrustedIpc(event, 'onboarding:set', payload);
  });
  ipcMain.handle('project:list', (event, payload) => routeTrustedIpc(event, 'project:list', payload));
  ipcMain.handle('project:choose', (event, payload) => routeTrustedIpc(event, 'project:choose', payload));
  ipcMain.handle('codex:check', (event, payload) => routeTrustedIpc(event, 'codex:check', payload));
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

app.on('before-quit', (event) => {
  if (pendingCodexCheck) {
    event.preventDefault();
    void pendingCodexCheck.finally(() => app.quit());
    return;
  }
  database?.close();
});

app.on('web-contents-created', (_event, contents) => contents.setWindowOpenHandler(() => ({ action: 'deny' })));
app.on('browser-window-created', (_event, window) => window.webContents.on('will-navigate', (event, target) => { if (!isAllowedNavigation(target, rendererUrl)) event.preventDefault(); }));
