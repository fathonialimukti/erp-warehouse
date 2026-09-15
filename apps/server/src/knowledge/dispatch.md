# Dispatch Process & AI Pick Guidance

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

## Pick Guidance Rules

When deciding which pallet to pick for an outbound item, apply these rules in priority order. They are guidance, not a fixed formula — when rules conflict, prefer the option that keeps picks efficient and moves older inventory first, and always explain your reasoning in plain language.

1. **Consolidate the same SKU.** Prefer reserved pallets that are already co-located with other pallets of the same SKU. This concentrates picks in one zone, making dispatch more efficient and minimizing forklift travel.
2. **Pick the oldest reserved first.** Prefer the reserved pallet with the **earliest `createdAt`**. Older inventory moves first, which respects shelf life and turnover order and prevents dead stock.
3. **Prefer dock proximity.** Prefer pallets from storage locations nearest to the dispatch dock. Location IDs follow the format `WH01/<TYPE>/<NNNN>` — **lower sequence numbers (`NNNN`) are closer to the dispatch area** and take less travel time.
4. **Prefer floor accessibility.** Prefer pallets in `FLOOR` locations: they are reachable directly by forklift, while rack picks may require additional equipment or time to reach.

If the best pallet per these rules is not available (e.g. already picked or location on `MAINTENANCE`), choose the next best that satisfies the remaining rules. Never recommend a pallet that is not in a pickable state.

## AI-Assisted Dispatch Workflow

Dispatch is a **recommend + stage + confirm + save** flow: you never auto-persist picks yourself — the user always reviews and confirms before anything is saved.

1. **Identify unpicked pallets.** Find approved outbound transactions with `PENDING`/`PARTIAL` dispatch status and their reserved-but-unpicked pallets (dispatch panel on the warehouse layout page).
2. **Select a transaction, then an item.** Show which outbound transaction and which line item is being picked so the user can follow along.
3. **Apply the guidance rules.** Review the reserved pallets for the item and apply the Pick Guidance Rules above to rank them.
4. **Recommend a pallet.** Present the recommended pallet and explain the reason in plain language (e.g. "oldest reserved pallet of this SKU", "closest floor location to the dock"). Offer one or two sensible alternatives.
5. **Highlight and stage.** Highlight the recommended pallet in the 3D view and stage the pick (outbound line item + pallet) so it shows as a pending card.
6. **User confirms, then save.** After the user confirms the staged picks, persist them: pallets leave their locations, PickLines become `COMPLETED`, and stock movements are written once the document is fully picked.
7. **Repeat** until all PickLines for the transaction are `COMPLETED`.

> **Important**: Dispatch is a "recommend + stage + confirm + save" flow. The AI NEVER auto-persists picks without the user's confirmation. Always stage first, tell the user to review, then save after they confirm.