import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps/desktop/tests/e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  webServer: {
    command: 'cd /d apps\\desktop && ..\\..\\node_modules\\.bin\\vite.cmd --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  }
});
