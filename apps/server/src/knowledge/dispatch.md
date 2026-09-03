# Dispatch Process & AI-Assisted Pick Strategy

## Overview

**Dispatch** (also called **picking**) is the process of moving goods from storage locations to the staging/dispatch area for outbound shipment. It happens **after** an outbound transaction (Shipment, WIP Issue, Return to Supplier, or Disposal) is **APPROVED**.

When an outbound transaction is approved, the system automatically:
- Reserves pallets from available inventory (`AVAILABLE` → `NOT_AVAILABLE`) using **FIFO** (First In, First Out by `createdAt`)
- Creates **PickLines** — one per reserved pallet, in `PENDING` status, tracking which pallet to pick from which location

Each PickLine follows this lifecycle:
1. **PENDING** — pallet reserved but not yet picked from storage.
2. **COMPLETED** — pallet has been picked (`completedAt` / `completedById` set).

The parent outbound document's `dispatchStatus` is derived from its PickLines:
- `PENDING` — 0 of N lines completed.
- `PARTIAL` — some but not all lines completed.
- `COMPLETED` — all lines completed. At this point, **StockMovements** are written (the goods are now out of the warehouse and inventory is decremented).

> **Important**: Stock is NOT decremented until ALL PickLines for a document are COMPLETED. Partial dispatch does not post stock movements.

## Strategy Rules

When recommending which pallet to pick for an outbound item, the AI applies these rules in priority order. Each rule contributes to a weighted score; the pallet with the highest score is recommended.

### 1. Same-SKU Grouping (+100)
Prefer pallets that are **already co-located with the same SKU**. This consolidates picks (all units of one SKU in the same zone), making dispatch more efficient and minimizing forklift travel.

- Query: find reserved pallets with the same `skuId` in nearby storage locations.
- This is the strongest signal — a pallet co-located with others of the same SKU gets +100.

### 2. FIFO by Age (+0..30)
Pick the **oldest reserved pallet first** to respect shelf-life and turnover order. The pallet with the earliest `createdAt` gets the highest score.

- Contribution: `(1 - ageRank) × 30`, where `ageRank` is 0 for the oldest pallet and 1 for the newest.
- This ensures older inventory moves first (prevents dead stock).

### 3. Dock Proximity (+0..15)
Pick pallets from locations **nearest to the dispatch dock** first to minimize travel distance.

- Storage location IDs follow the format `WH01/<TYPE>/<NNNN>` (e.g. `WH01/FLOOR/0042`).
- The sequence number `NNNN` encodes physical ordering — lower numbers are closer to the dispatch area.
- Contribution: `(1 - seq / maxSeq) × 15`, so the lowest-numbered location gets +15, the highest gets +0.

### 4. Floor Accessibility (+15)
Prefer **floor-level** locations (`FLOOR` type) over rack locations because they are easier to access with a forklift for quick picks.

- Pallets on racks may require additional equipment or time to reach.
- Floor locations get a flat +15 bonus.

## AI-Assisted Dispatch Workflow

The AI assistant can help operators pick pallets via the warehouse 3D layout page's **DispatchPanel** (the outbound counterpart of putaway). The workflow mirrors putaway but in reverse:

1. **Identify unpicked pallets** — Navigate to `/warehouse/:id/layout` and use the DispatchPanel to list approved outbound transactions with unpicked pallets.
2. **Select transaction** — Call the client tool `selectDispatchTransaction` with `{ outboundTransactionId }` to open the dispatch panel and load the transaction's unpicked pallets.
3. **Select item** — Call the client tool `selectDispatchItem` with `{ outboundTransactionId, outboundTransactionItemId }` to activate the item.
4. **Score pallets** — Apply the four strategy rules (same-SKU grouping, FIFO by age, dock proximity, floor accessibility) to rank reserved pallets.
5. **Highlight pallet** — Call the client tool `highlightPickPallet` with `{ palletId, reason }` to show the recommended pick (green pulsing marker in 3D view).
6. **Stage picks** — Call the client tool `stagePickAssignment` with `assignments: [{ outboundTransactionItemId, palletId }]` to show green cards in the panel.
7. **User confirms** — The user reviews the staged picks and clicks Confirm.
8. **Save** — Call the client tool `savePickAssignments` to persist all staged picks (pallets leave locations, pick lines marked COMPLETED, stock movements written when fully picked).
9. **Repeat** — Continue until all pick lines are COMPLETED.

> **Important**: Dispatch is a "recommend + stage + confirm + save" flow. The AI NEVER auto-persists picks without the user's confirmation. Always stage first, tell the user to review, then save after they confirm.
