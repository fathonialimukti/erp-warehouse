import { FG_PAL, RAW_PAL, RMA_RATE, INTERNAL_EVENTS, MONTHS_12 } from '../catalog/plans.js';
import { seedByKey, pickQty } from '../rng.js';
import { allSkuRows } from '../catalog/skus.js';

export type PlanEventType = 'RECEIVING' | 'SHIPMENT' | 'RMA' | 'RTS' | 'DISPOSAL' | 'LOSS' | 'FOUND' | 'TRANSFER';

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
    // --- FG outbound (SHIPMENT) from WH03 ---
    for (const [fg, pal] of Object.entries(FG_PAL)) {
      const n = pal[m]!;
      if (n <= 0) continue;
      const cartons = n * perPallet.get(fg)!;
      events.push({
        type: 'SHIPMENT', skuCode: fg, warehouseCode: 'WH03',
        monthIndex: m, dayOffset: pickQty(seedByKey(`ship-${fg}-${m}`), 2, 26),
        cartons, pallets: n,
      });
    }

    // --- RAW inbound (RECEIVING) to WH01 — dayOffset matches lead-time arrival window ---
    for (const [raw, pal] of Object.entries(RAW_PAL)) {
      const n = pal[m]!;
      if (n <= 0) continue;
      const cartons = n * perPallet.get(raw)!;
      events.push({
        type: 'RECEIVING', skuCode: raw, warehouseCode: 'WH01',
        monthIndex: m, dayOffset: pickQty(seedByKey(`rcv-${raw}-${m}`), 1, 20),
        cartons, pallets: n,
      });
    }

    // --- RMA (Jan spike = RMA_RATE × Dec SHIPMENT pallets) ---
    if (m === 4) {
      for (const [fg, pal] of Object.entries(FG_PAL)) {
        const dec = pal[3]!;
        const n = Math.max(1, Math.round(dec * RMA_RATE));
        events.push({
          type: 'RMA', skuCode: fg, warehouseCode: 'WH02',
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