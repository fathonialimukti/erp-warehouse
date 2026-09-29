import { describe, expect, it } from "vitest";
import { seedByKey, pickQty, pickUnit } from "../rng.js";

describe("rng", () => {
  it("is deterministic per key", () => {
    expect(seedByKey("plan")).toBe(seedByKey("plan"));
    expect(seedByKey("plan")).not.toBe(seedByKey("pallet"));
  });
  it("pickQty respects bounds", () => {
    for (let i = 0; i < 100; i++) {
      const v = pickQty(seedByKey("q") + i, 2, 9); // min..max inclusive
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(9);
    }
  });
  it("pickUnit stays in the array", () => {
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 100; i++)
      expect(arr).toContain(pickUnit(seedByKey("u") + i, arr));
  });
});
