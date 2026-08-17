import { FG_PAL, FG_IN_PAL, RAW_PAL, RAW_OUT_PAL, RMA_RATE, INTERNAL_EVENTS, MONTHS_12 } from "../catalog/plans.js";
import { seedByKey, pickQty } from "../rng.js";
import { allSkuRows } from "../catalog/skus.js";

export type PlanEventType = "RECEIVING" | "SHIPMENT" | "RMA" | "RTS" | "DISPOSAL" | "LOSS" | "FOUND" | "TRANSFER";

export interface PlanEvent {
  type: PlanEventType;
  skuCode: string;
  warehouseCode: string;
  monthIndex: number; // 0..11
  dayOffset: number;  // 1..28
  cartons: number;    // whole cartons; pallet-grain guaranteed in this builder
  pallets: number;
}

const perPallet = new Map(allSkuRows().map((s) => [s.code, s.packagesPerPallet]));

/** Pure, deterministic: same inputs → same events. */
export function buildPlan(): PlanEvent[] {
  const events: PlanEvent[] = [];

  for (let m = 0; m < MONTHS_12.length; m++) {
    // WH01: raw RECEIVING from Asian suppliers (day 1-15)
    for (const [raw, pal] of Object.entries(RAW_PAL)) {
      const n = pal[m]!;
      if (n <= 0) continue;
      events.push({
        type: "RECEIVING", skuCode: raw, warehouseCode: "WH01",
        monthIndex: m, dayOffset: pickQty(seedByKey(`rcv-${raw}-${m}`), 1, 15),
        cartons: n * perPallet.get(raw)!, pallets: n,
      });
    }
    // WH01: raw SHIPMENT to contract assembler (day 16-26)
    for (const [raw, pal] of Object.entries(RAW_OUT_PAL)) {
      const n = pal[m]!;
      if (n <= 0) continue;
      events.push({
        type: "SHIPMENT", skuCode: raw, warehouseCode: "WH01",
        monthIndex: m, dayOffset: pickQty(seedByKey(`asm-${raw}-${m}`), 16, 26),
        cartons: n * perPallet.get(raw)!, pallets: n,
      });
    }
    // WH03: FG RECEIVING from contract assembler (day 1-15)
    for (const [fg, pal] of Object.entries(FG_IN_PAL)) {
      const n = pal[m]!;
      if (n <= 0) continue;
      events.push({
        type: "RECEIVING", skuCode: fg, warehouseCode: "WH03",
        monthIndex: m, dayOffset: pickQty(seedByKey(`fgin-${fg}-${m}`), 1, 15),
        cartons: n * perPallet.get(fg)!, pallets: n,
      });
    }
    // WH03: FG SHIPMENT to EU distributors (day 16-26)
    for (const [fg, pal] of Object.entries(FG_PAL)) {
      const n = pal[m]!;
      if (n <= 0) continue;
      events.push({
        type: "SHIPMENT", skuCode: fg, warehouseCode: "WH03",
        monthIndex: m, dayOffset: pickQty(seedByKey(`ship-${fg}-${m}`), 16, 26),
        cartons: n * perPallet.get(fg)!, pallets: n,
      });
    }
    // RMA (Jan = m4): 2% of Dec FG outbound → WH02
    if (m === 4) {
      for (const [fg, pal] of Object.entries(FG_PAL)) {
        const n = Math.max(1, Math.round(pal[3]! * RMA_RATE));
        events.push({
          type: "RMA", skuCode: fg, warehouseCode: "WH02",
          monthIndex: m, dayOffset: pickQty(seedByKey(`rma-${fg}`), 3, 15),
          cartons: n * perPallet.get(fg)!, pallets: n,
        });
      }
    }
  }

  // --- Curated internal/adjust events ---
  for (const e of INTERNAL_EVENTS) {
    events.push({
      type: e.type, skuCode: e.skuCode, warehouseCode: e.warehouseCode,
      monthIndex: e.monthIndex, dayOffset: e.dayOffset,
      cartons: e.pallets * perPallet.get(e.skuCode)!, pallets: e.pallets,
    });
  }

  return events;
}