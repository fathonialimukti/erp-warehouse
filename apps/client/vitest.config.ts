import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
      viewport: { width: 1440, height: 900 },
    },
    include: ['src/tests/**/*.browser.test.{ts,tsx}'],
    setupFiles: ['./src/tests/setup.browser.ts'],
    threads: false,
    isolate: false,
  },
});