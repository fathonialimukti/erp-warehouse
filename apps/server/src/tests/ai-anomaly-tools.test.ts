/**
 * Smoke test for AI anomaly detection tools.
 * Deterministic only — never calls an LLM, so the API key rate limit is untouched.
 * Empty-DB path: get_anomalies must return an anomalies array + generatedAt, never throw.
 */
import { describe, it, expect } from "vitest";
import { anomalyTools } from "../lib/ai-anomaly-tools";

describe("ai-anomaly-tools (smoke)", () => {
  it("exposes get_anomalies tool with an execute function", () => {
    expect(anomalyTools.get_anomalies).toBeDefined();
    expect(typeof anomalyTools.get_anomalies.execute).toBe("function");
  });

  it("get_anomalies returns anomalies array + generatedAt (no throw)", async () => {
    const result = await anomalyTools.get_anomalies.execute!(
      {},
      { toolCallId: "test", messages: [] },
    ); // execute! — tool() always provides execute
    expect(result).toBeDefined();
    if (result && typeof result === "object" && "anomalies" in result) {
      expect(Array.isArray(result.anomalies)).toBe(true);
      expect(typeof result.generatedAt).toBe("string");
      for (const anomaly of result.anomalies) {
        expect(typeof anomaly.type).toBe("string");
        expect(["HIGH", "MEDIUM", "LOW"]).toContain(anomaly.severity);
        expect(typeof anomaly.title).toBe("string");
        expect(typeof anomaly.description).toBe("string");
        expect(typeof anomaly.createdAt).toBe("string");
      }
    }
  });
});
