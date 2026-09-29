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
    // `backup.test.ts` snapshots and then destructively restores EVERY table
    // (delete-all + re-insert), so its tests legitimately take many seconds
    // and, when they blow the 5s default, leave an in-flight restore running
    // that corrupts the next test's rows. 30s matches the restore router's own
    // "30s cap is too short for a large restore" reasoning.
    testTimeout: 30_000,
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
      // Thresholds track the coverage the suite actually achieves today
      // (measured 2026-09-29: lines 51.41%, statements 50.61%, functions
      // 49.78%, branches 39.20%), rounded down so a small regression fails
      // the job. They are a ratchet, not a target — raise them as real tests
      // land. Aspirational numbers would just make the workflow permanently
      // red, which trains everyone to ignore it.
      thresholds: {
        lines: 51,
        functions: 49,
        statements: 50,
        branches: 39,
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
