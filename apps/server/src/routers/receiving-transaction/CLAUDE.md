# Receiving Transaction — Full Data Flow

## Overview
Receiving (GR — Goods Receipt) is the primary inbound transaction type. It accepts goods from a supplier into a warehouse.

## Router
`apps/server/src/routers/receiving-transaction.ts`

Procedures: `list`, `detail`, `create`, `update`, `delete`, `approve`, `reject`

## Data Model
- `ReceivingTransaction` — header: documentNumber, date, warehouseId, supplierId, purchaseOrderRef, deliveryNoteRef, carrier, trackingNumber, driverName/Contact, vehiclePlate, files, approvalStatus, approvalHistory
- `ReceivingTransactionItem` — items: skuId, quantity, details
- `PutawayLine` — created per pallet on APPROVED

## Approval Flow
1. **DRAFT → PROPOSED → APPROVED (or REJECTED)**
2. On APPROVED:
   - Pallet records are created (one per quantity unit of each item)
   - `PutawayLine` records are created (one per pallet, status: PENDING)
   - Pallets have `sourceType: 'RECEIVING'` and `sourceItemId` pointing to the item
3. On REJECTED: no pallets created, status updated

## Form Fields
- **Header**: documentNumber (auto-gen), date, warehouseId, supplierId
- **Optional**: purchaseOrderRef, deliveryNoteRef, carrier, trackingNumber, driverName, driverContact, vehiclePlate
- **Files**: uploaded documents/photos
- **Items**: skuId (required), quantity (min 1), details (optional)

## Client Pages
- `apps/client/src/pages/inbound-transaction/receiving/`
  - `ReceivingTransactionFormPage.tsx` — create/edit
  - `ReceivingTransactionDetailPage.tsx` — view + approve/reject
  - `_ReceivingTransactionTable.tsx` — list table

## Related Modules
- `supplier` — supplier lookup
- `sku` — SKU lookup
- `warehouse` — warehouse lookup
- `putaway` — putaway task management after approval
- `stockMovement` — immutable audit log written when putaway completes