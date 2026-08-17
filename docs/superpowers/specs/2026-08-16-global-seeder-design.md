# Nexus Electronics Global Campus Seeder — Design

> Status: Approved by user (2026-08-16)
> Scope: data-only seeder replacement. **No Prisma schema changes.**

## 1. Goal

Replace the faker-driven `apps/server/src/prisma/seed.ts` (~1,900-line monolith) with a
deterministic, research-grounded international case-study seed for a single campus in the
Rotterdam port area: one story, three physical warehouses with distinct storage purposes,
realistic partner/carrier/ports data, mathematically reconcilable pallet-level inventory.

## 2. Decisions (user-approved)

| Decision | Value |
|---|---|
| Industry | Consumer electronics (audio / smart-home) |
| Company | Fictional: **Nexus Electronics BV**, Rotterdam campus |
| Partners | Fictional suppliers/distributors; **real carriers** (Maersk, MSC, CMA CGM, Hapag-Lloyd, ONE) + fictional regional drayage |
| Site | **Rotterdam, Netherlands** — Eemhaven/Waalhaven industrial area |
| Warehouses | The 3 existing warehouses **unchanged** (names, ids, storage locations, capacities) |
| Warehouse edit | Only `address` → realistic Rotterdam address (3 rows) |
| WIP | **0 documents** (both WIP_COMPLETION and WIP_ISSUE empty — assembler off-campus) |
| Time window | 12 months rolling (Sep 2025 – Aug 2026), driven by `SEED_MONTHS` like today |
| Data scale | ~600–700 pallets on stock max, ~1,400–1,900 transactions over 12 months |
| Randomness | **None.** Deterministic for all material decisions; LCG only for row-id/vessel/pallet-number selection. Same env → same database. |

## 3. Case story

Nexus Electronics BV designs consumer audio & smart-home devices in Rotterdam. Component
production is contracted to Asian EMS/ODM suppliers; finished-goods assembly is performed
**off-campus** by a Rotterdam-area contract manufacturer (hence no WIP transactions in the
warehouse system). The campus covers receiving, quality hold, returns, disposal staging
and outbound distribution to EU retailers/distributors.

### 3.1 Warehouse mapping (existing rows only; names kept)

| Code | Existing name (kept) | Campus role | Locations |
|---|---|---|---|
| WH01 | Raw Material Hub | Component inbound buffer (RACK 216 + FLOOR 48) | 264 |
| WH02 | Production Buffer Warehouse | Returns / quality hold / e-waste staging (FLOOR 108) | 108 |
| WH03 | Finished Goods Distribution Center | Outbound DC (RACK 324) | 324 |

Total location capacity: 696. **Storage location rows are untouched.**

### 3.2 Why each transaction type exists in the dataset

| Type | Driver |
|---|---|
| RECEIVING | Component imports from Asia (PCM, SoC, battery, display, charger, plastics, packaging) → WH01 |
| WIP_COMPLETION | — (0 docs) |
| RMA_RECEIPT | Retailer returns (Jan peak post-holiday) → WH02 |
| WIP_ISSUE | — (0 docs) |
| SHIPMENT | FG to EU distributors/retailers from WH03 (Q4 Black-Friday peak) |
| RETURN_TO_SUPPLIER | Defective component lots, warranty RMA, over-shipments → WH02 → origin port |
| DISPOSAL | E-waste/damaged lots to licensed recycler → WH02 |
| SUBINVENTORY_TRANSFER | WH01→WH03 rebalancing; WH03 internal slot moves (returns to active stock) |
| LOSS | Minor shrinkage (cycle-count variance), 0.1–0.4% of volume |
| FOUND | Cycle-count discoveries (inverse, rare) |

## 4. Data catalog (all typed literals, no faker)

### 4.1 Users (~12)

- `admin@mail.com` (System Admin) — kept.
- Fictional staff names with role mapping: `Warehouse Manager` (1), `Warehouse Operator` (5), `Approver` (2), `System Admin` (1 extra), `Quality Lead` (1, Approver), `Logistics Coordinator` (1, Operator). Emails `@nexus-electronics.eu`.
- Passwords: `password` (bcrypt, same as today).

### 4.2 Suppliers (~9, fictional, real origins)

| # | Name (fictional) | City / Port | Region | Parts supplied |
|---|---|---|---|---|
| S1 | Formosa Display Systems | Kaohsiung | TW | Display panels |
| S2 | Hineung Semiconductor | Busan | KR | PCM/SoC boards |
| S3 | Shenzhen LiKang Battery | Shenzhen (Nansha) | CN | Batteries |
| S4 | Suzhou Bright PCBA | Shanghai | CN | PCBA modules |
| S5 | Osaka Flex Cableworks | Osaka | JP | Flex/ribbon cables |
| S6 | Penang Plastics & Molds | Penang | MY | Housings, plastic parts |
| S7 | Ho Chi Minh Assembly Co. | Ho Chi Minh City (Cat Lai) | VN | Final-pack sub-assembly |
| S8 | Changsha Magnetic Components | Shanghai | CN | Speakers/drivers |
| S9 | Rotterdam Drayage B.V. | Rotterdam | NL | Local drayage (trucker, not SKU supplier) |

Origins intentionally diverse: Kaohsiung, Busan, Shenzhen-Nansha, Suzhou, Osaka, Penang,
Ho Chi Minh, Shanghai. (No real company names — all fictional.)

### 4.3 Carriers (real)

- **Oceangoing**: Maersk Line, MSC, CMA CGM, Hapag-Lloyd, ONE (Ocean Network Express), Evergreen (real names of ocean carriers).
- **Barge/rail**: Containerships / RailCargoGroup names as realistic fictional (`Erasmus Shuttle`, `Betuweroute Express`).
- **Drayage**: `Rotterdam Drayage B.V.`, `Prins Logistics`, `Maasvlakte Trucking`.

### 4.4 Distributors / customers (~8, fictional EU)

- Amsterdam Techniek BV (NL), Berlin Elektronikhandel (DE), Paris Audio + Vidéo (FR), Milano Hi-Tech SRL (IT), Madrid Consumer Electronics (ES), Warszawa Digital (PL), Antwerp Parts BV (BE), Zurich Gadget AG (CH, bonded).

### 4.5 SKUs (~18) — raw + finished, with real packing specs

Raw components (examples; all cartons-per-pallet 20–72, pallet dims 1200×1000×~1200–1800mm, max ≤ 900kg):

| Code | Name | Unit | Cartons/pallet | qty/carton | Est. unit weight |
|---|---|---|---|---|---|
| RAW-PCM-SOC | SoC module | pcs | 48 | 100 | ~0.25 kg |
| RAW-BATT-LI25 | Li-Ion pack 2500mAh | pcs | 60 | 50 | ~0.045 kg |
| RAW-DISP-6 | 6.5" TFT display | pcs | 30 | 20 | ~0.08kg f |
| RAW-CHG-USBC | USB-C charger 18W | pcs | 54 | 40 | ~0.12 kg |
| RAW-PCB-MB | Main PCB module | pcs | 48 | 60 | ~0.09 kg |
| RAW-PLT-ABS | ABS housing | pcs | 36 | 80 | ~0.035 kg |
| RAW-CBL-FX | Flex cable 40p | pcs | 72 | 100 | ~0.008 kg |
| RAW-MAG | Speaker magnet driver | pcs | 30 | 25 | ~0.42 kg |
| RAW-PACK-BOX | Retail carton (white) | pcs | 40 | 50 | ~0.06 kg |

**Finished goods** (FG: final SKUs sold to consumers; unit = piece, carton = sellable pack):

| Code | Name | MSRP | Cartons/pallet | qty/carton | Est. unit weight |
|---|---|---|---|---|---|
| FG-SPRK-MINI | Nexus Spark mini speaker | €39.99 | 60 | 12 | 0.35 kg |
| FG-SPRK-PRO | Nexus Spark Pro speaker | €129.99 | 30 | 8 | 1.1 kg |
| FG-EARB-AIR | Nexus AirBuds ANC | €89.99 | 48 | 20 | 0.05 |
| FG-EARB-SPORT | Nexus SportBuds | €59.99 | 48 | 20 | 0.06 |
| FG-HUB-HOME | Nexus SmartHub 8" | €249.99 | 20 | 4 | 1.4 kg |
| FG-CHG-GA | Nexus GaN 65W charger | €49.99 | 60 | 40 | 0.18 kg |

- All weights/dims plausible for electronics; no exotic values.

### 4.6 Locations used (derived from existing storage locations, no edits)

Only a **deterministic subset** of existing location rows gets pallets (racks + floor mix).
No location row is created/destroyed.

## 5. Determinism & invariants

1. **LCG only for id/variety** (mulberry32 with fixed seed + per-domain seeds (`SEED` env); `math.random()` never used).
2. **Volumes are scheduled** — monthly DKU (demand) tables per finished SKU × month, derived in `03-schedule.ts` from explicit curves: Q4 peak, Jan returns spike, 24–28-day supplier lead times.
3. **Units reconcile**: every pallet = `packagesPerPallet × quantityPerPackage` exactly; each movement falls out of pallet grain.
4. **Balance invariant**: `closing = opening + totalInbound − totalOutbound` per (sku, warehouse, month); verified by a unit test over the generated plan.
5. **No negative stock** at any point; pallets never double-allocated (per SKU+location codes verified via assertions).
6. **ISO 6346 check digit**: implemented + unit-tested (real algorithm).
7. **Document numbers** respect `lib/document-number.ts` format (`RCV/WH01/MM/YYYY/0001`).
8. **Pallet numbers** respect `lib/pallet-number.ts` (`YYMMDDXXXX`).

## 6. Architecture: clustered seeder under `apps/server/src/prisma/seed/`

```
seed/
  index.ts        # CLI entry: ordinal orchestration, env knobs, summary table
  config.ts       # env + constants (CAMPUS, WAREHOUSE caps, taxonomies)
  rng.ts          # mulberry32 only (no Math.random)
  catalog/        # typed data literals: warehouses, suppliers, carriers, customers,
                  # skus, users, plans
  steps/
    01-access.ts  # permissions/roles/users (moved from seed.ts; same behavior)
    02-master.ts  # warehouses (addresses only changed), SKUs, partners, carrier
    03-schedule.ts# deterministic monthly demand + inbound plan (the "story")
    04-receiving.ts
    05-internal.ts  # transfers, RMA, return-to-supplier, disposal, loss, found
    06-outbound.ts  # shipments
    07-balances.ts
    08-summary.ts
  lib/
    iso6346.ts    # container ID + check-digit
    check.ts      # invariant assertions (run at end of seed and in tests)
    reconcile.ts  # helper for movement insertion in month order
    docnumber.ts  # delegates to server lib (document-number.ts + pallet-number.ts)
  tests/
    iso6346.test.ts
    plan-invariants.test.ts
    docnumber.test.ts
```

- `seed.ts` entry point remains at `apps/server/src/prisma/seed.ts` and re-exports `seed/index.ts` (keeps `prisma.config.ts` wiring intact).
- No schema changes; no new deps (faker removed from the active seed path).

## 6. Acceptance criteria

1. `bun run db:seed` succeeds on a clean database (force-reset flow preserved).
2. Determininistic: running twice (fresh DB) yields identical realistic data (need to verify via hashing or spot-check; at minimum no `Math.random` in seed path).
3. All invariants hold (balance + uniqueness tests green).
4. Zero `faker` references in `seed/`.
5. WIP_COMPLETION=0, WIP_ISSUE=0; other 8 transaction types populated.
6. Dashboard/KPIs and 3D layout pages show realistic, readable data (pallets per location, warehouse occupancy within capacity).
7. `bun run check-types` green.

## 7. Risks & mitigations

- **Pallet shortages** (outbound demand can exceed inbound in early months) → schedule generator caps outbound at available stock (never negative); plan phase validates feasibility before insert.
- **Location constraints** (some locations may be `MAINTENANCE`/`FULL`) → only `ACTIVE` locations used; `FULL` status respected (never assigned).
- **Warehouse capacity** — deliveries trickle in; assert occupancy ≤ capacity in `check.ts`.
- **Existing tests** depend on `seed.ts` exports (e.g., permission seed functions) → keep the same public names/IDs compatible.

## 9. Out of scope

- No `WIP_*` data (per approval).
- No changes to `SkuInventoryBalance` schema or `Knowledge` seeding behavior (knowledge import stays from disk as today).
- No UI changes.

## 10. Verification commands (dev)

```bash
cd apps/server
bun run db:seed          # fresh reset flow + seed
bun src/prisma/seed/tests/... (bun test)
bun run check-types
```

---

**Self-review notes:**
- Decided to rename the company to "Nexus Electronics Inc." (fictional); carriers are real (Maersk/MSC/CMA CGM/Hapag-Lloyd/ONE) — should be noted in plan task for master data.
- WIP zero-docs must be explicitly asserted in acceptance test (not just assumed).
- Warehouse addresses: the design says "addresses only changed" — confirmed user allowed this (they approved "change only addresses to Rotterdam locations, names stay").