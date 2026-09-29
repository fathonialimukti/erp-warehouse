import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Regression guard: no credential-shaped literal may be committed under
 * `src/prisma/seed/`.
 *
 * A live Upstage key (`up_…`) was hardcoded in `seed/index.ts` and shipped to
 * `main` in commit 743420e, where the seeder wrote it straight into
 * `app_settings` on every `db:seed`. Rotation is the user's action; this test
 * is what stops the next one from being written in the first place.
 *
 * The patterns are deliberately shape-based (vendor prefix + length) rather
 * than the one leaked value, so any future provider key trips it too.
 */
const SEED_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

const SECRET_SHAPES: { name: string; pattern: RegExp }[] = [
  { name: "Upstage key (up_…)", pattern: /\bup_[A-Za-z0-9]{16,}\b/ },
  { name: "OpenAI-style key (sk-…)", pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
  { name: "AWS access key id (AKIA…)", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Google API key (AIza…)", pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { name: "Slack token (xox…)", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "private key block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  // Generic long hex blobs: JWT secrets and 32-byte random keys both look
  // like this. Needs a nearby secret-ish word so ULIDs/ids in the catalogs
  // (e.g. "01H…") do not match.
  {
    name: "secret-looking hex literal",
    pattern:
      /(?:secret|password|passwd|api[_-]?key|token|credential)\W{0,4}["'`][0-9a-f]{32,}["'`]/i,
  },
];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx", ".js", ".mjs", ".md", ".json"].includes(
      extname(path),
    )
      ? [path]
      : [];
  });

describe("seed tree carries no hardcoded credentials", () => {
  const files = sourceFiles(SEED_DIR).filter(
    // This file lists the shapes; matching its own patterns proves nothing.
    (path) => !path.endsWith("no-hardcoded-credentials.test.ts"),
  );

  it("finds source files to scan (guard is not silently empty)", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.endsWith(join("seed", "index.ts")))).toBe(true);
  });

  it.each(SECRET_SHAPES)("contains no $name", ({ pattern }) => {
    const hits: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      content.split("\n").forEach((line, i) => {
        if (pattern.test(line)) hits.push(`${file}:${i + 1}`);
      });
    }
    expect(hits, `credential-shaped literal at ${hits.join(", ")}`).toEqual([]);
  });
});
