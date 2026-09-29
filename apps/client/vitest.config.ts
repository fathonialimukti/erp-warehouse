import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Unit tests only (pure logic: pagination, PDF generation). UI journeys live in
 * the Playwright suite — `bun run test:e2e` — which boots a real dev server, so
 * there is no browser-mode Vitest project here.
 *
 * No coverage gate on purpose. This file used to declare thresholds of
 * 70/70/70/65, but nothing ever passed `--coverage` for the client, so they
 * were decoration. The real numbers are far below them: with the three unit
 * test files here, `vitest run --coverage` measures lines 1.15%, statements
 * 1.08%, functions 0.48%, branches 0.43% across `src/**` — a threshold that
 * far from reality is not a ratchet, it is a wall (it would fail on the first
 * run) or, once rounded down to 0–1, noise that flips whenever a file is added.
 *
 * If client coverage ever becomes a real gate, copy the server's recipe in
 * apps/server/vitest.config.ts: declare `@vitest/coverage-v8` as a client
 * devDependency (it is only in the shared bun store today, not linked into this
 * package), add a `test:coverage` script, add a `client-coverage` job to
 * .github/workflows/coverage.yml, and set thresholds to the measured value
 * rounded down. The server's own comment makes the same point: aspirational
 * numbers just make the workflow permanently red, which trains everyone to
 * ignore it.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    include: ["src/tests/**/*.test.{ts,tsx}"],
    threads: false,
    isolate: false,
  },
});
