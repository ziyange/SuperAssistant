import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';

test('registers a disposable Project through real IPC and reloads it after restart', async (fixtures, info) => {
  void fixtures;
  const profile = info.outputPath('isolated-appdata');
  const project = info.outputPath('disposable-project');
  mkdirSync(profile, { recursive: true });
  mkdirSync(project, { recursive: true });
  execFileSync('git', ['init', '--quiet', project], { windowsHide: true, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' } });
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
