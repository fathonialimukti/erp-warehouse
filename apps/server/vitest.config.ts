import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts', 'src/prisma/seed/tests/**/*.test.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    watch: false,
    globals: false,
    threads: false,
    isolate: false,
    server: {
      deps: {
        // Inline zod so vite-node loads its ESM entry. The CJS interop path
        // drops the named `z` export, breaking every schema import.
        inline: ['zod'],
      },
    },
  },
});
