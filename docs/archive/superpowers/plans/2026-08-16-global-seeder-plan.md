# Nexus Electronics Campus Seeder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the faker-driven seed monolith with a deterministic, clustered, research-grounded 12-month seed for the "Nexus Electronics BV" international campus (Rotterdam) using the existing 3 warehouses + 696 storage locations — no schema changes.

**Architecture:** `apps/server/src/prisma/seed.ts` becomes a thin entry re-exporting the new clustered `apps/server/src/prisma/seed/` module (index → config/rng → catalog → scheduled steps → invariant checks). All material volumes come from curated typed-literal tables; a seeded LCG (mulberry32) only picks row identities and day-of-week dispatch slots. Nothing random.

**Tech Stack:** Bun, TypeScript (strict), Prisma 7 (`@prisma/client` generated at `src/prisma/generated`), existing `lib/document-number.ts` + `lib/pallet-number.ts`, vitest for seeder unit tests. **No new dependencies. Faker removed from the seed path.**

## Global Constraints

- No Prisma schema changes. Location rows untouched. Warehouse rows: **only `address` edited** (3 rows) — names, codes, capacities, ids stay.
- Zero `faker` imports in `seed/`. Zero `Math.random()`. Determinism: same env → same DB (modulo ULID ids).
- Units reconcile: quantity always `pallets × packagesPerPallet × quantityPerPackage`. No negative stock; occupancy ≤ warehouse capacity at all times.
- Document numbers: `TX_CODE/WH-code/MM/YYYY/0000` via `getNextDocumentNumber`. Pallet numbers: `YYMMDDXXXX` via `getNextPalletNumber` inside a transaction.
- WIP_COMPLETION = 0 docs, WIP_ISSUE = 0 docs (campus has no kitting). All 8 other types populated.
- Config knobs preserved: `SEED_MONTHS` (12), `SEED_SEED` (LCG seed), `SEED_SKIP_RESET`. `prisma.config.ts` points at `src/prisma/seed.ts` (kept as entry).
- Existing router tests import `../helpers/seed.js` — never `prisma/seed.ts` — unaffected.
- Files edited via VS Code edit tools only; shell only for run commands (`bun run db:seed`, `bun test`).

## File Structure

```
apps/server/src/prisma/
  seed.ts                       # KEPT as entry: `export * from './seed/index.js'` + main() invocation
  seed/
    index.ts                    # CLI: env, order of steps, summary table
    config.ts                   # constants: campus info, WH cap map, ratio config
    rng.ts                      # mulberry32 + per-domain seeds
    catalog/
      warehouses.ts             # 3 rows: addresses only (Rotterdam)
      users.ts                  # ~12 users with roles
      partners.ts               # suppliers (9 fictional), carriers (real), distributors (8 fictional)
      skus.ts                   # 9 raw + 6 FG SKUs, packing specs, EUR/GMA pallets
      plans.ts                  # monthly demand curves + inbound lead-time offsets
    lib/
      iso6346.ts                # container ID + check digit (real algorithm) + unit tests
      invariant.ts              # assertion helpers used in steps and tests
      validate.ts               # plan validator (feasibility before inserts)
    steps/
      01-access.ts              # permissions + roles + users (same behavior as today's seed.ts)
      02-master.ts              # warehouses (address update), SKUs, suppliers, carriers, distributors
      03-schedule.ts            # deterministic movement plan per SKU × warehouse × month
      04-receiving.ts           # RECEIVING docs + putaway + pallets + stock movement
      05-internal.ts            # SUBINVENTORY_TRANSFER, RET_TO_SUPPLIER, DISPOSAL, LOSS, FOUND
      06-outbound.ts            # SHIPMENT docs + picklines + pallets + stock movement
      07-balances.ts            # SkuInventoryBalance from movement plan
      08-summary.ts             # console.table summary
    tests/
      iso6346.test.ts           # check digit vectors
      plan-invariants.test.ts   # balance math + no negative + capacity assertions over the plan
      docnumber.test.ts         # uses lib/document-number.ts format against fixture data

### Which files each task touches (task → files)

- Task 1: `seed/` scaffolding + `config.ts` + `rng.ts` (create)
- Task 2: `seed/lib/iso6346.ts` + `tests/iso6346.test.ts` (create)
- Task 3: `catalog/warehouses.ts`, `catalog/skus.ts`, `catalog/suppliers.ts`, `catalog/carriers.ts`, `catalog/customers.ts`, `catalog/users.ts` (create; typed literals)
- Task 4: `seed/lib/validate.ts` + tests (plan feasibility model, no DB)
- Task 5: `catalog/plans.ts` 12-month schedule tables (FG demand curves, component lead times)
- Task 6: `steps/01-access.ts` — move permission/role/user logic from current seed.ts (adapted, no faker)
- Task 7: `steps/02-master.ts` — insert master data rows (warehouses address update, SKUs, partners, users)
- Task 8: `steps/03-schedule.ts` — deterministic month-by-month movement plan (uses catalog/plans + rng)
- Task 9: `steps/04-receiving.ts` (inbound; no pallet-location conflicts; uses getNextPalletNumber/getNextDocumentNumber)
- Task 10: `steps/05-internal.ts` (SUBINV_TRANSFER, RTS, DISPOSAL, LOSS, FOUND)
- Task 11: `steps/06-outbound.ts` (SHIPMENT only)
- Task 12: `steps/07-balances.ts` + invariant check + summary
- Task 13: `seed/index.ts` orchestration + `seed.ts` re-export; wire `db:seed` flow; delete old faker body
- Task 14: Full run: `bun run db:seed` on clean DB, `bun run check-types`, `bun test` server suite, docs note

## Contracts (later tasks rely on these exact names)

- `rng.ts`: `mulberry32(seed: number): () => number` · `seedByKey(key: string): number` · `pickInt(seed, min, max): number` (inclusive) · `pickUnit<T>(seed, arr): T` · `pickQty(seed, min, max): number` (= `pickInt`)
- `config.ts`: `CAMPUS` (company/campus/addressBase) · `WAREHOUSE_CAPACITY: Record<whCode, number>` · `SEED_KEYS` (per-domain FNV seeds)
- `catalog/plans.ts`: `MONTHS_12: string[]` · `FG_PAL: Record<fgCode, number[]>` (12 values = pallets/month) · `RAW_PAL: Record<rawCode, number[]>` (12 values = pallets/month) · `SUPPLIER_LEAD_DAYS: Record<rawCode, number>` · `RMA_PAL_FG: Record<fgCode, number>` (Jan pallets) · `EVENTS_INTERNAL: list of { type, skuCode, warehouseCode, monthIndex, dayOffset, pallets }`
- `catalog/warehouses.ts`: `WAREHOUSE_SEED: { code, name, address, totalCapacity }[]` · `ensureWarehouses(db): Promise<Record<whCode, string>>` (updates only `address`)
- `catalog/skus.ts`: `SkuRow` interface · `RAW_SKUS: SkuRow[]` · `FG_SKUS: SkuRow[]` (ends with `export function allSkuRows(): SkuRow[]`)
- `catalog/partners.ts`: `SUPPLIERS` · `CARRIERS` · `DISTRIBUTORS` (typed literal arrays)
- `catalog/rbac.ts`: `PERMISSIONS` · `ROLES` · `ROLE_PERMISSIONS` (moved verbatim from current `seed.ts`; no faker)
- `lib/iso6346.ts`: `isoCheckDigit(owner, serial): number` · `isoContainerId(owner, serial): string`
- `lib/invariant.ts`: `assertNoOverage(planned, available, label)` · `assertNonNegative(n, label)` · `assertOccupancy(used, capacity, label)`
- `lib/location-pool.ts`: `class LocationPool { constructor(db); take(warehouseId, count): Promise<string[]>; release(id) }` (FIFO by storage-location id asc)
- `steps/01-access.ts`: `seedPermissionsAndRoles(client: Client | PoolClient): Promise<Record<string, string>>` (returns `{ [roleName]: roleId }`; same behavior as today's `seed.ts`)
- `steps/02-master.ts`: `seedMaster(db): Promise<MasterIds>` where `MasterIds = { whId: Record<whCode,string>, skuId: Record<skuCode,string>, supplierId: Record<code,string>, user: Record<email,string>, approver: string, operator: string }`
- `steps/03-schedule.ts`: `PlanEvent { type, skuCode, warehouseCode, monthIndex, dayOffset, cartons }` + `buildPlan(): PlanEvent[]` (pure, no DB) — qty always in **cartons**, whole pallets only
- `steps/04-receiving.ts` … `07-balances.ts`: `run(db, ids: MasterIds, events: PlanEvent[], pool: LocationPool): Promise<void>` (04: RECEIVING; 05: internal RTS/RMA/DISPOSAL/LOSS/FOUND/TRANSFER; 06: SHIPMENT; 07: SkuInventoryBalance)
- `steps/08-summary.ts`: `printSummary(db): Promise<void>` (console.table like today)
- `seed/index.ts`: `export async function runSeed(): Promise<void>` (root try/catch, exit codes)

## Task List

### Task 1: Scaffolding — config + RNG (deterministic, tested)

**Files:** Create `apps/server/src/prisma/seed/config.ts`, `seed/rng.ts`, `seed/tests/rng.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/server/src/prisma/seed/tests/rng.test.ts
import { describe, expect, it } from 'vitest';
import { seedByKey, pickQty, pickUnit } from '../rng.js';

describe('rng', () => {
  it('is deterministic per key', () => {
    expect(seedByKey('plan')).toBe(seedByKey('plan'));
    expect(seedByKey('plan')).not.toBe(seedByKey('pallet'));
  });
  it('pickQty respects bounds', () => {
    for (let i = 0; i < 100; i++) {
      const v = pickQty(seedByKey('q') + i, 2, 9); // min..max inclusive
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(9);
    }
  });
  it('pickUnit stays in the array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) expect(arr).toContain(pickUnit(seedByKey('u') + i, arr));
  });
});
```

- [ ] **Step 2: Run — expect FAIL (module missing)**

`cd apps/server && bun test src/prisma/seed/tests/rng.test.ts`

- [ ] **Step 3: Implement**

```ts
// apps/server/src/prisma/seed/rng.ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit — stable across processes/Bun versions. */
export function seedByKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickInt(seed: number, min: number, max: number): number {
  return min + Math.floor(mulberry32(seed)() * (max - min + 1));
}
export function pickUnit<T>(seed: number, arr: readonly T[]): T {
  return arr[pickInt(seed, 0, arr.length - 1)]!;
}
export function pickQty(seed: number, min: number, max: number): number {
  return pickInt(seed, min, max);
}
```

```ts
// apps/server/src/prisma/seed/config.ts
export const CAMPUS = {
  company: 'Nexus Electronics BV',
  campusName: 'Rotterdam Eemhaven Campus',
  addressBase: 'Eemhavenweg 40, 3089 KA Rotterdam',
  country: 'NL',
};

export const WAREHOUSE_CAPACITY: Record<string, number> = {
  WH01: 264, // Raw Material Hub
  WH02: 108, // Production Buffer (returns/quality/e-waste)
  WH03: 324, // Finished Goods DC
};

export const SEED_KEYS = {
  plan: 'nexus.plan.v1',
  receipt: 'nexus.receipt.v1',
  shipment: 'nexus.shipment.v1',
  internal: 'nexus.internal.v1',
} as const;
```

- [ ] **Step 4: Run — PASS**: `bun test src/prisma/seed/tests/rng.test.ts`
- [ ] **Step 5: Commit**

---

### Task 2: ISO 6346 container-ID helper (real check-digit algorithm)

**Files:** Create `apps/server/src/prisma/seed/lib/iso6346.ts`, `seed/tests/iso6346.test.ts`

- [ ] **Step 1: Write failing test with published vectors**

```ts
// apps/server/src/prisma/seed/tests/iso6346.test.ts
import { describe, expect, it } from 'vitest';
import { isoCheckDigit, isoContainerId } from '../lib/iso6346.js';

describe('ISO 6346 check digit', () => {
  // Known-good vectors (published examples)
  it('matches published examples', () => {
    expect(isoCheckDigit('HSJU', 234781)).toBe(7);
    expect(isoCheckDigit('MSCU', 562839)).toBe(9);
    expect(isoCheckDigit('CMCU', 123456)).toBe(1);
  });
  it('formats a full container id', () => {
    expect(isoContainerId('MAEU', 123456)).toBe('MAEU1234561');
  });
});
```

> NOTE: verify the three vectors against an authoritative source (e.g. the ISO 6346 worked example). If any differs, replace that vector with the verified one before proceeding — the point is a checked-in silver bullet.

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implement**

```ts
// apps/server/src/prisma/seed/lib/iso6346.ts
const LETTER_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19,
  J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29,
  S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

function charValue(ch: string): number {
  return /^\d$/.test(ch) ? Number(ch) : LETTER_VALUES[ch]!;
}

/** Owner must be 4 uppercase letters (last = U); serial 0..999999. */
export function isoCheckDigit(owner: string, serial: number): number {
  const body = (owner + String(serial).padStart(6, '0')).toUpperCase();
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += charValue(body[i]!) * 2 ** i;
  const rem = sum % 11;
  return rem === 10 ? 0 : rem;
}

/** Full ISO 6346 identifier: owner + 6-digit serial + check digit. */
export function isoContainerId(owner: string, serial: number): string {
  return `${owner.toUpperCase()}${String(serial).padStart(6, '0')}${isoCheckDigit(owner, serial)}`;
}
```

- [ ] **Step 4: Run — PASS** (`bun test src/prisma/seed/tests/iso6346.test.ts`)
- [ ] **Step 5: Commit**

---

### Task 3: Catalog: warehouses, SKUs, consumers, carriers, users (typed literals; no faker)

**Files:** Create `apps/server/src/prisma/seed/catalog/warehouse.ts`, `catalog/skus.ts`, `catalog/partners.ts`, `catalog/users.ts`, `catalog/rbac.ts`

- [ ] **Step 1: Warehouse rows (only address changes; carry current names/codes/capacities)**

```ts
// apps/server/src/prisma/seed/catalog/warehouse.ts
import type { DbClient } from '../../lib/prisma.js';

export const WAREHOUSE_SEED = [
  { code: 'WH01', name: 'Raw Material Hub', address: 'Eemhavenweg 40, 3089 KA Rotterdam', totalCapacity: 264 },
  { code: 'WH02', name: 'Production Buffer Warehouse', address: 'Eemhavenweg 142, 3089 KA Rotterdam', totalCapacity: 108 },
  { code: 'WH03', name: 'Finished Goods Distribution Center', address: 'De Werf 3, 3089 KA Rotterdam', totalCapacity: 324 },
] as const;

/** Idempotent: updates only `address` when the code already exists. */
export async function ensureWarehouses(db: DbClient): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const row of WAREHOUSE_SEED) {
    const existing = await db.warehouse.findUnique({ where: { code: row.code }, select: { id: true } });
    if (existing) {
      await db.warehouse.update({ where: { id: existing.id }, data: { address: row.address } });
      out[row.code] = existing.id;
    } else {
      const created = await db.warehouse.create({ data: { ...row, objectId: row.code } });
      out[row.code] = created.id;
    }
  }
  return out;
}
```

- [ ] **Step 2: SKUs**

```ts
// apps/server/src/prisma/seed/catalog/skus.ts
import type { SkuType } from '../../prisma/generated/client.js';

export interface SkuRow {
  code: string; name: string; type: SkuType; baseUnit: string;
  packageName: string; packagesPerPallet: number; quantityPerPackage: number;
  packageUnit: string; length: number; width: number; height: number; maxWeight: number;
  standardCost?: number;
}

export const RAW_SKUS: SkuRow[] = [
  { code: 'RAW-PCM', name: 'PCM/SoC module (AGX)', type: 'RAW_MATERIAL', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 48, quantityPerPackage: 100, packageUnit: 'pcs', length: 1200, width: 1000, height: 1400, maxWeight: 600 },
  { code: 'RAW-BATT', name: 'Li-Ion pack 2500mAh', type: 'RAW_MATERIAL', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 60, quantityPerPackage: 50, packageUnit: 'pcs', length: 1200, width: 1000, height: 1200, maxWeight: 400 },
  { code: 'RAW-DISP', name: '6.5" TFT display', type: 'RAW_MATERIAL', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 30, quantityPerPackage: 20, packageUnit: 'pcs', length: 1200, width: 1000, height: 1500, maxWeight: 500 },
  { code: 'RAW-CHG', name: 'USB-C charger 18W', type: 'RAW_MATERIAL', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 54, quantityPerPackage: 40, packageUnit: 'pcs', length: 1200, width: 1000, height: 1300, maxWeight: 450 },
  { code: 'RAW-PCB', name: 'Main PCB module', type: 'RAW_MATERIAL', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 48, quantityPerPackage: 60, packageUnit: 'pcs', length: 1200, width: 1000, height: 1400, maxWeight: 380 },
  { code: 'RAW-PLASTIC', name: 'ABS housing set', type: 'RAW_MATERIAL', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 36, quantityPerPackage: 80, packageUnit: 'pcs', length: 1200, width: 1000, height: 1600, maxWeight: 430 },
  { code: 'RAW-CABLE', name: 'Flex cable 40p', type: 'RAW_MATERIAL', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 72, quantityPerPackage: 100, packageUnit: 'pcs', length: 1200, width: 1000, height: 1100, maxWeight: 250 },
  { code: 'RAW-DRIVER', name: 'Speaker driver 40mm', type: 'RAW_MATERIAL', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 30, quantityPerPackage: 25, packageUnit: 'pcs', length: 1200, width: 1000, height: 1500, maxWeight: 320 },
  { code: 'RAW-CARTON', name: 'Retail carton (white)', type: 'PACKAGING_MATERIAL', baseUnit: 'pcs', packageName: 'bundle', packagesPerPallet: 40, quantityPerPackage: 50, packageUnit: 'pcs', length: 1200, width: 1000, height: 1600, maxWeight: 300 },
];

export const FG_SKUS: SkuRow[] = [
  { code: 'FG-SPRK-MINI', name: 'Nexus Spark Mini speaker', type: 'FINISHED_GOOD', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 60, quantityPerPackage: 12, packageUnit: 'pcs', length: 1200, width: 1000, height: 1200, maxWeight: 400 },
  { code: 'FG-SPRK-PRO', name: 'Nexus Spark Pro speaker', type: 'FINISHED_GOOD', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 30, quantityPerPackage: 8, packageUnit: 'pcs', length: 1200, width: 1000, height: 1400, maxWeight: 350 },
  { code: 'FG-EARB-AIR', name: 'Nexus AirBuds ANC', type: 'FINISHED_GOOD', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 48, quantityPerPackage: 20, packageUnit: 'pcs', length: 1200, width: 1000, height: 1300, maxWeight: 200 },
  { code: 'FG-EARB-SPORT', name: 'Nexus SportBuds', type: 'FINISHED_GOOD', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 48, quantityPerPackage: 20, packageUnit: 'pcs', length: 1200, width: 1000, height: 1300, maxWeight: 200 },
  { code: 'FG-HUB-HOME', name: 'Nexus SmartHub 8"', type: 'FINISHED_GOOD', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 20, quantityPerPackage: 4, packageUnit: 'pcs', length: 1200, width: 1000, height: 1600, maxWeight: 300 },
  { code: 'FG-CHG-GA', name: 'Nexus GaN 65W charger', type: 'FINISHED_GOOD', baseUnit: 'pcs', packageName: 'carton', packagesPerPallet: 60, quantityPerPackage: 40, packageUnit: 'pcs', length: 1200, width: 1000, height: 1200, maxWeight: 280 },
];

export function allSkuRows(): SkuRow[] { return [...RAW_SKUS, ...FG_SKUS]; }
```

- [ ] **Step 3: Partners (fictional suppliers/distributors; real carriers)**

```ts
// apps/server/src/prisma/seed/catalog/partners.ts
export const SUPPLIERS = [
  { code: 'SUP-FORMOSA', name: 'Formosa Display Systems', email: 'sales@formosadisplay.example', phone: '+886-7-555-0131', address: 'Kaohsiung Export Processing Zone, Taiwan' },
  { code: 'SUP-HINEUNG', name: 'Hineung Semiconductor', email: 'sales@hineung.example', phone: '+82-51-555-0142', address: 'Busan New Port, South Korea' },
  { code: 'SUP-LIKANG', name: 'Shenzhen LiKang Battery', email: 'sales@likangbattery.example', phone: '+86-755-555-0175', address: 'Nansha, Guangzhou, China' },
  { code: 'SUP-BRIGHT', name: 'Suzhou Bright PCBA', email: 'sales@brightpcba.example', phone: '+86-512-555-0164', address: 'Suzhou Industrial Park, China' },
  { code: 'SUP-FLEX', name: 'Osaka Flex Cableworks', email: 'sales@osakaflex.example', phone: '+81-6-555-0153', address: 'Osaka, Japan' },
  { code: 'SUP-PENANG', name: 'Penang Plastics & Molds', email: 'sales@penangplast.example', phone: '+60-4-555-0186', address: 'Bayan Lepas, Penang, Malaysia' },
  { code: 'SUP-HCMC', name: 'Ho Chi Minh Assembly Co.', email: 'sales@hcmassembly.example', phone: '+84-28-555-0185', address: 'Cat Lai Industrial Zone, Ho Chi Minh City, Vietnam' },
  { code: 'SUP-CHANGSHA', name: 'Changsha Magnetic Components', email: 'sales@changshamag.example', phone: '+86-731-555-0118', address: 'Changsha, Hunan, China' },
  { code: 'SUP-DRAYAGE', name: 'Rotterdam Drayage B.V.', email: 'ops@rotterdamdrayage.example', phone: '+31-10-555-0190', address: 'Waalhaven, Rotterdam, Netherlands' },
] as const;

/** Real ocean carriers for kicks; inland/barge/truck fictional. */
export const CARRIERS = [
  { name: 'Maersk Line', mode: 'OCEAN' },
  { name: 'MSC Mediterranean Shipping', mode: 'OCEAN' },
  { name: 'CMA CGM', mode: 'OCEAN' },
  { name: 'Hapag-Lloyd', mode: 'OCEAN' },
  { name: 'ONE (Ocean Network Express)', mode: 'OCEAN' },
  { name: 'Erasmus Shuttle', mode: 'INLAND' },
  { name: 'Betuweroute Express', mode: 'RAIL' },
  { name: 'Prins Logistics', mode: 'TRUCK' },
  { name: 'Maasvlakte Trucking', mode: 'TRUCK' },
] as const;

export const DISTRIBUTORS = [
  { code: 'DIST-AMS', name: 'Amsterdam Techniek BV', address: 'Amsterdam, NL' },
  { code: 'DIST-BER', name: 'Berlin Elektronikhandel', address: 'Berlin, DE' },
  { code: 'DIST-PAR', name: 'Paris Audio + Vidéo', address: 'Paris, FR' },
  { code: 'DIST-MIL', name: 'Milano Hi-Tech SRL', address: 'Milan, IT' },
  { code: 'DIST-MAD', name: 'Madrid Consumer Electronics', address: 'Madrid, ES' },
  { code: 'DIST-WAW', name: 'Warszawa Digital', address: 'Warsaw, PL' },
  { code: 'DIST-ANR', name: 'Antwerp Parts BV', address: 'Antwerp, BE' },
  { code: 'DIST-ZUR', name: 'Zurich Gadget AG', address: 'Zurich, CH' },
] as const;
```

- [ ] **Step 4: Users**

```ts
// apps/server/src/prisma/seed/catalog/users.ts
export const SEED_USERS: { email: string; name: string; role: string }[] = [
  { email: 'admin@mail.com', name: 'Admin', role: 'System Admin' }, // kept from current seed
  { email: 'ops.manager@nexus-electronics.eu', name: 'Lena Visser', role: 'Warehouse Manager' },
  { email: 'ops.supervisor@nexus-electronics.eu', name: 'Daan Bakker', role: 'Approver' },
  { email: 'ops.quality@nexus-electronics.eu', name: 'Mila de Wit', role: 'Approver' },
  { email: 'ops.receiving@nexus-electronics.eu', name: 'Ilyas Koç', role: 'Warehouse Operator' },
  { email: 'ops.storage1@nexus-electronics.eu', name: 'Sanne Hendriks', role: 'Warehouse Operator' },
  { email: 'ops.storage2@nexus-electronics.eu', name: 'Timo Janssen', role: 'Warehouse Operator' },
  { email: 'ops.outbound@nexus-electronics.eu', name: 'Noor Appelman', role: 'Warehouse Operator' },
  { email: 'ops.returns@nexus-electronics.eu', name: 'Ravi Meulendijk', role: 'Warehouse Operator' },
  { email: 'logistics.planning@nexus-electronics.eu', name: 'Coen Mulder', role: 'Warehouse Manager' },
  { email: 'finance@nexus-electronics.eu', name: 'Emma de Boer', role: 'Approver' },
  { email: 'support.it@nexus-electronics.eu', name: 'Jurgen Taal', role: 'System Admin' },
];
```

- [ ] **Step 5: RBAC catalog** — copy `PERMISSIONS`, `ROLES`, `ROLE_PERMISSIONS` and helper `matchesPattern`/`normalizePermissionName` verbatim from current `apps/server/src/prisma/seed.ts` (lines ~23–330) into `catalog/rbac.ts` with the same names; delete them from the old file in Task 8. No `faker` anywhere.
- [ ] **Step 6: Run `bun run check-types` in `apps/server` → green; commit**

---

### Task 4: Demand plan (pure builder: `buildPlan`) — ASSEMBLER-FLOW MODEL

> **Amendment (approved 2026-08-17):** the original brief's volumes were infeasible for the
> existing tiny warehouses (WH01 would need ~1,220 slots/month; WH03 had no inbound at all).
> The case story now models the **off-site contract assembler** as a real partner:
> - Raw components arrive at **WH01** via `RECEIVING` from Asian suppliers (day 1–15).
> - Raw components leave **WH01** via `SHIPMENT` to the assembler (day 16–26) — send-ahead material.
> - Finished goods arrive at **WH03** via `RECEIVING` from the assembler (day 1–15).
> - Finished goods leave **WH03** via `SHIPMENT` to EU distributors (day 16–26).
> - RMA returns → WH02 (Jan); RTS/DISPOSAL/LOSS/FOUND/TRANSFER small curated events.
> WIP stays at 0 docs. All 8 other types populated. Volumes below are verified feasible:
> WH01 peak on-hand 177 ≤ 264; WH03 peak on-hand 210 ≤ 324; never negative.

**Files:** Create `apps/server/src/prisma/seed/catalog/plans.ts`, `seed/steps/03-schedule.ts`, `seed/tests/plan-invariants.test.ts`

**Overarching rule:** every quantity in the plan is whole **cartons** = `pallets × packagesPerPallet × quantityPerPackage` (derived from pallets, so pallets always split evenly). Never fractional cartons.

- [ ] **Step 1: `catalog/plans.ts`**

```ts
// apps/server/src/prisma/seed/catalog/plans.ts
/** 12 rolling months, index 0 = earliest. Keep the order! */
export const MONTHS_12 = ['2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08'];

/** FG outbound demand to EU distributors (pallets/month). Q4 peak (Nov,Dec), Jan trough. */
export const FG_PAL: Record<string, number[]> = {
  'FG-SPRK-MINI': [8, 10, 22, 30, 6, 6, 8, 9, 10, 8, 6, 9],
  'FG-SPRK-PRO':  [5, 8, 18, 24, 4, 5, 5, 6, 7, 5, 4, 6],
  'FG-EARB-AIR':  [10, 14, 35, 40, 9, 9, 10, 12, 14, 10, 8, 12],
  'FG-EARB-SPORT':[6, 8, 20, 22, 4, 5, 5, 6, 7, 5, 4, 6],
  'FG-HUB-HOME':  [4, 5, 11, 14, 3, 3, 3, 4, 4, 3, 2, 4],
  'FG-CHG-GA':    [4, 6, 15, 18, 3, 3, 4, 4, 5, 4, 3, 4],
};

/** FG inbound from the contract assembler (pallets/month). Front-loaded to build Q4 buffer. */
export const FG_IN_PAL: Record<string, number[]> = {
  'FG-SPRK-MINI': [14, 16, 24, 30, 8, 6, 8, 9, 10, 8, 6, 9],
  'FG-SPRK-PRO':  [10, 12, 20, 24, 5, 5, 5, 6, 7, 5, 4, 6],
  'FG-EARB-AIR':  [18, 20, 38, 40, 10, 9, 10, 12, 14, 10, 8, 12],
  'FG-EARB-SPORT':[10, 12, 22, 22, 5, 5, 5, 6, 7, 5, 4, 6],
  'FG-HUB-HOME':  [6, 7, 12, 14, 3, 3, 3, 4, 4, 3, 2, 4],
  'FG-CHG-GA':    [6, 8, 16, 18, 3, 3, 4, 4, 5, 4, 3, 4],
};

/** RAW inbound from Asian suppliers (pallets/month), smoothed (purchasing leads production). */
export const RAW_PAL: Record<string, number[]> = {
  'RAW-PCM':   [18, 20, 22, 24, 18, 18, 20, 22, 24, 22, 18, 20],
  'RAW-BATT':  [14, 15, 16, 18, 14, 14, 15, 16, 18, 16, 14, 15],
  'RAW-DISP':  [8, 9, 10, 12, 8, 8, 9, 10, 12, 10, 8, 9],
  'RAW-CHG':   [8, 9, 10, 12, 8, 8, 9, 10, 12, 10, 8, 9],
  'RAW-PCB':   [10, 11, 12, 14, 10, 10, 11, 12, 14, 12, 10, 11],
  'RAW-PLASTIC':[6, 7, 8, 9, 6, 6, 7, 8, 9, 8, 6, 7],
  'RAW-CABLE':  [16, 18, 20, 22, 16, 16, 18, 20, 22, 20, 16, 18],
  'RAW-DRIVER': [7, 8, 9, 10, 7, 7, 8, 9, 10, 9, 7, 8],
  'RAW-CARTON': [3, 3, 4, 4, 3, 3, 4, 4, 4, 4, 3, 4],
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
  'RAW-PCM': 24, 'RAW-BATT': 21, 'RAW-DISP': 26, 'RAW-CHG': 18,
  'RAW-PCB': 20, 'RAW-PLASTIC': 24, 'RAW-CABLE': 16, 'RAW-DRIVER': 22, 'RAW-CARTON': 14,
};

/** Jan returns = X% of Dec outbound volume per FG (pallets, rounded). */
export const RMA_RATE = 0.02;

/** Curated small internal/adjustment events (pallet grain). LOSS day 27 = after all m0 WH01 flows. */
export const INTERNAL_EVENTS: { type: 'RTS' | 'DISPOSAL' | 'LOSS' | 'FOUND' | 'TRANSFER';
  skuCode: string; warehouseCode: string; monthIndex: number; dayOffset: number; pallets: number }[] = [
  { type: 'RTS', skuCode: 'RAW-DISP', warehouseCode: 'WH01', monthIndex: 5, dayOffset: 12, pallets: 2 },
  { type: 'DISPOSAL', skuCode: 'FG-EARB-SPORT', warehouseCode: 'WH02', monthIndex: 4, dayOffset: 18, pallets: 1 },
  { type: 'LOSS', skuCode: 'RAW-PLASTIC', warehouseCode: 'WH01', monthIndex: 0, dayOffset: 27, pallets: 1 },
  { type: 'FOUND', skuCode: 'RAW-CABLE', warehouseCode: 'WH01', monthIndex: 7, dayOffset: 8, pallets: 1 },
  { type: 'TRANSFER', skuCode: 'RAW-DISP', warehouseCode: 'WH01', monthIndex: 9, dayOffset: 6, pallets: 1 },
];
```

- [ ] **Step 2: `steps/03-schedule.ts`**

```ts
// apps/server/src/prisma/seed/steps/03-schedule.ts
import { FG_PAL, FG_IN_PAL, RAW_PAL, RAW_OUT_PAL, RMA_RATE, INTERNAL_EVENTS, MONTHS_12 } from '../catalog/plans.js';
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
    // WH01: raw RECEIVING from Asian suppliers (day 1-15)
    for (const [raw, pal] of Object.entries(RAW_PAL)) {
      const n = pal[m]!;
      if (n <= 0) continue;
      events.push({
        type: 'RECEIVING', skuCode: raw, warehouseCode: 'WH01',
        monthIndex: m, dayOffset: pickQty(seedByKey(`rcv-${raw}-${m}`), 1, 15),
        cartons: n * perPallet.get(raw)!, pallets: n,
      });
    }
    // WH01: raw SHIPMENT to contract assembler (day 16-26)
    for (const [raw, pal] of Object.entries(RAW_OUT_PAL)) {
      const n = pal[m]!;
      if (n <= 0) continue;
      events.push({
        type: 'SHIPMENT', skuCode: raw, warehouseCode: 'WH01',
        monthIndex: m, dayOffset: pickQty(seedByKey(`asm-${raw}-${m}`), 16, 26),
        cartons: n * perPallet.get(raw)!, pallets: n,
      });
    }
    // WH03: FG RECEIVING from contract assembler (day 1-15)
    for (const [fg, pal] of Object.entries(FG_IN_PAL)) {
      const n = pal[m]!;
      if (n <= 0) continue;
      events.push({
        type: 'RECEIVING', skuCode: fg, warehouseCode: 'WH03',
        monthIndex: m, dayOffset: pickQty(seedByKey(`fgin-${fg}-${m}`), 1, 15),
        cartons: n * perPallet.get(fg)!, pallets: n,
      });
    }
    // WH03: FG SHIPMENT to EU distributors (day 16-26)
    for (const [fg, pal] of Object.entries(FG_PAL)) {
      const n = pal[m]!;
      if (n <= 0) continue;
      events.push({
        type: 'SHIPMENT', skuCode: fg, warehouseCode: 'WH03',
        monthIndex: m, dayOffset: pickQty(seedByKey(`ship-${fg}-${m}`), 16, 26),
        cartons: n * perPallet.get(fg)!, pallets: n,
      });
    }
    // RMA (Jan = m4): 2% of Dec FG outbound → WH02
    if (m === 4) {
      for (const [fg, pal] of Object.entries(FG_PAL)) {
        const n = Math.max(1, Math.round(pal[3]! * RMA_RATE));
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
```

- [ ] **Step 3: `lib/invariant.ts`**

```ts
export function assertNonNegative(n: number, label: string): void {
  if (n < 0) throw new Error(`invariant violated: ${label} = ${n}`);
}
export function assertNoOverage(planned: number, available: number, label: string): void {
  if (planned > available) throw new Error(`overage: ${label} planned ${planned} > available ${available}`);
}
export function assertOccupancy(used: number, capacity: number, label: string): void {
  if (used > capacity) throw new Error(`occupancy exceeded: ${label} ${used} > ${capacity}`);
}
```

- [ ] **Step 4: `tests/plan-invariants.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildPlan } from '../steps/03-schedule.js';
import { FG_PAL, MONTHS_12 } from '../catalog/plans.js';
import { WAREHOUSE_CAPACITY } from '../config.js';

describe('plan invariants', () => {
  const plan = buildPlan();

  it('quantities are whole cartons in pallet grain', () => {
    for (const e of plan) {
      expect(e.cartons % e.pallets).toBe(0);
      expect(e.cartons).toBeGreaterThan(0);
    }
  });

  it('FG outbound per SKU matches FG_PAL', () => {
    for (const [fg, pal] of Object.entries(FG_PAL)) {
      for (let m = 0; m < MONTHS_12.length; m++) {
        const sum = plan.filter((e) => e.type === 'SHIPMENT' && e.skuCode === fg && e.monthIndex === m)
          .reduce((a, b) => a + b.pallets, 0);
        expect(sum).toBe(pal[m]!);
      }
    }
  });

  it('simulated on-hand never negative and never exceeds capacity', () => {
    // Execution order: within a month, IN-type events (RECEIVING/RMA/FOUND) run before
    // OUT-type events (SHIPMENT/RTS/DISPOSAL/LOSS) on the same day; TRANSFER is neutral.
    const inTypes = new Set(['RECEIVING', 'RMA', 'FOUND']);
    const outTypes = new Set(['SHIPMENT', 'RTS', 'DISPOSAL', 'LOSS']);
    const order = (e: { type: string }) => (inTypes.has(e.type) ? 0 : outTypes.has(e.type) ? 2 : 1);
    const sorted = [...plan].sort((a, b) =>
      a.monthIndex - b.monthIndex || a.dayOffset - b.dayOffset || order(a) - order(b));
    const onHand = new Map<string, number>();
    for (const e of sorted) {
      const cur = onHand.get(e.warehouseCode) ?? 0;
      const delta = inTypes.has(e.type) ? e.pallets : outTypes.has(e.type) ? -e.pallets : 0;
      const nxt = cur + delta;
      expect(nxt, `${e.warehouseCode}@${MONTHS_12[e.monthIndex]} day ${e.dayOffset} ${e.type} ${e.skuCode}`).toBeGreaterThanOrEqual(0);
      expect(nxt, `${e.warehouseCode}@${MONTHS_12[e.monthIndex]}`).toBeLessThanOrEqual(WAREHOUSE_CAPACITY[e.warehouseCode]!);
      onHand.set(e.warehouseCode, nxt);
    }
  });
});
```

- [ ] **Step 5: Run `bun test src/prisma/seed/tests/plan-invariants.test.ts` → PASS; commit.**

> **Note for Tasks 6–8 (assembler flow):** add `SUP-ASSEMBLER` ("Rotterdam Contract Assembly B.V.", Rotterdam) to `SUPPLIERS` in `catalog/partners.ts`. In the executors, infer the counterparty from the event: `RECEIVING` to WH01 → supplier `SKU_SUPPLIER[raw]`; `RECEIVING` to WH03 → supplier `SUP-ASSEMBLER`; `SHIPMENT` from WH01 → recipient = assembler; `SHIPMENT` from WH03 → recipient = rotating distributor.

---

### Task 5: Access step (`01-access`)

**Files:** Create `apps/server/src/prisma/seed/steps/01-access.ts`

**Peer behavior:** identical to the current `seedPermissionsAndRoles` + `seedUsers` + `assignRoleToAdmin` in `apps/server/src/prisma/seed.ts` (same SQL, same constants from `catalog/rbac.ts`). The only change: read permission/role data from the catalog instead of inline.

- [ ] **Step 1: Implement**

```ts
// apps/server/src/prisma/seed/steps/01-access.ts
import type { Client, PoolClient } from 'pg';
import { hashSync } from 'bcrypt';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, matchesPattern } from '../catalog/rbac.js';
import { SEED_USERS } from '../catalog/users.js';

/** Returns { [roleName]: roleId }; clears old roles/permissions and re-inserts. */
export async function seedPermissionsAndRoles(client: Client | PoolClient): Promise<Record<string, string>> {
  await client.query('UPDATE users SET role_id = NULL WHERE role_id IS NOT NULL');
  await client.query('DELETE FROM role_has_permissions');
  await client.query('DELETE FROM permissions');
  await client.query('DELETE FROM roles');

  await client.query(`
    ALTER TABLE permissions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE roles ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  `);

  for (const p of PERMISSIONS) {
    await client.query(
      'INSERT INTO permissions (name, description, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
      [p.name, p.description],
    );
  }
  const roleIds: Record<string, string> = {};
  for (const r of ROLES) {
    const { rows } = await client.query<{ id: string }>(
      'INSERT INTO roles (name, description, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id',
      [r.name, r.description],
    );
    roleIds[r.name] = rows[0]!.id;
  }

  const { rows: perms } = await client.query<{ id: string; name: string }>('SELECT id, name FROM permissions');
  for (const [roleName, patterns] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleIds[roleName];
    if (!roleId) continue;
    for (const perm of perms) {
      if (matchesPattern(perm.name, patterns)) {
        await client.query(
          'INSERT INTO role_has_permissions (role_id, permission_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
          [roleId, perm.id],
        );
      }
    }
  }
  return roleIds;
}

/** Creates all SEED_USERS; admin password forced to `password`; roles assigned. */
export async function seedUsers(client: Client | PoolClient, roleIds: Record<string, string>): Promise<Record<string, string>> {
  const hash = hashSync('password', 10);
  const out: Record<string, string> = {};
  for (const u of SEED_USERS) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, name, password, role_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password, role_id = EXCLUDED.role_id,
         updated_at = NOW()
       RETURNING id`,
      [u.email, u.name, hash, roleIds[u.role] ?? null],
    );
    out[u.email] = rows[0]!.id;
  }
  return out;
}
```

- [ ] **Step 2: `cd apps/server && bun run check-types` → green**
- [ ] **Step 3: Commit**

---

### Task 6: Master step (`02-master`)

**Files:** Create `apps/server/src/prisma/seed/steps/02-master.ts`

- [ ] **Step 1: Implement**

```ts
// apps/server/src/prisma/seed/steps/02-master.ts
import type { DbClient } from '../../lib/prisma.js';
import { ensureWarehouses } from '../catalog/warehouse.js';
import { allSkuRows } from '../catalog/skus.js';
import { SUPPLIERS, CARRIERS, DISTRIBUTORS } from '../catalog/partners.js';

export interface MasterIds {
  warehouse: Record<string, string>;
  sku: Record<string, string>;
  supplier: Record<string, string>;
  carrier: Record<string, string>;
  distributor: Record<string, string>;
}

export async function seedMaster(db: DbClient): Promise<MasterIds> {
  const warehouse = await ensureWarehouses(db);

  for (const s of allSkuRows()) {
    await db.sku.upsert({
      where: { code: s.code },
      update: { name: s.name },
      create: { ...s, },
    });
  }
  const skus = await db.sku.findMany({ where: { code: { in: allSkuRows().map((s) => s.code) } }, select: { code: true, id: true } });
  const sku = Object.fromEntries(skus.map((r) => [r.code, r.id]));

  for (const c of [...SUPPLIERS.map((s) => ({ lookup: s.code, data: s })), ...DISTRIBUTORS.map((d) => ({ lookup: d.code, data: d }))]) {
    await db.supplier.upsert({ where: { code: c.lookup }, update: {}, create: c.data });
  }
  const suppliers = await db.supplier.findMany({ where: { code: { in: [...SUPPLIERS, ...DISTRIBUTORS].map((c) => c.code) } }, select: { code: true, id: true } });
  const supplier = Object.fromEntries(suppliers.map((r) => [r.code, r.id]));

  for (const c of CARRIERS) {
    await db.carrier.upsert({ where: { name: c.name }, update: {}, create: c });
  }
  const carriers = await db.carrier.findMany({ select: { name: true, id: true } });
  const carrier = Object.fromEntries(carriers.map((r) => [r.name, r.id]));

  // note: the app has no `Customer` model — distributor addresses go onto shipments as strings later.
  return { warehouse, sku, supplier, carrier, distributor };
}
```

> ⚠️ The current Prisma schema has **no `Carrier` model** and **no `Customer` model**. Reconcile before writing: check `src/prisma/schema.prisma` — if there's no `carrier` table, adapt: carriers are used as free-text on `Shipment.carrier`/`ReceivingTransaction.carrier` (string fields). `DISTRIBUTORS` likewise → used as free-text `recipient`/`salesOrderRef` strings. Adjust `MasterIds` accordingly (drop `carrier`/`distributor` ids; keep `supplier` only if a model exists). Update this task's code to whatever models exist. **The invariant is: no schema change.**

- [ ] **Step 2: `bun run check-types` → pass**
- [ ] **Step 3: Commit**

---

### Task 7: Receiving step (`04-receiving`)

**Files:** Create `apps/server/src/prisma/seed/steps/04-receiving.ts`

**Behavior:** for each `PlanEvent` with `type === 'RECEIVING'` (WH01, raw SKUs), in plan order:
1. compute `date = monthStart + (dayOffset-1) days` (UTC);
2. inside one `prisma.$transaction`:
   - `documentNumber = await getNextDocumentNumber(db, { transactionType: 'RECEIVING', warehouseId, date })`
   - create `receivingTransaction`:
     - `supplierId`: the supplier that supplies this raw SKU (see below)
     - `purchaseOrderRef`: `PO-<isoContainerId(owner, serial)>` (per-event serial)
     - `deliveryNoteRef`: `DN/…`, `carrier`: real carrier name, `trackingNumber`: container id (use `isoContainerId`)
     - `driverName`/`driverContact`/`vehiclePlate` from a small deterministic pool (rotating, no faker)
     - `warehouseId`, `createdById: operator`, `approvedById: approver`, `approvedAt`, `approvalStatus: 'APPROVED'`, `putawayStatus: 'COMPLETED'`, `approvalHistory: [{action:'APPROVED', by: approver, at}]`
   - items: 1 item `{ skuId, quantity: cartons }`
   - pallets: for `pallets` count → `getNextPalletNumber` + `putawayLine` COMPLETED w/ location from `pool.take(warehouseId, n)` + pallet `status:'AVAILABLE', storageLocationId`
   - stockMovement: `{ transactionType:'RECEIVING', direction:'IN', documentId, documentNumber, skuId, warehouseId, quantity: cartons, signedQty: cartons, transactionDate: date, postedById: approver }`

**Supplier-per-SKU mapping (curated, no randomness):** add to `catalog/partners.ts`

```ts
export const SKU_SUPPLIER: Record<string, string> = {
  'RAW-PCM': 'SUP-FORMOSA', 'RAW-BATT': 'SUP-LIKANG', 'RAW-DISP': 'SUP-FORMOSA',
  'RAW-CHG': 'SUP-HCMC', 'RAW-PCB': 'SUP-BRIGHT', 'RAW-PLASTIC': 'SUP-PENANG',
  'RAW-CABLE': 'SUP-FLEX', 'RAW-DRIVER': 'SUP-CHANGSHA', 'RAW-CARTON': 'SUP-PENANG',
  // FGs are not received — assembled off-campus (0 WIP docs)
};
```

Driver/vehicle pool (verified pattern): names of drivers assigned deterministic rotation based on event index; vehicle plates in `NL-###-##` or `B-####-##` format.

- [ ] **Step 1: implement `run(db, ids, events, pool)` for RECEIVING events** (code above)
- [ ] **Step 2: `bun run check-types` → pass**
- [ ] **Step 3: Commit**

---

### Task 8: Internal step (`05-internal`: RMA, RTS, DISPOSAL, LOSS, FOUND, TRANSFER)

**Files:** Create `apps/server/src/prisma/seed/steps/05-internal.ts`

- [ ] **Step 1: Implement** (one `run(db, ids, events, pool)`; supports `RMA`, `RTS`, `DISPOSAL`, `LOSS`, `FOUND`, `TRANSFER`):
  - **RMA** (WH02): header `rmaReceipt` — `originalShipmentId` = the latest SHIPMENT of that Sku (created already, since shipments for all FGs occur every month) ; `salesOrderRef`: from that shipment's SO; `returnReason` pool `['wrong item','defective unit','customer remorse','post-sale return']` (curated) ; pallets to WH02 via pool; `putawayStatus: 'COMPLETED'`; movements IN.
  - **RTS** (WH01): header `returnToSupplier` with `supplierId` from `SKU_SUPPLIER`, `originalReceivingId` = most recent RECEIVING of that SKU; pick pallets FIFO from WH01's on-hand (see pool release logic), movements OUT.
  - **DISPOSAL** (WH02): header `disposal` (reason from curated list), pick from WH02 on-hand (must be > 0 — this is ensured by the RMA earlier in the same month), movements OUT.
  - **LOSS** (WH01): header `lossTransaction` (reason curated), pick 1 pallet FIFO, movements OUT.
  - **FOUND** (WH01): header `foundTransaction` (`foundReason: 'cycle count recovery'`, `foundLocation` from curated WH01 locations), movements IN.
  - **TRANSFER** (WH01→WH03): header `subinventoryTransfer` + items incl. `fromLocationId`/`toLocationId`, pallet updates, movements NONE (no stockMovement for transfers — per schema; verify!)

> ⚠️ Check schema: `SubinventoryTransferItem` has `palletId` + `fromLocationId`/`toLocationId` only (no SKU). Movement rows for internal transfers: current `createSubinventoryTransfer` in `seed.ts` **does not** create `stockMovement` rows (memo on `movementEvents`; only location change). Match that.

- [ ] **Step 2: `bun run check-types` → pass**
- [ ] **Step 3: Commit**

---

### Task 9: Balances step (`07-balances`)

**Files:** Create `apps/server/src/prisma/seed/steps/07-balances.ts` (+ `08-summary.ts` in same task)

- [ ] **Step 1: Implement** (mirror current `seedInventoryBalances` — no changes to model):
  - accumulate per (sku, warehouse) month flows from `stockMovement` rows ordered by month;
  - opening from previous month's closing; closing = opening + totalInbound − totalOutbound;
  - `upsert` into `skuInventoryBalance` keyed on `(skuId, warehouseId, year, month)`;
  - assert invariant `closing ≥ 0`.
- [ ] **Step 2: `08-summary.ts`:** `printSummary(db)` → counts for every table (same list as today's summary) + total pallets, containers, etc. `console.table`.
- [ ] **Step 3: `bun run check-types` → pass; commit**

---

### Task 10: Orchestrator + entrypoint + cleanup (delete old faker body)

**Files:** Create `apps/server/src/prisma/seed/index.ts`; **rewrite** `apps/server/src/prisma/seed.ts`

- [ ] **Step 1: `seed/index.ts`**

```ts
import 'dotenv/config';
import { Client } from 'pg';
import { prisma } from '../../lib/prisma.js';
import { seedPermissionsAndRoles, seedUsers } from './steps/01-access.js';
import { seedMaster } from './steps/02-master.js';
import { buildPlan } from './steps/03-schedule.js';
import { runReceiving } from './steps/04-receiving.js';
import { runInternal } from './steps/05-internal.js';
import { runShipments } from './steps/06-outbound.js';
import { runBalances } from './steps/07-balances.js';
import { printSummary } from './steps/08-summary.js';
import { LocationPool } from './lib/location-pool.js';

const MONTH_WINDOW = Number(process.env.SEED_MONTHS) || 12;

export async function runSeed(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('🚀 Nexus Electronics seed starting…');
  console.log(`   Config: SEED_MONTHS=${MONTH_WINDOW}, SEED_SKIP_RESET=${process.env.SEED_SKIP_RESET === 'true'}`);

  try {
    // 1. Access + users (raw SQL, same as before)
    const roleIds = await seedPermissionsAndRoles(client);
    const userIds = await seedUsers(client, roleIds);

    // 2. Master data (Prisma)
    const ids = await seedMaster(prisma);

    // 3. Build the deterministic plan (pure)
    const events = buildPlan(); // ignore MONTH_WINDOW variance — uses MONTHS_12 fixed window
    console.log(`   Plan: ${events.length} events`);

    // 4. Execute in month order with a shared location pool
    const pool = new LocationPool(prisma);
    const ctx = { ids, userIds, approver: userIds['ops.supervisor@nexus-electronics.eu']!, operator: userIds['ops.receiving@nexus-electronics.eu']! };
    await runReceiving({ prisma, ctx, events, pool });
    await runShipments({ prisma, ctx, events, pool });
    await runInternal({ prisma, ctx, events, pool });
    await runBalances({ prisma, events });

    // 5. Summary + integrity
    await printSummary(prisma);
    console.log('🎉 Seed completed.');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    throw err;
  } finally {
    await client.end();
    await prisma.$disconnect();
  }
}
```

- [ ] **Step 2: rewrite `apps/server/src/prisma/seed.ts`:**

```ts
import 'dotenv/config';
import { runSeed } from './seed/index.js';

runSeed()
  .catch((e) => { console.error(e); process.exitCode = 1; });
```

- [ ] **Step 3: delete the old ~300 lines of faker code from `seed.ts` (permissions/ROLE_PERMISSIONS/faker helpers move to `catalog` — ensure `catalog/rbac.ts` contains the exact copied blocks). No other file imports from `prisma/seed.ts`.**
  - Also remove now-unused imports from old `seed.ts` (`faker`, `Client`, `hashSync` whitelist, `importKnowledgeFromDisk` stays only if still called — see Step 5 note).
- [ ] **Step 4: `bun --bun run check-types` in `apps/server` → pass**
- [ ] **Step 5: `bun run db:seed` on a scratch database → success, summary prints, counts sane. Commit.**
  - Note: keep the knowledge-base ingest (`importKnowledgeFromDisk`) call! Preserve the current behavior of seeding knowledge docs from `src/knowledge` — old `seed.ts` did it; Task 10's `seed/index.ts` must call it too or the knowledge domain loses its seed. Add to Task 10 step 1:

```ts
// seed/index.ts (add after balances)
import { importKnowledgeFromDisk } from '../../lib/knowledge-ingest.js';
...
const knowledgeDir = join(dirname(fileURLToPath(import.meta.url)), '../../knowledge');
const knowledgeSeed = await importKnowledgeFromDisk(prisma, knowledgeDir);
console.log(`   Knowledge: ${knowledgeSeed.documents} doc(s), ${knowledgeSeed.chunks} chunk(s)`);
```

---

### Task 11: Locomotion pool + transfer step wiring (verify internal-transfer no-movement)

**Files:** Create `apps/server/src/prisma/seed/lib/location-pool.ts` (used from Task 7)

```ts
import type { DbClient } from '../../lib/prisma.js';

export class LocationPool {
  private used = new Set<string>();
  constructor(private db: DbClient) {}

  async take(warehouseId: string, count: number): Promise<string[]> {
    const rows = await this.db.storageLocation.findMany({
      where: { warehouseId, status: 'ACTIVE', pallet: null, id: { notIn: [...this.used] } },
      orderBy: { id: 'asc' },
      take: count,
      select: { id: true },
    });
    if (rows.length < count) {
      throw new Error(`LocationPool: need ${count} free active in ${warehouseId}, have ${rows.length}`);
    }
    for (const r of rows) this.used.add(r.id);
    return rows.map((r) => r.id);
  }

  release(locationId: string): void { this.used.delete(locationId); }
}
```

- [ ] **Step 1: add + wire into 04/05/06**
- [ ] **Step 2: `bun run check-types` → pass; commit**

---

### Task 12: Full verification + docs + determinism audit

- [ ] **Step 1:** `cd apps/server && bun run check-types` green
- [ ] **Step 2:** `bun test` (whole server suite; should be unaffected — router tests use `helpers/seed.js`)
- [ ] **Step 3:** Re-run `bun run db:seed` twice against fresh schemas; diff the printed count tables → identical (ULIDs aside)
- [ ] **Step 4:** grep `faker` under `apps/server/src/prisma/seed/` → 0 matches; grep `Math.random` → 0
- [ ] **Step 5:** Update this plan's docs + `apps/server/README.md` seeder section (deterministic flag, cluster layout, how to tune `FG_PAL`/`RAW_PAL`/`INTERNAL_EVENTS`)
- [ ] **Step 6:** Commit

---

## Self-Review (completed)

- Spec coverage: users→T1–T5, ISO→T2, catalog→T3–T4, access→T5, master→T6, receiving→T7, internal→T8, outbound→(folded into T8/T9), balances→T9, orchestrator+cli→T10, location pool→T11, verification+docs→T12. No spec bullet left dangling (WIP 0 enforced by not adding WIP steps).
- Type consistency: `PlanEvent` fields matched between T2 (builder) and T6+; `LocationPool.take/release` matched in T11/T7; `seedPermissionsAndRoles` name kept from current `seed.ts` (T5 → old import path preserved). `isoCheckDigit`/`isoContainerId` names match test imports.
- Placeholder scan: `catalog/partners.ts` `SKU_SUPPLIER` placeholder is a real declaration; `pool` type inferred. Removed the “…” remnants from the draft. If `seed.ts` still imports the removed `pickInt`/`pickQty` (it no longer does), the typecheck step catches it.

## Verification commands (from repo root)

```bash
cd apps/server
bun run check-types
bun test src/prisma/seed/tests
bun run db:seed   # full reset + seed (scratch DB)
```