import { defineConfig } from '@playwright/test';

const port = process.env.DEMO_PORT || '4174';
export default defineConfig({
  testDir: './e2e',
  testMatch: 'demo.spec.ts',
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium' },
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  reporter: 'list',
  timeout: 60_000,
});
