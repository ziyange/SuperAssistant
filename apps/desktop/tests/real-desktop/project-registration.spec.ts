import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import Database from 'better-sqlite3';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';

// Playwright requires object destructuring even when no built-in fixture is used.
// eslint-disable-next-line no-empty-pattern
test('registers a disposable Project through real IPC and reloads it after restart', async ({}, info) => {
  const profile = info.outputPath('isolated-appdata');
  const project = info.outputPath('disposable-project');
  mkdirSync(profile, { recursive: true });
  mkdirSync(project, { recursive: true });
  const gitEnv: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && !/^GIT_/i.test(entry[0])));
  gitEnv.GIT_CONFIG_NOSYSTEM = '1';
  gitEnv.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
  execFileSync('git', ['init', '--quiet', project], { windowsHide: true, env: gitEnv });
  const bootstrap = info.outputPath('test-bootstrap.cjs');
  writeFileSync(bootstrap, `const { app } = require('electron');
const { pathToFileURL } = require('node:url');
app.setPath('userData', process.env.SA_TEST_PROFILE);
import(pathToFileURL(process.env.SA_TEST_MAIN).href).catch(() => app.exit(1));\n`);
  const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  env.SA_TEST_PROFILE = profile;
  env.SA_TEST_MAIN = resolve('apps/desktop/dist/main/main.js');
  delete env.ELECTRON_RUN_AS_NODE;
  let application: ElectronApplication | undefined;
  async function launch() {
    const app = await electron.launch({ args: [bootstrap], env, timeout: 30_000 });
    application = app;
    const window = await app.firstWindow({ timeout: 30_000 });
    const actualData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'));
    expect(actualData.toLowerCase()).toBe(profile.toLowerCase());
    return { app, window };
  }
  try {
    const first = await launch();
    await expect(first.window.getByRole('heading', { name: 'Super Assistant' })).toBeVisible();
    await first.app.evaluate(({ dialog }, selected) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
    }, project);
    await first.window.getByRole('button', { name: 'Project Center' }).click();
    await first.window.getByRole('region', { name: 'Project Center' }).getByRole('button', { name: 'Add Project' }).click();
    await expect(first.window.getByRole('heading', { name: 'disposable-project' })).toBeVisible();
    await expect(first.window.getByText('Project registered.')).toBeVisible();
    await first.app.close();
    application = undefined;
    const second = await launch();
    await second.window.getByRole('button', { name: 'Project Center' }).click();
    await expect(second.window.getByRole('heading', { name: 'disposable-project' })).toBeVisible();
    await expect(second.window.getByRole('heading', { name: 'disposable-project' })).toHaveCount(1);
  } finally {
    await application?.close();
  }
});

// Playwright requires an object-pattern first parameter.
// eslint-disable-next-line no-empty-pattern
test('discovers a fake App Server and reviews the exact Proposal without authorization', async ({}, info) => {
  if (process.platform !== 'win32') throw new Error('The fake executable fixture requires Windows.');
  const profile = info.outputPath('isolated-appdata');
  const project = info.outputPath('disposable-project');
  mkdirSync(profile, { recursive: true });
  mkdirSync(project, { recursive: true });
  const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const gitEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !/^GIT_/i.test(key)));
  gitEnv.GIT_CONFIG_NOSYSTEM = '1';
  gitEnv.GIT_CONFIG_GLOBAL = 'NUL';
  execFileSync('git', ['init', '--quiet', project], { windowsHide: true, env: gitEnv });
  execFileSync('git', ['-C', project, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-m', 'fixture'], { windowsHide: true, env: gitEnv });
  const executable = info.outputPath('fake-codex.exe');
  const compiler = resolve(process.env.SystemRoot ?? 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + executable, resolve('apps/desktop/tests/real-desktop/fake-codex.cs')], { windowsHide: true });
  const bootstrap = info.outputPath('test-bootstrap.cjs');
  writeFileSync(bootstrap, `const { app } = require('electron');
const { pathToFileURL } = require('node:url');
app.setPath('userData', process.env.SA_TEST_PROFILE);
import(pathToFileURL(process.env.SA_TEST_MAIN).href).catch(() => app.exit(1));\n`);
  env.SA_TEST_PROFILE = profile;
  env.SA_TEST_MAIN = resolve('apps/desktop/dist/main/main.js');
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({ args: [bootstrap], env, timeout: 30_000 });
  try {
    const window = await app.firstWindow({ timeout: 30_000 });
    expect((await app.evaluate(({ app: instance }) => instance.getPath('userData'))).toLowerCase()).toBe(profile.toLowerCase());
    await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, project);
    await window.getByRole('button', { name: 'Project Center' }).click();
    await window.getByRole('region', { name: 'Project Center' }).getByRole('button', { name: 'Add Project' }).click();
    await expect(window.getByRole('heading', { name: 'disposable-project' })).toBeVisible();
    await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, executable);
    await window.getByRole('button', { name: 'Agent Center' }).click();
    await window.getByRole('button', { name: 'Check Codex' }).click();
    await expect(window.getByRole('region', { name: 'Agent Center' }).getByText('AVAILABLE', { exact: true })).toBeVisible({ timeout: 20_000 });
    await window.getByRole('button', { name: 'Project Center' }).click();
    await window.getByRole('button', { name: 'Assign Codex to disposable-project' }).click();
    await expect(window.getByText('Codex configured for Project.')).toBeVisible();
    await window.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Super Assistant' }).click();
    await window.getByLabel('Project for proposal').selectOption({ label: 'disposable-project' });
    await window.getByLabel('Goal', { exact: true }).fill('Update the disposable documentation');
    await window.getByLabel('Acceptance criterion').fill('The documentation includes a concise summary');
    const reviewPromise = app.waitForEvent('window', { timeout: 20_000 });
    await window.getByRole('button', { name: 'Create and review draft' }).click();
    const review = await reviewPromise;
    await expect(review.locator('pre')).toContainText('Update the disposable documentation');
    await expect(review.locator('pre')).toContainText('The documentation includes a concise summary');
    await review.getByRole('link', { name: 'I reviewed these fields' }).click();
    await expect(window.getByText('Reviewed only: no execution has been authorized or started.')).toBeVisible();
  } finally { await app.close(); }
  const database = new Database(resolve(profile, 'super-assistant.sqlite'), { readonly: true, fileMustExist: true });
  try {
    expect(database.prepare('SELECT COUNT(*) AS count FROM authorization_grants').get()).toEqual({ count: 0 });
    expect(database.prepare('SELECT COUNT(*) AS count FROM execution_attempts').get()).toEqual({ count: 0 });
  } finally { database.close(); }
  expect(execFileSync('git', ['-C', project, 'status', '--porcelain'], { encoding: 'utf8', windowsHide: true, env: gitEnv })).toBe('');
  const checkProcess = '$p = Get-Process -Name fake-codex -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $env:SA_FAKE_PATH }; if ($p) { exit 1 }; exit 0';
  execFileSync('powershell.exe', ['-NoProfile', '-Command', checkProcess], { windowsHide: true, env: { ...env, SA_FAKE_PATH: executable } });
});
