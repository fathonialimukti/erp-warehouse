import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  matchesPattern,
} from "../catalog/rbac.js";

/**
 * Catalog-vs-code drift guard.
 *
 * `01-access.ts` does `DELETE FROM permissions` and re-inserts exactly
 * `PERMISSIONS`, so a permission string a router checks but the catalog omits
 * is un-grantable: `hasPermission` 403s for EVERY role, System Admin included,
 * and the client nav hides the page. That is exactly how `backup@read` and
 * `assistant@use` broke a fresh `db:seed` — they existed only as a test
 * upsert. This test fails the moment a router asks for a permission nobody
 * seeded.
 */
// src/prisma/seed/tests/ → src/
const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../");
const ROUTERS_DIR = join(SRC_DIR, "routers");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return extname(path) === ".ts" ? [path] : [];
  });

/**
 * `hasPermission("a@b")` and `hasPermission(SOME_CONST)` both appear. Literal
 * strings are collected directly; the one indirection in the tree
 * (`ASSISTANT_PERMISSION` in src/lib/ai-page-context.ts) is resolved by
 * following the imported constant, so a router cannot smuggle in an unseeded
 * permission through a variable.
 */
const CONST_PERMISSIONS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const file of [
    ...sourceFiles(ROUTERS_DIR),
    ...sourceFiles(join(SRC_DIR, "lib")),
  ]) {
    const content = readFileSync(file, "utf8");
    for (const m of content.matchAll(
      /(?:export\s+)?const\s+([A-Z0-9_]*PERMISSION[A-Z0-9_]*)\s*(?::[^=]+)?=\s*"([^"]+)"/g,
    )) {
      out[m[1]!] = m[2]!;
    }
  }
  return out;
})();

const referenced = (): { permission: string; file: string }[] => {
  const found: { permission: string; file: string }[] = [];
  for (const file of sourceFiles(ROUTERS_DIR)) {
    const content = readFileSync(file, "utf8");
    for (const m of content.matchAll(/hasPermission\(\s*"([^"]+)"/g)) {
      found.push({ permission: m[1]!, file });
    }
    for (const m of content.matchAll(/hasPermission\(\s*([A-Z0-9_]+)\s*\)/g)) {
      const resolved = CONST_PERMISSIONS[m[1]!];
      expect(
        resolved,
        `${file} calls hasPermission(${m[1]}) but that constant is not a "resource@action" literal anywhere in src/`,
      ).toBeDefined();
      if (resolved) found.push({ permission: resolved, file });
    }
  }
  return found;
};

const catalogNames = new Set(PERMISSIONS.map((p) => p.name));

describe("RBAC catalog", () => {
  it("is non-empty and free of duplicate permission names", () => {
    expect(PERMISSIONS.length).toBeGreaterThan(100);
    const names = PERMISSIONS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("covers every permission a router's hasPermission() call requires", () => {
    const used = referenced();
    // Sanity: the scan must actually see the tree, or this guard is vacuous.
    expect(used.length).toBeGreaterThan(50);
    const missing = used
      .filter((u) => !catalogNames.has(u.permission))
      .map((u) => `${u.permission} (${u.file})`);
    expect(
      missing,
      `routers require permissions the seed catalog does not create — every role would 403, System Admin included:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("grants System Admin every catalog permission", () => {
    const adminPatterns = ROLE_PERMISSIONS["System Admin"]!;
    const notGranted = PERMISSIONS.filter(
      (p) => !matchesPattern(p.name, adminPatterns),
    ).map((p) => p.name);
    expect(notGranted).toEqual([]);
  });

  it("keeps backup@* admin-only (destructive, leaks password hashes)", () => {
    for (const permission of [
      "backup@read",
      "backup@create",
      "backup@restore",
      "backup@delete",
    ]) {
      expect(catalogNames.has(permission)).toBe(true);
      const granted = Object.entries(ROLE_PERMISSIONS)
        .filter(([, patterns]) =>
          matchesPattern(permission, patterns as string[]),
        )
        .map(([roleName]) => roleName);
      expect(granted, `${permission} granted to ${granted.join(", ")}`).toEqual(
        ["System Admin"],
      );
    }
  });

  it("grants assistant@use to every role that can log in", () => {
    const without = ROLES.map((r) => r.name).filter(
      (name) => !matchesPattern("assistant@use", ROLE_PERMISSIONS[name]!),
    );
    expect(without).toEqual([]);
  });

  it("only lists ROLE_PERMISSIONS keys that are real roles", () => {
    const roleNames = new Set(ROLES.map((r) => r.name));
    expect(
      Object.keys(ROLE_PERMISSIONS).filter((name) => !roleNames.has(name)),
    ).toEqual([]);
  });
});
