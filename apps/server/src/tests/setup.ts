import "dotenv/config";
import { afterAll } from "vitest";

// Force a pool large enough for parallel test files. .env pins DB_POOL_MAX=1
// (remote DB), which starves the suite and causes "timeout exceeded when trying
// to connect". Override rather than fall back so the test DB is always usable.
process.env.DB_POOL_MAX = "10";
process.env.DB_POOL_IDLE_MS = process.env.DB_POOL_IDLE_MS ?? "10000";
process.env.DB_POOL_CONNECT_TIMEOUT_MS =
  process.env.DB_POOL_CONNECT_TIMEOUT_MS ?? "5000";

process.on("warning", (warning) => {
  if (
    warning.name === "DeprecationWarning" &&
    warning.message.includes(
      "Calling client.query() when the client is already executing a query",
    )
  ) {
    return;
  }
  console.warn(warning);
});

const { prisma } = await import("../lib/prisma.js");
const { sweepTestResidue } = await import("./helpers/cleanup.js");

// Runs after every test file (setupFiles are per-file), so a fixture that
// leaked in one file cannot survive into the next — and the shared dev database
// comes out of a run with no `TEST_*` rows. Cleanup must never be the reason a
// suite goes red, so it runs before the disconnect and never throws.
afterAll(async () => {
  await sweepTestResidue();
  await prisma.$disconnect();
});
