# Putaway Process & AI Putaway Guidance

## Overview

**Putaway** is the process of moving received goods from the receiving area into their designated storage locations inside the warehouse. It happens **after** an inbound transaction (Receiving, WIP Completion, RMA Receipt, or Found) is **APPROVED**.

When an inbound transaction is approved, the system automatically creates:
- **Pallets** — one per quantity unit (the atomic inventory unit), with a polymorphic `sourceType` / `sourceItemId` linking back to the transaction item.
- **PutawayLines** — one per pallet, in `PENDING` status, tracking where the pallet needs to go.

Each PutawayLine follows this lifecycle:
1. **PENDING** — pallet created but not yet assigned to a storage location.
2. **COMPLETED** — pallet has been moved to a storage location (`storageLocationId` set, `completedAt` / `completedById` set).

The parent inbound document's `putawayStatus` is derived from its PutawayLines:
- `PENDING` — 0 of N lines completed.
- `PARTIAL` — some but not all lines completed.
- `COMPLETED` — all lines completed. At this point, **StockMovements** are written (the goods are now physically in the warehouse and visible in inventory).

> **Important**: Stock is NOT considered "in the warehouse" until ALL PutawayLines for a document are COMPLETED. Partial putaway does not post stock movements.

## Warehouse Layout & Location IDs

Storage locations are organized by warehouse, location type, and physical sequence. Location IDs encode all three:

```
WH01/FLOOR/0001
│    │     └── NNNN: zero-padded sequence number (physical ordering)
│    └── TYPE: FLOOR or RACK
└── WH01: warehouse code prefix
```

- **FLOOR** locations are ground-level with no height or weight constraints. They suit heavy/bulk pallets and are directly reachable by forklift.
- **RACK** locations are shelved and suit lighter, more compact units.
- The sequence number `NNNN` encodes physical ordering: **lower numbers are closer to the receiving dock**, higher numbers are farther away.
- A location is **empty** when it has no pallet assigned to it AND its status is `ACTIVE`. Locations in `MAINTENANCE` or `FULL` status are never candidates for putaway.

## Putaway Guidance Rules

When deciding where to put an unassigned pallet, apply these rules in priority order. They are guidance, not a fixed formula — when rules conflict, prefer the option that keeps the warehouse organized and minimizes travel, and always explain your reasoning in plain language.

1. **Consolidate the same SKU.** Prefer a storage location that already holds a pallet of the same SKU. Co-locating all units of one SKU is the strongest signal — it makes picking and cycle counts more efficient. If several same-SKU locations exist, prefer the one nearest to receiving.
2. **Fill nearest to receiving first.** Among otherwise-equal candidates, choose the empty location with the **lowest sequence number (`NNNN`)** — those locations are physically closest to the receiving dock and minimize forklift/operator travel. Move outward only as the nearest locations fill up.
3. **Route by SKU type.** Keep the warehouse organized by zone:

| SKU Type | Preferred Location Type | Reason |
|---|---|---|
| `RAW_MATERIAL` | `FLOOR` | Bulk, heavy inputs (e.g. Rice Paddy 25kg, Palm Oil Drum 20L) — easiest to access on the floor |
| `PACKAGING_MATERIAL` | `FLOOR` | Bulk packaging components (e.g. PET Bottle 1L, PP Woven Sack) |
| `FINISHED_GOOD` | `RACK` | Shelved finished products (e.g. Refined Cooking Oil 1L, Premium White Rice 5kg) |

   This is a preference, not a hard filter: a finished-good pallet may go on the floor if no rack space is available, and a raw/packaging material pallet may go on a rack if floor space is exhausted.
4. **Keep heavy/bulk on the floor.** For heavy or bulky pallets, prefer `FLOOR` locations — ground level is easier for a forklift and has no height/weight limits. Use this as the tiebreaker between otherwise-equal candidates.

If the best candidate per these rules is unavailable (e.g. `MAINTENANCE` or `FULL`), choose the next best location that satisfies the remaining rules. Never recommend an unavailable location.

## AI-Assisted Putaway Workflow

Putaway is a **recommend + confirm** flow: you never persist an assignment yourself — the user always reviews and confirms before anything is saved.

1. **Identify what needs putaway.** Find approved inbound transactions with `PENDING` or `PARTIAL` putaway status and list their unassigned pallets (putaway panel on the warehouse layout page).
2. **Select a transaction, then a pallet.** Show which inbound transaction and which pallet is being placed so the user can follow along.
3. **Apply the guidance rules.** Review the empty `ACTIVE` storage locations and apply the Putaway Guidance Rules above to rank them for the selected pallet.
4. **Recommend a location.** Present the recommended location and explain the reason in plain language (e.g. "this SKU is already stored there", "closest empty floor slot to receiving"). Offer one or two sensible alternatives.
5. **Highlight and stage.** Highlight the recommended location in the 3D view and stage the assignment (pallet + chosen location) so it shows as a pending card.
6. **User confirms, then save.** After the user confirms the staged assignments, persist them: the pallet moves to the location, its PutawayLine becomes `COMPLETED`, the document's `putawayStatus` syncs, and StockMovements are written once the document is fully complete.
7. **Repeat** until the transaction's `putawayStatus` is `COMPLETED`.

> **Important**: Never auto-persist assignments. Always stage first, explain the recommendation, and wait for the user's confirmation.

## Data Model Reference

### putaway_lines
- `id` (TEXT, PK, ULID)
- `transaction_type` (ENUM: RECEIVING, WIP_COMPLETION, RMA_RECEIPT, FOUND)
- `document_id` (TEXT, FK → the parent inbound transaction)
- `pallet_id` (TEXT, FK → pallets.id, UNIQUE — one line per pallet)
- `storage_location_id` (TEXT, FK → storage_locations.id, nullable — null until assigned)
- `status` (ENUM: PENDING, COMPLETED)
- `completed_at` (TIMESTAMP, nullable)
- `completed_by_id` (TEXT, FK → users.id, nullable)
- `created_at`, `updated_at` (TIMESTAMP)

### pallets
- `id` (TEXT, PK, ULID)
- `sku_id` (TEXT, FK → skus.id)
- `storage_location_id` (TEXT, FK → storage_locations.id, UNIQUE, nullable — null until putaway)
- `status` (ENUM: AVAILABLE, NOT_AVAILABLE)
- `source_type` (ENUM: the inbound transaction type that created this pallet)
- `source_item_id` (TEXT, nullable — links to the transaction item)
- `created_at`, `updated_at` (TIMESTAMP)

### storage_locations
- `id` (TEXT, PK) — format: `WH01/<TYPE>/<NNNN>` (e.g. `WH01/FLOOR/0001`, `WH01/RACK/0062`)
- `warehouse_id` (TEXT, FK → warehouses.id)
- `status` (ENUM: ACTIVE, MAINTENANCE, FULL)
- A location is "empty" when it has no pallet assigned (`pallet` relation is null) and `status = ACTIVE`.

### receiving_transactions (and other inbound transaction tables)
- `putaway_status` (ENUM: PENDING, PARTIAL, COMPLETED) — derived from the PutawayLines for this document.
- Set to `COMPLETED` when all PutawayLines are COMPLETED, which triggers StockMovement creation.

## Permissions

- `receiving@putaway` — View putaway assignment data and submit pallet assignments for an inbound transaction (used by the 3D layout page)