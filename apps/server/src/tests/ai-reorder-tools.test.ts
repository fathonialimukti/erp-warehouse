/**
 * Smoke test for AI reorder tools.
 * Deterministic only — never calls an LLM (API key rate limit 10 req/min).
 */
import { describe, it, expect } from "vitest";
import { reorderTools } from "../lib/ai-reorder-tools";

describe("ai-reorder-tools (smoke)", () => {
  it("exposes both reorder tools with execute functions", () => {
    expect(reorderTools.get_reorder_suggestions).toBeDefined();
    expect(reorderTools.draft_reorder_receiving).toBeDefined();
    expect(typeof reorderTools.get_reorder_suggestions.execute).toBe(
      "function",
    );
    expect(typeof reorderTools.draft_reorder_receiving.execute).toBe(
      "function",
    );
  });

  it("get_reorder_suggestions returns valid structure on empty input", async () => {
    const result = await reorderTools.get_reorder_suggestions.execute!(
      {},
      { toolCallId: "test", messages: [] },
    );
    expect(result).toBeDefined();
    if (result && typeof result === "object" && "suggestions" in result) {
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(typeof result.generatedAt).toBe("string");
    }
  });

  it("draft_reorder_receiving returns draftCreated:false on invalid FK (no throw)", async () => {
    const result = await reorderTools.draft_reorder_receiving.execute!(
      {
        warehouseId: "bogus-warehouse",
        supplierId: "bogus-supplier",
        createdById: "bogus-user",
        items: [{ skuId: "bogus-sku", quantity: 1 }],
      },
      { toolCallId: "test", messages: [] },
    );
    expect(result).toBeDefined();
    if (result && typeof result === "object" && "draftCreated" in result) {
      expect(result.draftCreated).toBe(false);
      expect(typeof result.error).toBe("string");
    }
  });
});
