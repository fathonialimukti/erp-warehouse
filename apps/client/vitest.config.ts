import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      headless: true,
      viewport: { width: 1440, height: 900 },
    },
    include: ["src/tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/tests/setup.browser.ts"],
    threads: false,
    isolate: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main.tsx",
        "src/tests/**",
        "src-tauri/**",
        "**/*.config.ts",
        "**/*.test.{ts,tsx}",
        "**/*.spec.ts",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        statements: 70,
        branches: 65,
      },
    },
  },
});
