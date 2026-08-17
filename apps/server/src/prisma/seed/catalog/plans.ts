/** 12 rolling months, index 0 = earliest. Keep the order! */
export const MONTHS_12 = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"];

/** FG outbound demand to EU distributors (pallets/month). Q4 peak (Nov,Dec), Jan trough. */
export const FG_PAL: Record<string, number[]> = {
  "FG-SPRK-MINI": [8, 10, 22, 30, 6, 6, 8, 9, 10, 8, 6, 9],
  "FG-SPRK-PRO": [5, 8, 18, 24, 4, 5, 5, 6, 7, 5, 4, 6],
  "FG-EARB-AIR": [10, 14, 35, 40, 9, 9, 10, 12, 14, 10, 8, 12],
  "FG-EARB-SPORT": [6, 8, 20, 22, 4, 5, 5, 6, 7, 5, 4, 6],
  "FG-HUB-HOME": [4, 5, 11, 14, 3, 3, 3, 4, 4, 3, 2, 4],
  "FG-CHG-GA": [4, 6, 15, 18, 3, 3, 4, 4, 5, 4, 3, 4],
};

/** FG inbound from the contract assembler (pallets/month). Front-loaded to build Q4 buffer. */
export const FG_IN_PAL: Record<string, number[]> = {
  "FG-SPRK-MINI": [14, 16, 24, 30, 8, 6, 8, 9, 10, 8, 6, 9],
  "FG-SPRK-PRO": [10, 12, 20, 24, 5, 5, 5, 6, 7, 5, 4, 6],
  "FG-EARB-AIR": [18, 20, 38, 40, 10, 9, 10, 12, 14, 10, 8, 12],
  "FG-EARB-SPORT": [10, 12, 22, 22, 5, 5, 5, 6, 7, 5, 4, 6],
  "FG-HUB-HOME": [6, 7, 12, 14, 3, 3, 3, 4, 4, 3, 2, 4],
  "FG-CHG-GA": [6, 8, 16, 18, 3, 3, 4, 4, 5, 4, 3, 4],
};

/** RAW inbound from Asian suppliers (pallets/month), smoothed (purchasing leads production). */
export const RAW_PAL: Record<string, number[]> = {
  "RAW-PCM": [18, 20, 22, 24, 18, 18, 20, 22, 24, 22, 18, 20],
  "RAW-BATT": [14, 15, 16, 18, 14, 14, 15, 16, 18, 16, 14, 15],
  "RAW-DISP": [8, 9, 10, 12, 8, 8, 9, 10, 12, 10, 8, 9],
  "RAW-CHG": [8, 9, 10, 12, 8, 8, 9, 10, 12, 10, 8, 9],
  "RAW-PCB": [10, 11, 12, 14, 10, 10, 11, 12, 14, 12, 10, 11],
  "RAW-PLASTIC": [6, 7, 8, 9, 6, 6, 7, 8, 9, 8, 6, 7],
  "RAW-CABLE": [16, 18, 20, 22, 16, 16, 18, 20, 22, 20, 16, 18],
  "RAW-DRIVER": [7, 8, 9, 10, 7, 7, 8, 9, 10, 9, 7, 8],
  "RAW-CARTON": [3, 3, 4, 4, 3, 3, 4, 4, 4, 4, 3, 4],
};

/** RAW outbound to the contract assembler (pallets/month). = RAW_PAL − 1 per SKU for months 0–5 (buffer build), = RAW_PAL for months 6–11. */
export const RAW_OUT_PAL: Record<string, number[]> = (() => {
  const out: Record<string, number[]> = {};
  for (const [raw, arr] of Object.entries(RAW_PAL)) {
    out[raw] = arr.map((n, m) => (m <= 5 ? Math.max(0, n - 1) : n));
  }
  return out;
})();

/** Days from planned arrival to dock at Rotterdam (lead time to warehouse). */
export const SUPPLIER_LEAD_DAYS: Record<string, number> = {
  "RAW-PCM": 24, "RAW-BATT": 21, "RAW-DISP": 26, "RAW-CHG": 18,
  "RAW-PCB": 20, "RAW-PLASTIC": 24, "RAW-CABLE": 16, "RAW-DRIVER": 22, "RAW-CARTON": 14,
};

/** Jan returns = X% of Dec outbound volume per FG (pallets, rounded). */
export const RMA_RATE = 0.02;

/** Curated small internal/adjustment events (pallet grain). LOSS day 27 = after all m0 WH01 flows. */
export const INTERNAL_EVENTS: { type: "RTS" | "DISPOSAL" | "LOSS" | "FOUND" | "TRANSFER";
  skuCode: string; warehouseCode: string; monthIndex: number; dayOffset: number; pallets: number }[] = [
  { type: "RTS", skuCode: "RAW-DISP", warehouseCode: "WH01", monthIndex: 5, dayOffset: 12, pallets: 2 },
  { type: "DISPOSAL", skuCode: "FG-EARB-SPORT", warehouseCode: "WH02", monthIndex: 4, dayOffset: 18, pallets: 1 },
  { type: "LOSS", skuCode: "RAW-PLASTIC", warehouseCode: "WH01", monthIndex: 0, dayOffset: 27, pallets: 1 },
  { type: "FOUND", skuCode: "RAW-CABLE", warehouseCode: "WH01", monthIndex: 7, dayOffset: 8, pallets: 1 },
  { type: "TRANSFER", skuCode: "RAW-DISP", warehouseCode: "WH01", monthIndex: 9, dayOffset: 6, pallets: 1 },
];