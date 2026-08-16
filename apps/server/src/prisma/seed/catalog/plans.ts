/** 12 rolling months, index 0 = earliest. Keep the order! */
export const MONTHS_12 = ['2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08'];

/** FG outbound demand (pallets/month). Q4 peak (Nov,Dec), Jan trough, summer dip. */
export const FG_PAL: Record<string, number[]> = {
  'FG-SPRK-MINI': [30, 40, 90, 120, 25, 25, 30, 35, 40, 30, 25, 35],
  'FG-SPRK-PRO':  [20, 30, 70, 95, 15, 18, 20, 25, 28, 20, 16, 24],
  'FG-EARB-AIR':  [40, 55, 140, 160, 35, 35, 40, 50, 55, 40, 30, 50],
  'FG-EARB-SPORT':[25, 30, 80, 90, 15, 18, 20, 25, 28, 20, 15, 25],
  'FG-HUB-HOME':  [14, 20, 45, 55, 10, 10, 12, 14, 16, 12, 8, 14],
  'FG-CHG-GA':    [16, 22, 60, 70, 10, 12, 14, 16, 18, 14, 10, 16],
};

/** RAW inbound (pallets per month, driven by FG build + lead-time offset). */
export const RAW_PAL: Record<string, number[]> = {
  'RAW-PCM':   [80, 100, 200, 240, 70, 70, 80, 90, 100, 80, 60, 90],
  'RAW-BATT':  [60, 70, 130, 150, 50, 50, 60, 65, 70, 55, 45, 60],
  'RAW-DISP':  [30, 40, 90, 120, 35, 35, 40, 45, 50, 40, 30, 40],
  'RAW-CHG':   [30, 40, 90, 120, 35, 30, 35, 40, 45, 35, 25, 40],
  'RAW-PCB':   [40, 50, 110, 150, 55, 50, 55, 60, 65, 50, 40, 55],
  'RAW-PLASTIC':[20, 25, 60, 80, 30, 25, 30, 32, 35, 28, 20, 30],
  'RAW-CABLE':  [60, 75, 150, 220, 80, 75, 85, 95, 100, 85, 70, 80],
  'RAW-DRIVER': [25, 35, 80, 110, 35, 30, 35, 40, 45, 35, 30, 40],
  'RAW-CARTON': [10, 12, 30, 35, 12, 12, 14, 15, 16, 14, 10, 15],
};

/** Days from planned arrival to dock at Rotterdam (lead time to warehouse). */
export const SUPPLIER_LEAD_DAYS: Record<string, number> = {
  'RAW-PCM': 24, 'RAW-BATT': 21, 'RAW-DISP': 26, 'RAW-CHG': 18,
  'RAW-PCB': 20, 'RAW-PLASTIC': 24, 'RAW-CABLE': 16, 'RAW-DRIVER': 22, 'RAW-CARTON': 14,
};

/** Jan returns = X% of Dec outbound volume per FG (pallets, rounded). */
export const RMA_RATE = 0.02;

/** Curated small internal/adjustment events (pallet grain). */
export const INTERNAL_EVENTS: { type: 'RTS' | 'DISPOSAL' | 'LOSS' | 'FOUND' | 'TRANSFER';
  skuCode: string; warehouseCode: string; monthIndex: number; dayOffset: number; pallets: number }[] = [
  { type: 'RTS', skuCode: 'RAW-DISP', warehouseCode: 'WH01', monthIndex: 5, dayOffset: 12, pallets: 2 },
  { type: 'DISPOSAL', skuCode: 'FG-EARB-SPORT', warehouseCode: 'WH02', monthIndex: 2, dayOffset: 18, pallets: 1 },
  { type: 'LOSS', skuCode: 'RAW-PLASTIC', warehouseCode: 'WH01', monthIndex: 0, dayOffset: 10, pallets: 1 },
  { type: 'FOUND', skuCode: 'RAW-CABLE', warehouseCode: 'WH01', monthIndex: 7, dayOffset: 8, pallets: 1 },
  { type: 'TRANSFER', skuCode: 'RAW-DISP', warehouseCode: 'WH01', monthIndex: 9, dayOffset: 6, pallets: 1 },
];