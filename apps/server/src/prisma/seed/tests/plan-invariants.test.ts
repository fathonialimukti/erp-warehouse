import { describe, expect, it } from "vitest";
import { buildPlan } from "../steps/03-schedule.js";
import { FG_PAL, MONTHS_12 } from "../catalog/plans.js";
import { WAREHOUSE_CAPACITY } from "../config.js";

describe("plan invariants", () => {
  const plan = buildPlan();

  it("quantities are whole cartons in pallet grain", () => {
    for (const e of plan) {
      expect(e.cartons % e.pallets).toBe(0);
      expect(e.cartons).toBeGreaterThan(0);
    }
  });

  it("FG outbound per SKU matches FG_PAL", () => {
    for (const [fg, pal] of Object.entries(FG_PAL)) {
      for (let m = 0; m < MONTHS_12.length; m++) {
        const sum = plan
          .filter(
            (e) =>
              e.type === "SHIPMENT" && e.skuCode === fg && e.monthIndex === m,
          )
          .reduce((a, b) => a + b.pallets, 0);
        expect(sum).toBe(pal[m]!);
      }
    }
  });

  it("simulated on-hand never negative and never exceeds capacity", () => {
    // Execution order: within a month, IN-type events (RECEIVING/RMA/FOUND) run before
    // OUT-type events (SHIPMENT/RTS/DISPOSAL/LOSS) on the same day; TRANSFER is neutral.
    const inTypes = new Set(["RECEIVING", "RMA", "FOUND"]);
    const outTypes = new Set(["SHIPMENT", "RTS", "DISPOSAL", "LOSS"]);
    const order = (e: { type: string }) =>
      inTypes.has(e.type) ? 0 : outTypes.has(e.type) ? 2 : 1;
    const sorted = [...plan].sort(
      (a, b) =>
        a.monthIndex - b.monthIndex ||
        a.dayOffset - b.dayOffset ||
        order(a) - order(b),
    );
    const onHand = new Map<string, number>();
    for (const e of sorted) {
      const cur = onHand.get(e.warehouseCode) ?? 0;
      const delta = inTypes.has(e.type)
        ? e.pallets
        : outTypes.has(e.type)
          ? -e.pallets
          : 0;
      const nxt = cur + delta;
      expect(
        nxt,
        `${e.warehouseCode}@${MONTHS_12[e.monthIndex]} day ${e.dayOffset} ${e.type} ${e.skuCode}`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        nxt,
        `${e.warehouseCode}@${MONTHS_12[e.monthIndex]}`,
      ).toBeLessThanOrEqual(WAREHOUSE_CAPACITY[e.warehouseCode]!);
      onHand.set(e.warehouseCode, nxt);
    }
  });
});
