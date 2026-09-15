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
    // Every file shares one dev database, and backup.test.ts restores a
    // full-DB snapshot (delete-all + re-insert). Running files in parallel
    // races that destructive restore against other files' writes/cleanup,
    // producing FK violations and Postgres deadlocks. Serial files keep the
    // suite green at the same wall-clock cost (the contention timeouts cost
    // more than the lost parallelism).
    fileParallelism: false,
    server: {
      deps: {
        // Inline zod so vite-node loads its ESM entry. The CJS interop path
        // drops the named `z` export, breaking every schema import.
        inline: ['zod'],
      },
    },
  },
});
