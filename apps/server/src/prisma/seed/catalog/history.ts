import { MONTHS_12 } from "./plans.js";

/**
 * Back-history for the transaction domains the plan in `plans.ts` does not
 * cover (purchase orders, WIP issues, and the small adjustment domains).
 *
 * The monthly plan deliberately drains every document it creates, so a plain
 * seed left purchase orders, WIP issues, stock counts and the loss/found/rma/
 * rts/transfer domains either empty or holding a single hand-written row. This
 * catalog is the extra twelve months of paperwork that makes a recruiter's
 * click-through land on populated tables.
 *
 * Every row here is executed by `steps/10-history.ts` through the same helpers
 * the routers call (document numbering, approval data, putaway/dispatch
 * reservation, stock movements, PO receipting).
 */

/**
 * Marks every document, line and purchase order this catalog owns. Doubles as
 * the idempotency key: a re-run matches on this prefix and replaces the
 * history instead of doubling it, and it reads naturally in the UI.
 */
export const HISTORY_NOTE_PREFIX = "Cycle history —";

export type PlannedApproval = "APPROVED" | "PROPOSED" | "DRAFT";

/** `YYYY-MM-DD` inside the 12-month window, from a plan month index. */
export interface HistoryDate {
  monthIndex: number;
  day: number;
}

export interface PurchaseOrderLine {
  skuCode: string;
  /** Ordered pallets; the PO quantity is derived in pallet grain (cartons). */
  pallets: number;
}

export interface PurchaseOrderPlan extends HistoryDate {
  status: "CLOSED" | "RECEIVING" | "APPROVED" | "PROPOSED" | "DRAFT";
  /** Warehouse the order is placed into: WH01 for raw, WH03 for finished goods. */
  warehouseCode: "WH01" | "WH03";
  /** One supplier per order — every line must resolve to the same supplier. */
  supplierCode: string;
  lines: PurchaseOrderLine[];
  /**
   * Lines received on the (single) goods-receipt document. Defaults to every
   * line for a CLOSED order, to the first line for a RECEIVING order, and to
   * nothing for an order that is not on the dock yet.
   */
  receivedLines?: PurchaseOrderLine[];
  note: string;
}

/**
 * 23 purchase orders spread over the window: 10 closed (fully received), 4
 * receiving (partially received), 5 approved but not yet delivered, 2 proposed
 * and 2 still being written. Receipts land on the delivery date derived from
 * the supplier lead time and never exceed the ordered quantity — the quantity
 * the receiving router would actually post. From month 6 the plan receives
 * exactly what it ships, so these goods receipts are also what gives the
 * adjustment and component-issue documents their outbound headroom.
 */
export const PURCHASE_ORDERS: PurchaseOrderPlan[] = [
  {
    monthIndex: 0,
    day: 5,
    status: "CLOSED",
    warehouseCode: "WH01",
    supplierCode: "SUP-FORMOSA",
    lines: [
      { skuCode: "RAW-PCM", pallets: 2 },
      { skuCode: "RAW-DISP", pallets: 1 },
    ],
    receivedLines: [
      { skuCode: "RAW-PCM", pallets: 2 },
      { skuCode: "RAW-DISP", pallets: 1 },
    ],
    note: "Q4 PCM and display top-up for the audio line.",
  },
  {
    monthIndex: 0,
    day: 18,
    status: "RECEIVING",
    warehouseCode: "WH01",
    supplierCode: "SUP-BRIGHT",
    lines: [
      { skuCode: "RAW-PCB", pallets: 2 },
      { skuCode: "RAW-CARTON", pallets: 1 },
    ],
    receivedLines: [{ skuCode: "RAW-PCB", pallets: 2 }],
    note: "PCBA replenishment; the carton line is still on the water.",
  },
  {
    monthIndex: 1,
    day: 8,
    status: "CLOSED",
    warehouseCode: "WH01",
    supplierCode: "SUP-LIKANG",
    lines: [{ skuCode: "RAW-BATT", pallets: 2 }],
    receivedLines: [{ skuCode: "RAW-BATT", pallets: 2 }],
    note: "Cell pack replenishment for the wearables line.",
  },
  {
    monthIndex: 1,
    day: 22,
    status: "APPROVED",
    warehouseCode: "WH01",
    supplierCode: "SUP-PENANG",
    lines: [
      { skuCode: "RAW-PLASTIC", pallets: 2 },
      { skuCode: "RAW-GRANU", pallets: 1 },
    ],
    note: "Approved, awaiting booking with the forwarder.",
  },
  {
    monthIndex: 2,
    day: 6,
    status: "RECEIVING",
    warehouseCode: "WH03",
    supplierCode: "SUP-ASSEMBLER",
    lines: [
      { skuCode: "FG-EARB-AIR", pallets: 3 },
      { skuCode: "FG-SPRK-MINI", pallets: 2 },
    ],
    receivedLines: [{ skuCode: "FG-EARB-AIR", pallets: 3 }],
    note: "Assembler over-production shipped against this order.",
  },
  {
    monthIndex: 3,
    day: 9,
    status: "APPROVED",
    warehouseCode: "WH01",
    supplierCode: "SUP-FORMOSA",
    lines: [{ skuCode: "RAW-PCM", pallets: 3 }],
    note: "Approved, forwarder confirmation pending.",
  },
  {
    monthIndex: 3,
    day: 24,
    status: "CLOSED",
    warehouseCode: "WH01",
    supplierCode: "SUP-HCMC",
    lines: [{ skuCode: "RAW-CHG", pallets: 2 }],
    receivedLines: [{ skuCode: "RAW-CHG", pallets: 2 }],
    note: "Charger replenishment, closed on the final pallet.",
  },
  {
    monthIndex: 4,
    day: 7,
    status: "RECEIVING",
    warehouseCode: "WH03",
    supplierCode: "SUP-ASSEMBLER",
    lines: [
      { skuCode: "FG-SPRK-PRO", pallets: 2 },
      { skuCode: "FG-HUB-HOME", pallets: 2 },
    ],
    receivedLines: [{ skuCode: "FG-SPRK-PRO", pallets: 2 }],
    note: "Speaker batch received against the standing order.",
  },
  {
    monthIndex: 4,
    day: 20,
    status: "DRAFT",
    warehouseCode: "WH01",
    supplierCode: "SUP-CHEMTIDE",
    lines: [{ skuCode: "RAW-SOLV", pallets: 2 }],
    note: "Draft — quantities not confirmed with the supplier yet.",
  },
  {
    monthIndex: 5,
    day: 8,
    status: "CLOSED",
    warehouseCode: "WH01",
    supplierCode: "SUP-PENANG",
    lines: [
      { skuCode: "RAW-PLASTIC", pallets: 2 },
      { skuCode: "RAW-CARTON", pallets: 1 },
    ],
    receivedLines: [
      { skuCode: "RAW-PLASTIC", pallets: 2 },
      { skuCode: "RAW-CARTON", pallets: 1 },
    ],
    note: "Housing and carton replenishment, fully received.",
  },
  {
    monthIndex: 5,
    day: 21,
    status: "APPROVED",
    warehouseCode: "WH01",
    supplierCode: "SUP-CHANGSHA",
    lines: [{ skuCode: "RAW-DRIVER", pallets: 2 }],
    note: "Approved, supplier acknowledged the lead time.",
  },
  {
    monthIndex: 6,
    day: 10,
    status: "RECEIVING",
    warehouseCode: "WH01",
    supplierCode: "SUP-FLEX",
    lines: [
      { skuCode: "RAW-CABLE", pallets: 3 },
      { skuCode: "RAW-DRIVER", pallets: 2 },
    ],
    receivedLines: [{ skuCode: "RAW-CABLE", pallets: 3 }],
    note: "Cable reels booked in; driver units still on the water.",
  },
  {
    monthIndex: 6,
    day: 23,
    status: "CLOSED",
    warehouseCode: "WH03",
    supplierCode: "SUP-ASSEMBLER",
    lines: [{ skuCode: "FG-EARB-SPORT", pallets: 2 }],
    receivedLines: [{ skuCode: "FG-EARB-SPORT", pallets: 2 }],
    note: "Sport earbuds batch, closed on receipt.",
  },
  {
    monthIndex: 7,
    day: 9,
    status: "CLOSED",
    warehouseCode: "WH01",
    supplierCode: "SUP-BRIGHT",
    lines: [{ skuCode: "RAW-PCB", pallets: 3 }],
    receivedLines: [{ skuCode: "RAW-PCB", pallets: 3 }],
    note: "PCBA replenishment for the hub line.",
  },
  {
    monthIndex: 7,
    day: 20,
    status: "APPROVED",
    warehouseCode: "WH01",
    supplierCode: "SUP-FORMOSA",
    lines: [{ skuCode: "RAW-DISP", pallets: 2 }],
    note: "Approved, not yet shipped by the supplier.",
  },
  {
    monthIndex: 8,
    day: 8,
    status: "PROPOSED",
    warehouseCode: "WH01",
    supplierCode: "SUP-PENANG",
    lines: [
      { skuCode: "RAW-GRANU", pallets: 2 },
      { skuCode: "RAW-POW", pallets: 1 },
    ],
    note: "Submitted for approval, waiting on the purchasing manager.",
  },
  {
    monthIndex: 8,
    day: 11,
    status: "CLOSED",
    warehouseCode: "WH01",
    supplierCode: "SUP-LIKANG",
    lines: [{ skuCode: "RAW-BATT", pallets: 3 }],
    receivedLines: [{ skuCode: "RAW-BATT", pallets: 3 }],
    note: "Cell pack replenishment, closed on receipt.",
  },
  {
    monthIndex: 9,
    day: 8,
    status: "CLOSED",
    warehouseCode: "WH01",
    supplierCode: "SUP-FORMOSA",
    lines: [{ skuCode: "RAW-PCM", pallets: 3 }],
    receivedLines: [{ skuCode: "RAW-PCM", pallets: 3 }],
    note: "PCM modules for the Q1 audio build.",
  },
  {
    monthIndex: 10,
    day: 9,
    status: "APPROVED",
    warehouseCode: "WH03",
    supplierCode: "SUP-ASSEMBLER",
    lines: [{ skuCode: "FG-HUB-HOME", pallets: 2 }],
    note: "Approved, assembler scheduling the batch.",
  },
  {
    monthIndex: 10,
    day: 21,
    status: "CLOSED",
    warehouseCode: "WH01",
    supplierCode: "SUP-PENANG",
    lines: [{ skuCode: "RAW-PLASTIC", pallets: 3 }],
    receivedLines: [{ skuCode: "RAW-PLASTIC", pallets: 3 }],
    note: "Housing replenishment, closed on receipt.",
  },
  {
    monthIndex: 11,
    day: 7,
    status: "PROPOSED",
    warehouseCode: "WH01",
    supplierCode: "SUP-CHEMTIDE",
    lines: [{ skuCode: "RAW-SOLV", pallets: 1 }],
    note: "Submitted for approval.",
  },
  {
    monthIndex: 11,
    day: 12,
    status: "RECEIVING",
    warehouseCode: "WH01",
    supplierCode: "SUP-HCMC",
    lines: [
      { skuCode: "RAW-CHG", pallets: 3 },
      { skuCode: "RAW-SOLV", pallets: 1 },
    ],
    receivedLines: [{ skuCode: "RAW-CHG", pallets: 3 }],
    note: "Chargers booked in; the solvent top-up is still outstanding.",
  },
  {
    monthIndex: 11,
    day: 21,
    status: "DRAFT",
    warehouseCode: "WH01",
    supplierCode: "SUP-CHANGSHA",
    lines: [{ skuCode: "RAW-DRIVER", pallets: 1 }],
    note: "Draft — still being priced.",
  },
];

export type HistoryType =
  | "WIP_ISSUE"
  | "LOSS"
  | "FOUND"
  | "RMA_RECEIPT"
  | "RETURN_TO_SUPPLIER"
  | "SUBINVENTORY_TRANSFER"
  | "WIP_COMPLETION"
  | "DISPOSAL";

export interface HistoryDoc extends HistoryDate {
  type: HistoryType;
  status: PlannedApproval;
  warehouseCode: "WH01" | "WH02" | "WH03";
  /** One pallet per document: adjustments are written off pallet by pallet. */
  pallets: number;
  /** Free-text reason the domain's form collects (loss reason, return reason…). */
  reason: string;
  note: string;
  /**
   * SKU the document draws on. Every row names one explicitly: the step only
   * reads what the operator would have picked, never searches for a SKU that
   * happens to have stock.
   */
  skuCode: string;
}

/**
 * Adjustment + component-issue history.
 *
 * The outbound rows are the load-bearing part. An OUT pallet needs one pallet
 * of headroom in months 0-5 (the plan builds a one-pallet buffer per SKU
 * there) and needs a same-month goods receipt in months 6-11 (where the plan
 * receives exactly what it ships), so the monthly balance computed by
 * `07-balances.ts` never goes negative. Proposed and draft rows move nothing.
 */
/**
 * Two component issues per month, one pallet each.
 *
 * The first six months can draw on any raw SKU: the plan receives one pallet
 * more than it ships, which is the buffer these issues eat into. From month 6
 * the plan receives exactly what it ships, so an issue may only name the SKU
 * that landed on a purchase order in that same month — three pallets of
 * headroom, which the month's loss and supplier return also draw on.
 */
const WIP_ISSUE_SKUS: ReadonlyArray<readonly [string, string]> = [
  ["RAW-PCM", "RAW-PCB"],
  ["RAW-BATT", "RAW-DRIVER"],
  ["RAW-POW", "RAW-DISP"],
  ["RAW-CHG", "RAW-CARTON"],
  ["RAW-CABLE", "RAW-DRIVER"],
  ["RAW-PCM", "RAW-BATT"],
  ["RAW-CABLE", "RAW-CABLE"],
  ["RAW-PCB", "RAW-PCB"],
  ["RAW-BATT", "RAW-BATT"],
  ["RAW-PCM", "RAW-PCM"],
  ["RAW-PLASTIC", "RAW-PLASTIC"],
  ["RAW-CHG", "RAW-CHG"],
];

/**
 * Finished goods booked in off the line: `[sku, warehouse, monthIndex, day]`.
 *
 * Inbound, so unlike the disposal rows these can never close a month negative.
 * Spread over both finished-goods warehouses — the assembler's output lands in
 * whichever one the picking route draws from that week.
 */
const WIP_COMPLETION_PLAN: ReadonlyArray<
  readonly [string, "WH02" | "WH03", number, number]
> = [
  ["FG-SPRK-MINI", "WH02", 0, 12],
  ["FG-EARB-AIR", "WH03", 0, 26],
  ["FG-SPRK-PRO", "WH03", 1, 14],
  ["FG-HUB-HOME", "WH02", 1, 27],
  ["FG-CHG-GA", "WH02", 2, 11],
  ["FG-EARB-SPORT", "WH03", 2, 24],
  ["FG-SPRK-MINI", "WH03", 3, 13],
  ["FG-EARB-AIR", "WH02", 3, 25],
  ["FG-HUB-HOME", "WH03", 4, 12],
  ["FG-SPRK-PRO", "WH02", 4, 26],
  ["FG-CHG-GA", "WH03", 5, 15],
  ["FG-EARB-SPORT", "WH02", 5, 27],
  ["FG-SPRK-MINI", "WH02", 6, 10],
  ["FG-EARB-AIR", "WH03", 6, 23],
  ["FG-HUB-HOME", "WH02", 7, 16],
  ["FG-SPRK-PRO", "WH03", 7, 28],
  ["FG-CHG-GA", "WH02", 8, 12],
  ["FG-EARB-SPORT", "WH03", 8, 25],
  ["FG-SPRK-MINI", "WH03", 9, 14],
  ["FG-EARB-AIR", "WH02", 9, 26],
  ["FG-HUB-HOME", "WH03", 10, 11],
  ["FG-SPRK-PRO", "WH02", 10, 24],
  ["FG-CHG-GA", "WH03", 11, 13],
  ["FG-EARB-SPORT", "WH02", 11, 20],
  ["FG-SPRK-MINI", "WH02", 11, 26],
];

/**
 * Scrapped stock: `[sku, warehouse, monthIndex, day, reason, note]`.
 *
 * Balance-critical, so read the comment on the `HISTORY_DOCS` rows below before
 * moving one: an outbound movement costs the SKU a full pallet in cartons and
 * the shortfall compounds into later months.
 */
const DISPOSAL_PLAN: ReadonlyArray<
  readonly [string, "WH01" | "WH02" | "WH03", number, number, string, string]
> = [
  // WH03 — finished goods: transit damage, failed QA, expired retail stock.
  [
    "FG-EARB-AIR",
    "WH03",
    0,
    19,
    "dropped in transit",
    "AirBuds carton burst in the container — scrap raised with the carrier.",
  ],
  [
    "FG-SPRK-MINI",
    "WH03",
    1,
    22,
    "failed QA sample",
    "Mini speaker failed the drop test at goods-out — batch quarantined and scrapped.",
  ],
  [
    "FG-SPRK-PRO",
    "WH03",
    2,
    18,
    "end of life",
    "Pro speaker superseded by the autumn refresh — remaining stock written down.",
  ],
  [
    "FG-EARB-SPORT",
    "WH03",
    3,
    24,
    "cosmetic damage",
    "SportBuds cases scuffed in the dispatch lane — cosmetic scrap only.",
  ],
  [
    "FG-SPRK-MINI",
    "WH03",
    4,
    15,
    "failed QA sample",
    "Two Mini units failed the acoustic check — pallet scrapped after teardown.",
  ],
  [
    "FG-EARB-AIR",
    "WH03",
    5,
    23,
    "water damage",
    "Sprinkler leak over bay 3 — affected AirBuds pallets scrapped.",
  ],
  [
    "FG-EARB-SPORT",
    "WH03",
    6,
    17,
    "end of life",
    "SportBuds colourway discontinued — stock cleared before the next buy.",
  ],
  [
    "FG-HUB-HOME",
    "WH03",
    1,
    26,
    "customer return",
    "SmartHub returned dead and outside warranty — refurb window missed.",
  ],
  [
    "FG-SPRK-MINI",
    "WH03",
    8,
    20,
    "failed QA sample",
    "Mini lot failed the humidity soak test — written off with the QA report.",
  ],
  [
    "FG-EARB-AIR",
    "WH03",
    9,
    12,
    "dropped in transit",
    "Forklift clipped the pallet through the racking — cartons unsalvageable.",
  ],
  [
    "FG-SPRK-PRO",
    "WH03",
    7,
    25,
    "cosmetic damage",
    "Pro grille scuffing failed the photo audit — discounted rather than shipped.",
  ],
  [
    "FG-CHG-GA",
    "WH03",
    5,
    27,
    "failed QA sample",
    "GaN charger showed early thermal cutoff — lot scrapped at goods-out.",
  ],
  [
    "FG-HUB-HOME",
    "WH03",
    10,
    24,
    "end of life",
    'SmartHub 8" firmware end-of-life — stock cleared before the successor.',
  ],
  // WH01 — raw components: contamination, damage, supplier quality escapes.
  [
    "RAW-CHG",
    "WH01",
    3,
    19,
    "contamination",
    "Charger crates water-marked by a leaking sprinkler head — quarantined lot scrapped.",
  ],
  [
    "RAW-PCM",
    "WH01",
    7,
    22,
    "moisture ingress",
    "PCM modules past their humidity limit after the aisle 7 leak.",
  ],
  [
    "RAW-PCB",
    "WH01",
    4,
    16,
    "failed incoming QA",
    "PCBA lot rejected at incoming inspection — burnt vias across the tray.",
  ],
  [
    "RAW-CABLE",
    "WH01",
    6,
    18,
    "damaged during handling",
    "Flex cable drums crushed by a mis-parked reach truck.",
  ],
  [
    "RAW-BATT",
    "WH01",
    7,
    27,
    "supplier quality escape",
    "Battery lot flagged for swelling — returned pack scrapped on arrival.",
  ],
  [
    "RAW-PLASTIC",
    "WH01",
    6,
    25,
    "mould defects",
    "Housing sacks with heavy flash — rejected at the line, scrapped.",
  ],
  [
    "RAW-PCM",
    "WH01",
    11,
    12,
    "moisture ingress",
    "Late PCM receipt still damp — sealed lot scrapped rather than kitted.",
  ],
  [
    "RAW-PCB",
    "WH01",
    10,
    21,
    "failed incoming QA",
    "Second PCBA lot failed solder-bridge inspection.",
  ],
  [
    "RAW-CABLE",
    "WH01",
    11,
    23,
    "damaged during handling",
    "Cable drums cut through by a pallet corner during the re-slot.",
  ],
  [
    "RAW-BATT",
    "WH01",
    9,
    17,
    "supplier quality escape",
    "Battery cells with high self-discharge — scrap with the supplier claim.",
  ],
  [
    "RAW-CHG",
    "WH01",
    11,
    25,
    "contamination",
    "Charger crates with oil residue from the adjacent chemical bay.",
  ],
  [
    "RAW-PLASTIC",
    "WH01",
    11,
    26,
    "mould defects",
    "Final housing lot of the run rejected at the line.",
  ],
  [
    "RAW-BATT",
    "WH01",
    9,
    26,
    "end of life",
    "Discontinued cell chemistry — residual stock written off.",
  ],
  [
    "RAW-PLASTIC",
    "WH01",
    11,
    9,
    "cosmetic damage",
    "Sacks scuffed beyond retail spec — downgraded, not scrapped.",
  ],
];

export const HISTORY_DOCS: HistoryDoc[] = [
  // ─── WIP issues (raw components to the production line, WH01) ──────────────
  ...WIP_ISSUE_SKUS.flatMap(([first, second], monthIndex): HistoryDoc[] => {
    const [year, month] = MONTHS_12[monthIndex]!.split("-");
    return [
      {
        type: "WIP_ISSUE",
        monthIndex,
        day: 4 + (monthIndex % 3),
        status: "APPROVED",
        warehouseCode: "WH01",
        pallets: 1,
        skuCode: first,
        reason: "production issue",
        note: `Issued to line ${monthIndex % 2 === 0 ? "A" : "B"} for work order WO-${year}-${month}01.`,
      },
      {
        type: "WIP_ISSUE",
        monthIndex,
        day: 11 + (monthIndex % 3),
        status: "APPROVED",
        warehouseCode: "WH01",
        pallets: 1,
        skuCode: second,
        reason: "production issue",
        note: `Kitted to work order WO-${year}-${month}02 ahead of the build.`,
      },
    ];
  }),
  // Three waiting on the supervisor and one still being written: the approval
  // queue reads as a live one, not a warehouse that stopped working.
  {
    type: "WIP_ISSUE",
    monthIndex: 10,
    day: 19,
    status: "PROPOSED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-CARTON",
    reason: "production issue",
    note: "Carton kit for the launch build — awaiting supervisor approval.",
  },
  {
    type: "WIP_ISSUE",
    monthIndex: 11,
    day: 6,
    status: "PROPOSED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-DRIVER",
    reason: "production issue",
    note: "Driver units for the rework batch — awaiting supervisor approval.",
  },
  {
    type: "WIP_ISSUE",
    monthIndex: 11,
    day: 15,
    status: "PROPOSED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-SOLV",
    reason: "production issue",
    note: "Solvents topped up for the coating cell — awaiting supervisor approval.",
  },
  {
    type: "WIP_ISSUE",
    monthIndex: 11,
    day: 24,
    status: "DRAFT",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-POW",
    reason: "production issue",
    note: "Draft — quantities not confirmed by planning.",
  },

  // ─── Loss (administrative write-off) ─────────────────────────────────────
  {
    type: "LOSS",
    monthIndex: 0,
    day: 27,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-CARTON",
    reason: "water damage in rack aisle 7",
    note: "Cartons crushed by a leaking roof panel — written off after inspection.",
  },
  {
    type: "LOSS",
    monthIndex: 2,
    day: 21,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-PLASTIC",
    reason: "damaged during handling",
    note: "Housing pallet dropped by the forklift during putaway.",
  },
  {
    type: "LOSS",
    monthIndex: 2,
    day: 24,
    status: "APPROVED",
    warehouseCode: "WH03",
    pallets: 1,
    skuCode: "FG-EARB-SPORT",
    reason: "damaged during handling",
    note: "Finished goods crushed in the dispatch lane — scrap with the carrier claim.",
  },
  {
    type: "LOSS",
    monthIndex: 4,
    day: 26,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-POW",
    reason: "short-shipped by supplier",
    note: "Power supply lot arrived two cartons short — supplier credit note raised.",
  },
  {
    type: "LOSS",
    monthIndex: 6,
    day: 25,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-CABLE",
    reason: "cycle count variance",
    note: "Cable reel not found during the zone recount — written off as shrinkage.",
  },
  {
    type: "LOSS",
    monthIndex: 7,
    day: 28,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-PCB",
    reason: "cycle count variance",
    note: "PCBA pallet missing after the recount — shrinkage written off.",
  },
  {
    type: "LOSS",
    monthIndex: 8,
    day: 23,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-PCM",
    reason: "packaging breach",
    note: "Seal broken and cartons swollen — quarantined and written off.",
  },
  {
    type: "LOSS",
    monthIndex: 9,
    day: 26,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-BATT",
    reason: "damaged during handling",
    note: "Cell pack pallet dropped in the narrow aisle — written off after QC.",
  },
  {
    type: "LOSS",
    monthIndex: 10,
    day: 27,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-PLASTIC",
    reason: "cycle count variance",
    note: "Housing pallet unaccounted for at month-end count.",
  },
  {
    type: "LOSS",
    monthIndex: 11,
    day: 5,
    status: "DRAFT",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-SOLV",
    reason: "cycle count variance",
    note: "Draft — variance still being reconciled with the solvent store.",
  },

  // ─── Found (unexplained stock discovery) ──────────────────────────────────
  {
    type: "FOUND",
    monthIndex: 1,
    day: 17,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-SOLV",
    reason: "cycle count recovery",
    note: "Solvents found in the returns staging bay and put back into stock.",
  },
  {
    type: "FOUND",
    monthIndex: 3,
    day: 19,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-PLASTIC",
    reason: "returned from dispatch dock",
    note: "Pallet pulled back from the dock after the truck was cancelled.",
  },
  {
    type: "FOUND",
    monthIndex: 5,
    day: 22,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-DISP",
    reason: "mislabelled pallet",
    note: "Displays found behind the racking with the wrong label — re-labelled and booked in.",
  },
  {
    type: "FOUND",
    monthIndex: 7,
    day: 14,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-CABLE",
    reason: "cycle count recovery",
    note: "Cable reel located in the overflow slot during the zone recount.",
  },
  {
    type: "FOUND",
    monthIndex: 9,
    day: 12,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-PCM",
    reason: "returned from dispatch dock",
    note: "PCM modules returned by the assembler after a quality hold.",
  },
  {
    type: "FOUND",
    monthIndex: 10,
    day: 9,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-BATT",
    reason: "mislabelled pallet",
    note: "Cell packs found in the wrong rack position — booked back into stock.",
  },
  {
    type: "FOUND",
    monthIndex: 11,
    day: 17,
    status: "PROPOSED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-GRANU",
    reason: "cycle count recovery",
    note: "Granulate found behind the rack upright — awaiting supervisor approval.",
  },

  // ─── RMA (customer returns into the quality hold, WH02) ───────────────────
  {
    type: "RMA_RECEIPT",
    monthIndex: 1,
    day: 24,
    status: "APPROVED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-EARB-AIR",
    reason: "DOA unit reported by distributor",
    note: "Distributor returned a dead-on-arrival pair; quarantine pending RMA.",
  },
  {
    type: "RMA_RECEIPT",
    monthIndex: 3,
    day: 9,
    status: "APPROVED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-SPRK-MINI",
    reason: "damaged in transit",
    note: "Carton crushed on the distributor's truck — booked into the hold area.",
  },
  {
    type: "RMA_RECEIPT",
    monthIndex: 4,
    day: 13,
    status: "APPROVED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-SPRK-PRO",
    reason: "wrong item shipped",
    note: "Distributor sent back the wrong model — booked in and re-dispatched.",
  },
  {
    type: "RMA_RECEIPT",
    monthIndex: 5,
    day: 16,
    status: "APPROVED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-HUB-HOME",
    reason: "DOA unit reported by distributor",
    note: "Hub reported dead on arrival — held for the distributor's RMA label.",
  },
  {
    type: "RMA_RECEIPT",
    monthIndex: 6,
    day: 19,
    status: "APPROVED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-CHG-GA",
    reason: "intermittent charging fault",
    note: "Charger returned after a repeat fault — booked into the quality hold.",
  },
  {
    type: "RMA_RECEIPT",
    monthIndex: 7,
    day: 23,
    status: "APPROVED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-EARB-AIR",
    reason: "customer changed mind",
    note: "Opened but unused pair returned within the 30-day window.",
  },
  {
    type: "RMA_RECEIPT",
    monthIndex: 8,
    day: 11,
    status: "APPROVED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-SPRK-MINI",
    reason: "damaged in transit",
    note: "Distributor reported a punctured box — booked in for re-inspection.",
  },
  {
    type: "RMA_RECEIPT",
    monthIndex: 9,
    day: 18,
    status: "APPROVED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-EARB-SPORT",
    reason: "DOA unit reported by distributor",
    note: "Sport pair failed on the first charge — held for the RMA shipment.",
  },
  {
    type: "RMA_RECEIPT",
    monthIndex: 10,
    day: 20,
    status: "APPROVED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-CHG-GA",
    reason: "intermittent charging fault",
    note: "Second charger return for the same batch — flagged to the assembler.",
  },
  {
    type: "RMA_RECEIPT",
    monthIndex: 11,
    day: 18,
    status: "PROPOSED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-HUB-HOME",
    reason: "DOA unit reported by distributor",
    note: "Hub return received at the gate — awaiting supervisor approval.",
  },

  // ─── Return to supplier (defective lot back to Asia) ─────────────────────
  {
    type: "RETURN_TO_SUPPLIER",
    monthIndex: 1,
    day: 29,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-SOLV",
    reason: "quality issue — batch certificate mismatch",
    note: "Solvents returned to the supplier after the certificate of analysis failed QC.",
  },
  {
    type: "RETURN_TO_SUPPLIER",
    monthIndex: 3,
    day: 27,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-DRIVER",
    reason: "defective lot",
    note: "Driver IC batch failed the incoming test — returned for replacement.",
  },
  {
    type: "RETURN_TO_SUPPLIER",
    monthIndex: 4,
    day: 22,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-GRANU",
    reason: "packaging breach",
    note: "Two bags split in transit — returned on the next consolidated container.",
  },
  {
    type: "RETURN_TO_SUPPLIER",
    monthIndex: 5,
    day: 26,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-SOLV",
    reason: "defective lot",
    note: "Solvents failed the incoming test — returned to the supplier.",
  },
  {
    type: "RETURN_TO_SUPPLIER",
    monthIndex: 8,
    day: 24,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-BATT",
    reason: "quality issue — swollen cells",
    note: "Cell pack lot returned after the distributor reported swelling.",
  },
  {
    type: "RETURN_TO_SUPPLIER",
    monthIndex: 10,
    day: 18,
    status: "PROPOSED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-CABLE",
    reason: "defective lot",
    note: "Cable lot flagged by QC — awaiting supervisor approval before booking.",
  },
  {
    type: "RETURN_TO_SUPPLIER",
    monthIndex: 11,
    day: 10,
    status: "PROPOSED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-PLASTIC",
    reason: "packaging breach",
    note: "Housing batch returned — awaiting supervisor approval.",
  },
  {
    type: "RETURN_TO_SUPPLIER",
    monthIndex: 11,
    day: 19,
    status: "DRAFT",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-POW",
    reason: "defective lot",
    note: "Draft — waiting on the supplier's acceptance before submitting.",
  },

  // ─── Subinventory transfer (slot move, no stock change) ───────────────────
  {
    type: "SUBINVENTORY_TRANSFER",
    monthIndex: 0,
    day: 30,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-CARTON",
    reason: "slot optimization",
    note: "Empty carton pallets consolidated in the overflow slot.",
  },
  {
    type: "SUBINVENTORY_TRANSFER",
    monthIndex: 1,
    day: 8,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-CABLE",
    reason: "aisle rebalancing",
    note: "Cable reels moved to the ground-floor slot for the picking route.",
  },
  {
    type: "SUBINVENTORY_TRANSFER",
    monthIndex: 2,
    day: 12,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-PLASTIC",
    reason: "fast-mover consolidation",
    note: "Housings pulled forward next to the dispatch door.",
  },
  {
    type: "SUBINVENTORY_TRANSFER",
    monthIndex: 3,
    day: 19,
    status: "APPROVED",
    warehouseCode: "WH03",
    pallets: 1,
    skuCode: "FG-EARB-AIR",
    reason: "fast-mover consolidation",
    note: "Best sellers pulled forward for the picking route.",
  },
  {
    type: "SUBINVENTORY_TRANSFER",
    monthIndex: 4,
    day: 15,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-SOLV",
    reason: "quarantine staging",
    note: "Solvents moved to the ventilated holding slot pending QC release.",
  },
  {
    type: "SUBINVENTORY_TRANSFER",
    monthIndex: 6,
    day: 14,
    status: "APPROVED",
    warehouseCode: "WH03",
    pallets: 1,
    skuCode: "FG-SPRK-PRO",
    reason: "aisle rebalancing",
    note: "Speaker pallets re-slotted to shorten the travel distance.",
  },
  {
    type: "SUBINVENTORY_TRANSFER",
    monthIndex: 8,
    day: 21,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-PCM",
    reason: "cross-warehouse rebalancing",
    note: "PCM pallets relocated to the raw buffer before the line rebuild.",
  },
  {
    type: "SUBINVENTORY_TRANSFER",
    monthIndex: 10,
    day: 12,
    status: "APPROVED",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-DRIVER",
    reason: "slot optimization",
    note: "Driver ICs moved out of the overflow slot into the picking face.",
  },
  {
    type: "SUBINVENTORY_TRANSFER",
    monthIndex: 11,
    day: 8,
    status: "PROPOSED",
    warehouseCode: "WH03",
    pallets: 1,
    skuCode: "FG-CHG-GA",
    reason: "aisle rebalancing",
    note: "Charger pallets to be re-slotted next week — awaiting supervisor approval.",
  },
  {
    type: "SUBINVENTORY_TRANSFER",
    monthIndex: 11,
    day: 16,
    status: "DRAFT",
    warehouseCode: "WH01",
    pallets: 1,
    skuCode: "RAW-POW",
    reason: "slot optimization",
    note: "Draft — target slot not confirmed by the floor team.",
  },

  // ─── WIP completion (finished goods off the line into stock) ───────────────
  // Inbound, so it only ever adds stock: it cannot push a monthly balance
  // negative the way the disposal rows below do. Roughly two batches a month
  // from the contract assembler, split across the two finished-goods
  // warehouses, with the tail left in the approval states a live line produces.
  ...WIP_COMPLETION_PLAN.map(
    ([skuCode, warehouseCode, monthIndex, day], index): HistoryDoc => {
      const [year, month] = MONTHS_12[monthIndex]!.split("-");
      return {
        type: "WIP_COMPLETION",
        monthIndex,
        day,
        status: "APPROVED",
        warehouseCode,
        pallets: 1,
        skuCode,
        reason: "production output",
        note: `Line ${index % 2 === 0 ? "A" : "B"} batch ${year}-${month} booked in from work order WO-${year}-${month}${String(index + 1).padStart(2, "0")}.`,
      };
    },
  ),
  {
    type: "WIP_COMPLETION",
    monthIndex: 11,
    day: 17,
    status: "PROPOSED",
    warehouseCode: "WH02",
    pallets: 1,
    skuCode: "FG-SPRK-MINI",
    reason: "production output",
    note: "Final batch of the quarter booked in — awaiting supervisor approval.",
  },
  {
    type: "WIP_COMPLETION",
    monthIndex: 11,
    day: 21,
    status: "DRAFT",
    warehouseCode: "WH03",
    pallets: 1,
    skuCode: "FG-CHG-GA",
    reason: "production output",
    note: "Draft — pallet count not yet confirmed by the line.",
  },

  // ─── Disposal (scrapped stock) ────────────────────────────────────────────
  // Outbound, so each row is balance-critical: it subtracts the SKU's whole
  // pallet in cartons (its `packagesPerPallet`) from that month, and the
  // shortfall carries into every later month of the same series. Every entry
  // below sits where the series still has slack, so `07-balances.ts` keeps
  // closing non-negative. Re-slot the month if the catalog's volumes change.
  ...DISPOSAL_PLAN.map(
    (
      [skuCode, warehouseCode, monthIndex, day, reason, note],
      index,
    ): HistoryDoc => ({
      type: "DISPOSAL",
      monthIndex,
      day,
      status: index % 7 === 6 ? "PROPOSED" : "APPROVED",
      warehouseCode,
      pallets: 1,
      skuCode,
      reason,
      note,
    }),
  ),
];

export interface StockCountPlan extends HistoryDate {
  warehouseCode: "WH01" | "WH02" | "WH03";
  status: "COMPLETED" | "IN_PROGRESS";
  /** SKU family in scope: a count sheet is always a zone, never the warehouse. */
  skuCodes: string[];
  /** One line counted as 0 (shortage) and one counted as 2 (surplus). */
  shortageSkuCode: string | null;
  surplusSkuCode: string | null;
  isBlindCount: boolean;
  note: string;
}

/**
 * Five cycle counts: four signed off (two of them with a variance, which is
 * what generates the matching loss/found adjustments) and one still open, so
 * the queue is not a graveyard. Variants on the approved counts are the exact
 * rows the counting app would post — one missing pallet, one unexpected one.
 */
export const STOCK_COUNTS: StockCountPlan[] = [
  {
    monthIndex: 1,
    day: 28,
    warehouseCode: "WH01",
    status: "COMPLETED",
    skuCodes: ["RAW-PCM", "RAW-BATT"],
    shortageSkuCode: "RAW-BATT",
    surplusSkuCode: null,
    isBlindCount: true,
    note: "Monthly blind count of the PCM/battery face.",
  },
  {
    monthIndex: 3,
    day: 3,
    warehouseCode: "WH03",
    status: "COMPLETED",
    skuCodes: ["FG-EARB-AIR", "FG-EARB-SPORT"],
    shortageSkuCode: null,
    surplusSkuCode: "FG-EARB-AIR",
    isBlindCount: true,
    note: "Half-year count of the two earbud families.",
  },
  {
    monthIndex: 5,
    day: 29,
    warehouseCode: "WH01",
    status: "COMPLETED",
    skuCodes: ["RAW-CABLE", "RAW-DRIVER"],
    shortageSkuCode: null,
    surplusSkuCode: null,
    isBlindCount: true,
    note: "Cable and driver recount — clean sheet, no adjustments.",
  },
  {
    monthIndex: 8,
    day: 31,
    warehouseCode: "WH01",
    status: "COMPLETED",
    skuCodes: ["RAW-PLASTIC", "RAW-GRANU"],
    shortageSkuCode: null,
    surplusSkuCode: "RAW-GRANU",
    isBlindCount: true,
    note: "Housing and granulate zone count before the Q4 build.",
  },
  {
    monthIndex: 10,
    day: 17,
    warehouseCode: "WH03",
    status: "IN_PROGRESS",
    skuCodes: ["FG-CHG-GA", "FG-HUB-HOME"],
    shortageSkuCode: null,
    surplusSkuCode: null,
    isBlindCount: true,
    note: "Wall-to-wall count running since Tuesday, first aisle done.",
  },
];

/** Empty slots flagged for maintenance, as a fraction of each warehouse's tail. */
export const MAINTENANCE_PER_WAREHOUSE = 2;

/**
 * Purchase price per unit, in EUR. The SKU catalog carries no `standardCost`
 * and the supplier catalogue has no price list, so a purchase order would
 * otherwise show an order value of zero on every line.
 */
export const PO_UNIT_PRICE: Record<string, number> = {
  "RAW-PCM": 42.5,
  "RAW-BATT": 12.75,
  "RAW-DISP": 38.9,
  "RAW-CHG": 6.4,
  "RAW-PCB": 55.2,
  "RAW-PLASTIC": 3.15,
  "RAW-CABLE": 1.85,
  "RAW-DRIVER": 8.6,
  "RAW-CARTON": 0.95,
  "RAW-SOLV": 4.2,
  "RAW-GRANU": 2.35,
  "RAW-POW": 7.4,
  "FG-SPRK-MINI": 129,
  "FG-SPRK-PRO": 149.5,
  "FG-EARB-AIR": 89,
  "FG-EARB-SPORT": 95,
  "FG-HUB-HOME": 74,
  "FG-CHG-GA": 39,
};
