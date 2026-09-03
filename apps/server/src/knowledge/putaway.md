# Putaway Process & AI-Assisted Putaway Strategy

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

## Strategy Rules

When recommending a storage location for an unassigned pallet, the AI applies these rules in priority order. Each rule contributes to a weighted score; the location with the highest score is recommended.

### 1. Same-SKU Grouping (+100)
Prefer storage locations that **already hold the same SKU**. This consolidates storage, makes picking more efficient (all units of one SKU are co-located), and simplifies cycle counts.

- Query: find storage locations where a pallet with the same `skuId` is already placed.
- This is the strongest signal — a location holding the same SKU gets +100.

### 2. FIFO by Location Proximity (+0..30)
Fill locations **nearest to the receiving/inbound area first** to minimize travel distance for the forklift/operator.

- Storage location IDs follow the format `WH01/<TYPE>/<NNNN>` (e.g. `WH01/FLOOR/0001`).
- The sequence number `NNNN` encodes physical ordering — lower numbers are closer to the receiving dock.
- Contribution: `(1 - seq / maxSeq) × 30`, so the lowest-numbered empty location gets +30, the highest gets +0.

### 3. Zone-Based by SKU Type (+50)
Different SKU types should go to designated zones to keep the warehouse organized:

| SKU Type | Preferred Location Type | Reason |
|---|---|---|
| `RAW_MATERIAL` | `FLOOR` | Bulk, heavy inputs (e.g. Rice Paddy 25kg, Palm Oil Drum 20L) — easier to access on floor |
| `PACKAGING_MATERIAL` | `FLOOR` | Bulk packaging components (e.g. PET Bottle 1L, PP Woven Sack) |
| `FINISHED_GOOD` | `RACK` | Shelved finished products (e.g. Refined Cooking Oil 1L, Premium White Rice 5kg) |

- This is a **soft preference** — the scorer awards +50 if the location type matches, but does not hard-filter mismatches.

### 4. Lower-Floor Priority (+15)
Prefer **floor-level locations** over rack/shelf locations for heavy or bulk pallets. Floor locations are easier to access with a forklift and have no height/weight constraints.

- Location type `FLOOR` gets +15; `RACK` gets +0.
- This is a minor tiebreaker on top of the zone rule.

### Scoring Summary

| Rule | Weight | Notes |
|---|---|---|
| Same-SKU grouping | +100 | Strongest signal — consolidate storage |
| FIFO proximity | +0..30 | Lower sequence = closer to receiving |
| Zone-based SKU type | +50 | Raw/packaging → floor; finished → rack |
| Lower-floor priority | +15 | Floor locations preferred |

**Max possible score**: 100 + 30 + 50 + 15 = 195 (same-SKU, lowest-seq, zone-match, floor location).

## Procedure (AI-Assisted Putaway)

The AI-assisted putaway flow is a **recommend + confirm** workflow. The AI never auto-persists assignments — the user always clicks to confirm.

1. **Identify unassigned pallets** — Navigate to `/warehouse/:id/layout` and use the PutawayPanel to list approved inbound transactions with PENDING/PARTIAL putaway status and their unassigned pallets.
2. **Select the transaction** — Call the client tool `selectPutawayTransaction` with `{ inboundTransactionId }` to open the putaway panel and load the transaction's unassigned pallets.
3. **Select a pallet** — Call the client tool `selectPutawayPallet` with `{ inboundTransactionId, palletId }` so the user sees which pallet is being placed.
4. **Score locations** — Apply the four strategy rules (same-SKU grouping, FIFO proximity, zone-based SKU type, lower-floor priority) to rank empty storage locations.
5. **Highlight the recommended location** — Call the client tool `highlightPutawayLocation` with `{ storageLocationId, reason }` to highlight the location in the 3D view.
6. **Stage assignments** — Call the client tool `stagePutawayAssignment` with `assignments: [{ palletId, storageLocationId }]` to show green cards in the panel.
7. **User confirms** — The user reviews the staged assignments and clicks Save.
8. **Save** — Call the client tool `savePutawayAssignments` to persist all staged assignments (moves pallets to locations, completes PutawayLines, syncs the parent document's putawayStatus).
9. **Continue** — Repeat until the transaction's putawayStatus is `COMPLETED`.

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

## AI Tool Reference

### Server-side tools (with `execute` — run on the server, return structured data)

| Tool | Input | Returns | When to use |
|---|---|---|---|
| `get_putaway_state` | `{ warehouseId?, inboundTransactionId? }` | Approved inbound transactions with unassigned pallets | First step — "what needs putaway?" |
| `get_available_storage_locations` | `{ warehouseId }` | Empty ACTIVE storage locations with placeholder name, type, sequence | "Where can I put this?" |
| `recommend_putaway_location` | `{ palletId, warehouseId }` | Top recommended location + 2-3 alternatives with scores and reasons | After get_putaway_state, to pick where a pallet goes |

### Client-side tools (no `execute` — drive the UI)

| Tool | Input | Action | When to use |
|---|---|---|---|
| `selectPutawayPallet` | `{ inboundTransactionId, palletId }` | Selects the pallet in the PutawayPanel | After recommending a location, to show which pallet is being placed |
| `highlightPutawayLocation` | `{ storageLocationId, reason }` | Highlights the location in the 3D view | After selecting the pallet, so the user can click to confirm |

### Persistence (NOT an AI tool — user-triggered)

| Procedure | Input | Action |
|---|---|---|
| `inboundTransaction.submitPalletAssignment` | `{ inboundTransactionId, assignments: [{ palletId, storageLocationId }] }` | Moves pallet to location, completes PutawayLine, syncs putawayStatus, writes StockMovements when fully complete |

## Permissions

- `receiving@putaway` — View putaway assignment data and submit pallet assignments for an inbound transaction (used by the 3D layout page)

## Storage Location ID Convention

Storage location IDs encode the warehouse, location type, and physical sequence:

```
WH01/FLOOR/0001
│    │     └── NNNN: zero-padded sequence number (proximity ordering)
│    └── TYPE: FLOOR or RACK (drives zone + lower-floor rules)
└── WH01: warehouse code prefix
```

- **FLOOR** locations are ground-level, suitable for heavy/bulk pallets.
- **RACK** locations are shelved, suitable for lighter finished goods.
- The 3D placeholder name is derived from the ID: `WH01/FLOOR/0001` → `floor_placeholder.001`, `WH01/RACK/0062` → `pallet_placeholder.062`.
