# Transaction Execution Flow (Putaway & Dispatch)

This module documents the warehouse *execution* layer: the physical act of moving
pallets into storage (putaway) and out of storage (dispatch). It is distinct from
the transaction *document* lifecycle (DRAFT → PROPOSED → APPROVED) handled by the
per-type routers (`receiving-transaction.ts`, `shipment.ts`, etc.).

The execution routers live in `../transaction.ts` and are mounted as:

```
transactionRouter = { putaway: putawayRouter, dispatch: dispatchRouter }
```

## Direction & Type Mapping

| Direction | Router | Permission | Types (`PUTAWAY_TYPES` / `DISPATCH_TYPES`) |
|-----------|--------|------------|---------------------------------------------|
| IN (goods in) | `putawayRouter` | `transaction@putaway` | `RECEIVING`, `WIP_COMPLETION`, `RMA_RECEIPT`, `FOUND` |
| OUT (goods out) | `dispatchRouter` | `transaction@dispatch` | `WIP_ISSUE`, `SHIPMENT`, `RETURN_TO_SUPPLIER`, `DISPOSAL` |

The type sets are imported from `../lib/transaction.ts` (`PUTAWAY_TYPES`,
`DISPATCH_TYPES`). Do not hardcode them — add new types there so both the
document routers and the execution routers stay in sync.

## State Machine

### Putaway (IN)
- Each approved IN document has `PutawayLine` rows (one per pallet), created on
  approval by the document router.
- `PutawayLine.status` ∈ `PENDING` | `COMPLETED`.
- Parent `putawayStatus` ∈ `PENDING` | `PARTIAL` | `COMPLETED`, computed by
  `computePutawayStatus(db, type, documentId)` in `../lib/transaction.ts`.
- **Stock movements are written ONLY when `putawayStatus` becomes `COMPLETED`**,
  via `writeStockMovementsFromDocument(db, type, documentId, "IN", postedById)`.
  This is the single source of truth for inbound `StockMovement` rows — never
  write them on approval.

### Dispatch (OUT)
- Each approved OUT document has `PickLine` rows (one per pallet), created on
  approval. Pallets are reserved FIFO (`NOT_AVAILABLE`) at approval time.
- `PickLine.status` ∈ `PENDING` | `COMPLETED`.
- Parent `dispatchStatus` ∈ `PENDING` | `PARTIAL` | `COMPLETED`, computed inline
  in `syncDispatchStatus` (count of COMPLETED vs total).
- **Stock movements are written ONLY when `dispatchStatus` becomes `COMPLETED`**,
  via `writeStockMovementsFromDocument(db, type, documentId, "OUT", postedById)`.

## Procedures

### `putaway.list` / `dispatch.list`
Unified, paginated union across all types of that direction. Filters:
`approvalStatus` (default `APPROVED`), `putawayStatus`/`dispatchStatus`
(default "not COMPLETED"), `warehouseId`, `search` (reference / documentNumber).
Returns `{ data, meta }` where each row carries its `transactionType` so the
client can route to the correct detail page.

### `putaway.getAssignmentData` / `dispatch.getAssignmentData`
Single-document assignment payload for the 3D layout page:
- `putaway`: `{ putawayStatus, allPallets[] }` — each pallet with
  `palletId`, `palletNumber`, `storageLocationId` (null = unassigned),
  `palletTypeObjectId`, `skuName`, `palletTypeName`.
- `dispatch`: items + `pallets[]` tagged with `sourceItemId` so the scene can
  match pickable pallets to outbound items.

### `putaway.submitAssignment`
Idempotent replace-all of pallet → storage-location assignments for one IN
document. Guards:
- type must be a `PUTAWAY_TYPE` (else `BAD_REQUEST`)
- document must exist (`NOT_FOUND`) and be `APPROVED` (else `BAD_REQUEST`)
- location must exist (`NOT_FOUND`) and belong to the document's warehouse
  (else `BAD_REQUEST`)
- location must not be occupied by another pallet (else `CONFLICT`)
- re-submitting an already-`COMPLETED` line with the same location is a no-op

Each assignment marks the `PutawayLine` `COMPLETED`, moves the `Pallet` to the
location, and logs an `UPDATE` activity. Finally calls `syncPutawayStatus`, which
writes IN stock movements when fully complete.

### `dispatch.submitAssignment`
Idempotent replace-all of item → pallet picks for one OUT document. Mirrors
`putaway.submitAssignment`'s guards (type must be a `DISPATCH_TYPE`, document must
exist and be `APPROVED`, pallet must exist and be reserved `NOT_AVAILABLE`,
re-submitting an already-`COMPLETED` line is a no-op). Each assignment marks the
`PickLine` `COMPLETED`, and finally calls `syncDispatchStatus`, which writes OUT
stock movements when fully complete.

## Key Files
- `../transaction.ts` — `putawayRouter`, `dispatchRouter`, `syncPutawayStatus`, `syncDispatchStatus`
- `../lib/transaction.ts` — `PUTAWAY_TYPES`, `DISPATCH_TYPES`, `computePutawayStatus`, `writeStockMovementsFromDocument`, `resolveTransactionDocument`
- `../lib/activity-log.ts` — `logActivity()`
