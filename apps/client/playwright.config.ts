import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:10011',
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 20000,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:10011',
    reuseExistingServer: true,
    timeout: 30000,
  },
});