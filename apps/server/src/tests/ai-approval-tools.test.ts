/**
 * Smoke test for AI approval narrative tools.
 * Ponytail minimum: deterministic paths only — no LLM calls, no API key usage.
 */
import { describe, it, expect } from "vitest";
import { approvalTools } from "../lib/ai-approval-tools";

const EMPTY_CTX = { toolCallId: "test", messages: [] };

describe("ai-approval-tools (smoke)", () => {
  it("exposes both tools with execute functions", () => {
    expect(typeof approvalTools.get_approval_queue.execute).toBe("function");
    expect(typeof approvalTools.get_transaction_summary.execute).toBe(
      "function",
    );
  });

  it("get_approval_queue returns an items array (empty DB is fine)", async () => {
    const result = await approvalTools.get_approval_queue.execute!(
      {},
      EMPTY_CTX,
    );
    expect(result).toBeDefined();
    if (result && typeof result === "object" && "items" in result) {
      expect(Array.isArray(result.items)).toBe(true);
    }
  });

  it("get_transaction_summary with a bogus id returns summary: null (no throw)", async () => {
    const result = await approvalTools.get_transaction_summary.execute!(
      { transactionType: "receivingTransaction", id: "bogus" },
      EMPTY_CTX,
    );
    expect(result).toBeDefined();
    if (result && typeof result === "object" && "summary" in result) {
      expect(result.summary).toBeNull();
    }
  });
});
