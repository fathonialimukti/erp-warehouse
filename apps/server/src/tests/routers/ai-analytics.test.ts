/**
 * Smoke test for the AI Analytics router.
 * Deterministic only — never calls the LLM (API key rate limit 10 req/min).
 * Tests the SQL validation gate and the graceful error paths.
 */
import { describe, it, expect } from "vitest";
import { validateReadOnlySql } from "../../lib/ai-db-tools";

describe("ai-analytics (smoke)", () => {
  it("validateReadOnlySql rejects write/DDL statements", () => {
    expect(validateReadOnlySql("DROP TABLE skus").valid).toBe(false);
    expect(validateReadOnlySql("DELETE FROM skus").valid).toBe(false);
    expect(validateReadOnlySql("UPDATE skus SET name = 'x'").valid).toBe(false);
    expect(
      validateReadOnlySql("INSERT INTO skus (name) VALUES ('x')").valid,
    ).toBe(false);
  });

  it("validateReadOnlySql accepts simple SELECT", () => {
    const result = validateReadOnlySql("SELECT id, name FROM skus LIMIT 10");
    expect(result.valid).toBe(true);
  });

  it("validateReadOnlySql rejects multi-statement queries", () => {
    const result = validateReadOnlySql("SELECT 1; SELECT 2");
    expect(result.valid).toBe(false);
  });

  it("validateReadOnlySql rejects comment-based injection", () => {
    const result = validateReadOnlySql("SELECT 1 -- comment");
    expect(result.valid).toBe(false);
  });
});
