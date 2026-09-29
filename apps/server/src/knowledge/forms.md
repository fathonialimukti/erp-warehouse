# Form Fields Reference

This document lists the exact field names used in each create/edit form. Use these exact field names when calling `fillFormFields`.

## Product Form (`/products/new`, `/products/:id/edit`)

Permission: `product@create` / `product@update`

Manages Finished Good SKUs. Each product is an independent SKU — variants (e.g. 1L vs 2L) are separate product records.

| Field name           | Type   | Description                            |
| -------------------- | ------ | -------------------------------------- |
| `code`               | string | Unique SKU code (e.g. FG-OIL-1L)       |
| `name`               | string | Product name                           |
| `description`        | string | Optional description                   |
| `baseUnit`           | string | Unit of measure (`pcs`, `kg`, `liter`) |
| `packageName`        | string | Package name (e.g. "carton", "box")    |
| `packagesPerPallet`  | number | Number of packages per pallet          |
| `quantityPerPackage` | number | Quantity per package                   |
| `packageUnit`        | string | Unit of measure per package            |
| `length`             | number | Optional length dimension (mm)         |
| `width`              | number | Optional width dimension (mm)          |
| `height`             | number | Optional height dimension (mm)         |
| `maxWeight`          | number | Optional maximum weight (kg)           |

## Supplier Form (`/suppliers/new`, `/suppliers/:id/edit`)

Permission: `supplier@create` / `supplier@update`

| Field name | Type   | Description           |
| ---------- | ------ | --------------------- |
| `code`     | string | Unique supplier code  |
| `name`     | string | Supplier company name |
| `email`    | string | Contact email         |
| `phone`    | string | Contact phone number  |
| `address`  | string | Physical address      |
| `notes`    | string | Optional notes        |

## Material (SKU) Form — on Supplier detail page (`/suppliers/:id`)

Permission: `sku@create` / `sku@update`

Raw material and packaging material SKUs are created and managed from the Supplier detail page.

| Field name           | Type    | Description                                         |
| -------------------- | ------- | --------------------------------------------------- |
| `code`               | string  | Unique SKU code (e.g. RM-RICE-25, PM-BOTTLE-1L)     |
| `name`               | string  | Material name                                       |
| `type`               | string  | `RAW_MATERIAL` or `PACKAGING_MATERIAL`              |
| `description`        | string  | Optional description                                |
| `baseUnit`           | string  | Unit of measure (`pcs`, `kg`, `liter`, `roll`)      |
| `packageName`        | string  | Package name (e.g. "sack", "drum", "bundle")        |
| `packagesPerPallet`  | number  | Number of packages per pallet                       |
| `quantityPerPackage` | number  | Quantity per package                                |
| `packageUnit`        | string  | Unit of measure per package                         |
| `length`             | number  | Optional length dimension (mm)                      |
| `width`              | number  | Optional width dimension (mm)                       |
| `height`             | number  | Optional height dimension (mm)                      |
| `maxWeight`          | number  | Optional maximum weight (kg)                        |
| `supplierItemCode`   | string  | Supplier's own item code for this SKU               |
| `unitPrice`          | number  | Unit price from this supplier                       |
| `leadTimeDays`       | number  | Lead time in days                                   |
| `minimumOrderQty`    | number  | Minimum order quantity                              |
| `isPreferred`        | boolean | Whether this is the preferred supplier for this SKU |

## Warehouse Form (`/warehouse/new`, `/warehouse/:id/edit`)

Permission: `warehouse@create` / `warehouse@update`

| Field name      | Type   | Description                             |
| --------------- | ------ | --------------------------------------- |
| `warehouseId`   | string | Unique warehouse ID / code              |
| `objectId`      | string | Optional external object ID             |
| `warehouseName` | string | Warehouse display name                  |
| `address`       | string | Physical address                        |
| `totalCapacity` | string | Total storage capacity (numeric string) |

## User Form (`/users/new`, `/users/:id/edit`)

Permission: `user@create` / `user@update`

| Field name | Type   | Description                   |
| ---------- | ------ | ----------------------------- |
| `name`     | string | Full name                     |
| `email`    | string | Email address                 |
| `password` | string | Password (create only)        |
| `roleId`   | string | Role ID to assign to the user |

## Role Form (`/access-control/roles/new`, `/access-control/roles/:id/edit`)

Permission: `role@create` / `role@update`

| Field name    | Type   | Description          |
| ------------- | ------ | -------------------- |
| `name`        | string | Role name            |
| `description` | string | Optional description |

## Shipment Form (`/outbound-transaction/shipment/new`)

Permission: `shipment@create` / `shipment@update`

| Field name       | Type   | Description               |
| ---------------- | ------ | ------------------------- |
| `documentNumber` | string | Document reference number |
| `date`           | string | Transaction date          |
| `shipmentNumber` | string | Shipment tracking number  |
| `salesOrderRef`  | string | Sales order reference     |
| `recipient`      | string | Recipient name or company |
| `reference`      | string | Internal reference        |
| `notes`          | string | Additional notes          |
| `carrier`        | string | Shipping carrier name     |
| `trackingNumber` | string | Carrier tracking number   |
| `warehouseId`    | string | Source warehouse ID       |

## Disposal Form (`/outbound-transaction/disposal/new`)

Permission: `disposal@create` / `disposal@update`

| Field name       | Type   | Description               |
| ---------------- | ------ | ------------------------- |
| `documentNumber` | string | Document reference number |
| `date`           | string | Transaction date          |
| `disposalReason` | string | Reason for disposal       |
| `reference`      | string | Internal reference        |
| `notes`          | string | Additional notes          |
| `warehouseId`    | string | Source warehouse ID       |

## Return to Supplier Form (`/outbound-transaction/return-to-supplier/new`)

Permission: `return-to-supplier@create` / `return-to-supplier@update`

| Field name            | Type   | Description                       |
| --------------------- | ------ | --------------------------------- |
| `documentNumber`      | string | Document reference number         |
| `date`                | string | Transaction date                  |
| `supplierId`          | string | Supplier ID to return to          |
| `originalReceivingId` | string | Original receiving transaction ID |
| `returnReason`        | string | Reason for return                 |
| `reference`           | string | Internal reference                |
| `notes`               | string | Additional notes                  |
| `warehouseId`         | string | Source warehouse ID               |

## WIP Issue Form (`/outbound-transaction/wip-issue/new`)

Permission: `wip-issue@create` / `wip-issue@update`

| Field name       | Type   | Description               |
| ---------------- | ------ | ------------------------- |
| `documentNumber` | string | Document reference number |
| `date`           | string | Transaction date          |
| `workOrderRef`   | string | Work order reference      |
| `reference`      | string | Internal reference        |
| `notes`          | string | Additional notes          |
| `warehouseId`    | string | Source warehouse ID       |

## Loss Transaction Form (`/outbound-transaction/loss/new`)

Permission: `loss@create` / `loss@update`

| Field name       | Type   | Description               |
| ---------------- | ------ | ------------------------- |
| `documentNumber` | string | Document reference number |
| `date`           | string | Transaction date          |
| `lossReason`     | string | Reason for loss           |
| `reference`      | string | Internal reference        |
| `notes`          | string | Additional notes          |
| `warehouseId`    | string | Source warehouse ID       |

## RMA Receipt Form (`/inbound-transaction/rma-receipt/new`)

Permission: `rma-receipt@create` / `rma-receipt@update`

| Field name           | Type   | Description                         |
| -------------------- | ------ | ----------------------------------- |
| `documentNumber`     | string | Document reference number           |
| `date`               | string | Transaction date                    |
| `originalShipmentId` | string | Original shipment ID being returned |
| `salesOrderRef`      | string | Original sales order reference      |
| `returnReason`       | string | Reason for return                   |
| `reference`          | string | Internal reference                  |
| `notes`              | string | Additional notes                    |
| `warehouseId`        | string | Receiving warehouse ID              |

## Receiving Transaction Form (`/inbound-transaction/receiving/new`)

Permission: `receiving@create` / `receiving@update`

| Field name         | Type   | Description               |
| ------------------ | ------ | ------------------------- |
| `documentNumber`   | string | Document reference number |
| `date`             | string | Transaction date          |
| `supplierId`       | string | Supplier ID               |
| `purchaseOrderRef` | string | Purchase order reference  |
| `deliveryNoteRef`  | string | Delivery note reference   |
| `carrier`          | string | Carrier / courier name    |
| `trackingNumber`   | string | Carrier tracking number   |
| `driverName`       | string | Driver's name             |
| `driverContact`    | string | Driver's phone / contact  |
| `vehiclePlate`     | string | Vehicle license plate     |
| `notes`            | string | Additional notes          |
| `warehouseId`      | string | Receiving warehouse ID    |

## WIP Completion Form (`/inbound-transaction/wip-completion/new`)

Permission: `wip-completion@create` / `wip-completion@update`

| Field name          | Type   | Description               |
| ------------------- | ------ | ------------------------- |
| `documentNumber`    | string | Document reference number |
| `date`              | string | Transaction date          |
| `workOrderRef`      | string | Work order reference      |
| `productionBatchNo` | string | Production batch number   |
| `reference`         | string | Internal reference        |
| `notes`             | string | Additional notes          |
| `warehouseId`       | string | Target warehouse ID       |

## Found Transaction Form (`/inbound-transaction/found/new`)

Permission: `found@create` / `found@update`

| Field name       | Type   | Description               |
| ---------------- | ------ | ------------------------- |
| `documentNumber` | string | Document reference number |
| `date`           | string | Transaction date          |
| `foundReason`    | string | Reason/context for find   |
| `foundLocation`  | string | Location where found      |
| `reference`      | string | Internal reference        |
| `notes`          | string | Additional notes          |
| `warehouseId`    | string | Target warehouse ID       |

## Stock Movement Index Page (`/stock-movement`)

This is a filterable list page, not a form. Use `fillFormFields` to set filters.

| Field name        | Type   | Description                                                                                                                                               |
| ----------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`          | string | Search document ID / number                                                                                                                               |
| `direction`       | string | Movement direction: `IN`, `OUT`, or `NONE`                                                                                                                |
| `transactionType` | string | One of: `RECEIVING`, `WIP_COMPLETION`, `RMA_RECEIPT`, `WIP_ISSUE`, `SHIPMENT`, `RETURN_TO_SUPPLIER`, `DISPOSAL`, `SUBINVENTORY_TRANSFER`, `LOSS`, `FOUND` |
| `warehouseId`     | string | Filter by warehouse ID                                                                                                                                    |
| `skuId`           | string | Filter by SKU ID                                                                                                                                          |
| `dateFrom`        | string | Filter from date (YYYY-MM-DD)                                                                                                                             |
| `dateTo`          | string | Filter to date (YYYY-MM-DD)                                                                                                                               |

## Other Index Pages (List Filters)

These list pages support a `search` filter via `fillFormFields`:

| Page           | Field name | Type   | Description                                 |
| -------------- | ---------- | ------ | ------------------------------------------- |
| SKU overview   | `search`   | string | Search by SKU code or name (read-only view) |
| Supplier list  | `search`   | string | Search by supplier name, code, or email     |
| Product list   | `search`   | string | Search by product code or name              |
| Users list     | `search`   | string | Search by user name or email                |
| Roles list     | `search`   | string | Search by role name or description          |
| Activity logs  | `search`   | string | Search by message, resource, action         |
| Warehouse list | `search`   | string | Search by warehouse name, code, or address  |

## Workflow for AI-assisted form filling

When user asks you to create or fill a form:

1. Call `navigateTo` to go to the create page.
2. Immediately after — call `fillFormFields` with all recommended values. Do NOT return a text message between `navigateTo` and `fillFormFields`.
3. After `fillFormFields` completes, confirm to the user what was filled and ask them to review and submit.

Do NOT submit the form on behalf of the user — always ask them to review and click Save/Submit themselves.

## AI Workflow for SelectSearch / Dropdown Fields

For fields that use `SelectSearch` or dropdown lists (supplierId, warehouseId, skuId):

1. Call `getPageContext` first to discover available options. The response includes:
   - `selectOptions` — keyed by queryKeyBase (e.g. `"supplier-form-search"`, `"warehouse-form-search"`) containing `[{ id, label }]`
2. Use the exact `id` values from these lists in `fillFormFields`
3. Never invent or guess IDs — only use IDs you can see in the page context

## AI Workflow for Items (Transaction Line Items)

All transaction forms have an `items` array field. Each item has: `skuId`, `quantity`, `details`.

**Field format for `fillFormFields`**:

```json
{
  "items": [
    { "skuId": "SKU-ID-1", "quantity": "50", "details": "Regular batch" },
    { "skuId": "SKU-ID-2", "quantity": "30", "details": "" }
  ]
}
```

**Workflow**:

1. Call `getPageContext` to discover available SKU IDs from `selectOptions`
2. Call `fillFormFields` with the full `items` array
3. Never invent IDs for skuId — use exact IDs from the page context
