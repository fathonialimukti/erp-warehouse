# Form Fields Reference

This document lists the exact field names used in each create/edit form. Use these exact field names when calling `fillFormFields`.

## SKU Form (`/skus/create`, `/skus/:id/edit`)
Permission: `sku@create` / `sku@update`

| Field name    | Type   | Description                             |
|---------------|--------|-----------------------------------------|
| `skuCode`     | string | Unique SKU identifier / code            |
| `skuName`     | string | Human-readable product name             |
| `baseUnit`    | string | Unit of measure (`pcs`, `kg`, `liter`)  |
| `description` | string | Optional short product description      |

## Warehouse Form (`/warehouse/create`, `/warehouse/:id/edit`)
Permission: `warehouse@create` / `warehouse@update`

| Field name      | Type   | Description                            |
|-----------------|--------|----------------------------------------|
| `warehouseId`   | string | Unique warehouse ID / code             |
| `objectId`      | string | Optional external object ID            |
| `warehouseName` | string | Warehouse display name                 |
| `address`       | string | Physical address                       |
| `totalCapacity` | string | Total storage capacity (numeric string)|

## User Form (`/users/create`, `/users/:id/edit`)
Permission: `user@create` / `user@update`

| Field name | Type   | Description                        |
|------------|--------|------------------------------------|
| `name`     | string | Full name                          |
| `email`    | string | Email address                      |
| `password` | string | Password (create only)             |
| `roleId`   | string | Role ID to assign to the user      |

## Role Form (`/access-control/roles/create`, `/access-control/roles/:id/edit`)
Permission: `role@create` / `role@update`

| Field name    | Type   | Description          |
|---------------|--------|----------------------|
| `name`        | string | Role name            |
| `description` | string | Optional description |

## Shipment Form (`/outbound-transaction/shipment/create`)
Permission: `shipment@create` / `shipment@update`

| Field name      | Type   | Description                      |
|-----------------|--------|----------------------------------|
| `documentNumber`| string | Document reference number        |
| `shipmentNumber`| string | Shipment tracking number         |
| `salesOrderRef` | string | Sales order reference            |
| `recipient`     | string | Recipient name or company        |
| `reference`     | string | Internal reference               |
| `notes`         | string | Additional notes                 |
| `carrier`       | string | Shipping carrier name            |
| `trackingNumber`| string | Carrier tracking number          |
| `warehouseId`   | string | Source warehouse ID              |

## Disposal Form (`/outbound-transaction/disposal/create`)
Permission: `disposal@create` / `disposal@update`

| Field name      | Type   | Description               |
|-----------------|--------|---------------------------|
| `documentNumber`| string | Document reference number |
| `disposalReason`| string | Reason for disposal       |
| `reference`     | string | Internal reference        |
| `notes`         | string | Additional notes          |
| `warehouseId`   | string | Source warehouse ID       |

## Return to Supplier Form (`/outbound-transaction/return-to-supplier/create`)
Permission: `return_to_supplier@create` / `return_to_supplier@update`

| Field name          | Type   | Description                      |
|---------------------|--------|----------------------------------|
| `documentNumber`    | string | Document reference number        |
| `supplierId`        | string | Supplier ID to return to         |
| `originalReceivingId`| string| Original receiving transaction ID|
| `returnReason`      | string | Reason for return                |
| `reference`         | string | Internal reference               |
| `notes`             | string | Additional notes                 |
| `warehouseId`       | string | Source warehouse ID              |

## WIP Issue Form (`/outbound-transaction/wip-issue/create`)
Permission: `wip_issue@create` / `wip_issue@update`

| Field name      | Type   | Description               |
|-----------------|--------|---------------------------|
| `documentNumber`| string | Document reference number |
| `workOrderRef`  | string | Work order reference      |
| `reference`     | string | Internal reference        |
| `notes`         | string | Additional notes          |
| `warehouseId`   | string | Source warehouse ID       |

## Loss Transaction Form (`/outbound-transaction/loss/create`)
Permission: `loss@create` / `loss@update`

| Field name      | Type   | Description               |
|-----------------|--------|---------------------------|
| `documentNumber`| string | Document reference number |
| `lossReason`    | string | Reason for loss           |
| `reference`     | string | Internal reference        |
| `notes`         | string | Additional notes          |
| `warehouseId`   | string | Source warehouse ID       |

## RMA Receipt Form (`/inbound-transaction/rma-receipt/create`)
Permission: `rma_receipt@create` / `rma_receipt@update`

| Field name          | Type   | Description                       |
|---------------------|--------|-----------------------------------|
| `documentNumber`    | string | Document reference number         |
| `originalShipmentId`| string | Original shipment ID being returned|
| `salesOrderRef`     | string | Original sales order reference    |
| `returnReason`      | string | Reason for return                 |
| `reference`         | string | Internal reference                |
| `notes`             | string | Additional notes                  |
| `warehouseId`       | string | Receiving warehouse ID            |

## Receiving Transaction Form (`/inbound-transaction/receiving/create`)
Permission: `receiving_transaction@create` / `receiving_transaction@update`

| Field name        | Type   | Description                  |
|-------------------|--------|------------------------------|
| `documentNumber`  | string | Document reference number    |
| `supplierId`      | string | Supplier ID                  |
| `purchaseOrderRef`| string | Purchase order reference     |
| `deliveryNoteRef` | string | Delivery note reference      |
| `carrier`         | string | Carrier / courier name       |
| `trackingNumber`  | string | Carrier tracking number      |
| `driverName`      | string | Driver's name                |
| `driverContact`   | string | Driver's phone / contact     |
| `vehiclePlate`    | string | Vehicle license plate        |
| `notes`           | string | Additional notes             |
| `warehouseId`     | string | Receiving warehouse ID       |

## WIP Completion Form (`/inbound-transaction/wip-completion/create`)
Permission: `wip_completion@create` / `wip_completion@update`

| Field name         | Type   | Description               |
|--------------------|--------|---------------------------|
| `documentNumber`   | string | Document reference number |
| `workOrderRef`     | string | Work order reference      |
| `productionBatchNo`| string | Production batch number   |
| `reference`        | string | Internal reference        |
| `notes`            | string | Additional notes          |
| `warehouseId`      | string | Target warehouse ID       |

## Found Transaction Form (`/inbound-transaction/found/create`)
Permission: `found@create` / `found@update`

| Field name      | Type   | Description               |
|-----------------|--------|---------------------------|
| `documentNumber`| string | Document reference number |
| `foundReason`   | string | Reason/context for find   |
| `foundLocation` | string | Location where found      |
| `reference`     | string | Internal reference        |
| `notes`         | string | Additional notes          |
| `warehouseId`   | string | Target warehouse ID       |

## Workflow for AI-assisted form filling

When user asks you to create or fill a form:
1. Call `navigateTo` to go to the create page (e.g. `/skus/create`).
2. In the NEXT step — immediately after receiving the `navigateTo` result — call `fillFormFields` with
   all recommended values. Do NOT return a text message between `navigateTo` and `fillFormFields`.
   Continue tool calling directly without any intermediate text response.
3. After `fillFormFields` completes, confirm to the user what was filled and ask them to review and submit.

> Important: steps 1 and 2 must happen in the same conversation turn (two consecutive tool calls),
> not split across two user messages.

Do NOT submit the form on behalf of the user — always ask them to review and click Save/Submit themselves.
