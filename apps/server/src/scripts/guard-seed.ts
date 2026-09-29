// Guards against accidental production seed runs.
// Usage: bun src/scripts/guard-seed.ts
if (process.env.NODE_ENV === "production") {
  console.error(
    "ERROR: db:seed cannot run in production. This would drop all data.",
  );
  process.exit(1);
}
console.log("Seed guard passed — not in production.");
