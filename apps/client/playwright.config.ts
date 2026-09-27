import { defineConfig } from "@playwright/test";
import { devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  timeout: 30000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  maxWorkers: process.env.CI ? 4 : undefined,
  forbidOnly: process.env.CI ? true : false,

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:10011",
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 20000,
    screenshot: "only-on-failure",
    trace: process.env.CI ? "on-first-retry" : "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: process.env.CI
      ? "bun run build && bun run preview --host 0.0.0.0 --port 10011"
      : "bun run dev",
    url: "http://localhost:10011",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      VITE_TRPC_URL: process.env.VITE_TRPC_URL || "http://localhost:10012",
    },
  },

  globalSetup: "./src/tests/e2e/global-setup.ts",
  globalTeardown: "./src/tests/e2e/global-teardown.ts",

  reporter: [
    ["list"],
    ["html", { outputFolder: "./blob-report", open: "never" }],
    ["junit", { outputFile: "./test-results/junit.xml" }],
  ],
});
