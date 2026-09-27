import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts", "src/prisma/seed/tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    setupFiles: ["./src/tests/setup.ts"],
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
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/prisma/generated/**",
        "src/prisma/seed.ts",
        "src/prisma/seed/**/*.ts",
        "src/scripts/**",
        "src/tests/**",
        "**/*.test.ts",
        "**/*.config.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
    server: {
      deps: {
        // Inline zod so vite-node loads its ESM entry. The CJS interop path
        // drops the named `z` export, breaking every schema import.
        inline: ["zod"],
      },
    },
  },
});
