import { defineConfig } from '@playwright/test';
const port = process.env.PLAYWRIGHT_PORT || '4173';
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
  timeout: 60000,
});
