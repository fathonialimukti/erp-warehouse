# Permissions Reference

## Permission Format

All permissions follow the format: `resource@action`

Examples: `receiving@approve`, `warehouse@create`, `user@delete`

## Full Permission List

### Product Management (Finished Goods)
- `product@read` — View products (finished good SKUs)
- `product@create` — Create new products
- `product@update` — Edit products
- `product@delete` — Delete products

### SKU Management (all types — primarily for raw/packaging via supplier page)
- `sku@read` — View SKU overview and raw/packaging material details
- `sku@create` — Create material SKUs (used on Supplier detail page)
- `sku@update` — Edit material SKUs
- `sku@delete` — Delete SKUs

### Supplier Management
- `supplier@read` — View suppliers and their linked material SKUs
- `supplier@create` — Create suppliers
- `supplier@update` — Edit suppliers and manage their material SKUs
- `supplier@delete` — Delete suppliers

### Receiving Transactions
- `receiving@read` — View receiving transactions
- `receiving@create` — Create new receiving transactions
- `receiving@update` — Edit receiving transactions (also used to propose)
- `receiving@delete` — Delete receiving transactions
- `receiving@approve` — Approve or reject receiving transactions

### Shipments
- `shipment@read` — View shipments
- `shipment@create` — Create new shipments
- `shipment@update` — Edit shipments
- `shipment@delete` — Delete shipments
- `shipment@approve` — Approve or reject shipments

### WIP Completions
- `wip-completion@read` — View WIP completions
- `wip-completion@create` — Create WIP completions
- `wip-completion@update` — Edit WIP completions
- `wip-completion@delete` — Delete WIP completions
- `wip-completion@approve` — Approve or reject WIP completions

### WIP Issues
- `wip-issue@read` — View WIP issues
- `wip-issue@create` — Create WIP issues
- `wip-issue@update` — Edit WIP issues
- `wip-issue@delete` — Delete WIP issues
- `wip-issue@approve` — Approve or reject WIP issues

### RMA Receipts
- `rma-receipt@read` — View RMA receipts
- `rma-receipt@create` — Create RMA receipts
- `rma-receipt@update` — Edit RMA receipts
- `rma-receipt@delete` — Delete RMA receipts
- `rma-receipt@approve` — Approve or reject RMA receipts

### Return to Supplier
- `return-to-supplier@read` — View return to supplier documents
- `return-to-supplier@create` — Create return to supplier
- `return-to-supplier@update` — Edit return to supplier
- `return-to-supplier@delete` — Delete return to supplier
- `return-to-supplier@approve` — Approve or reject return to supplier

### Subinventory Transfer
- `subinventory-transfer@read` — View subinventory transfers
- `subinventory-transfer@create` — Create subinventory transfers
- `subinventory-transfer@update` — Edit subinventory transfers
- `subinventory-transfer@delete` — Delete subinventory transfers
- `subinventory-transfer@approve` — Approve or reject subinventory transfers

### Loss Transactions
- `loss@read` — View loss transactions
- `loss@create` — Create loss transactions
- `loss@update` — Edit loss transactions
- `loss@delete` — Delete loss transactions
- `loss@approve` — Approve or reject loss transactions

### Found Transactions
- `found@read` — View found transactions
- `found@create` — Create found transactions
- `found@update` — Edit found transactions
- `found@delete` — Delete found transactions
- `found@approve` — Approve or reject found transactions

### Disposals
- `disposal@read` — View disposals
- `disposal@create` — Create disposals
- `disposal@update` — Edit disposals
- `disposal@delete` — Delete disposals
- `disposal@approve` — Approve or reject disposals

### Warehouse Management
- `warehouse@read` — View warehouses and storage locations
- `warehouse@create` — Create warehouses
- `warehouse@update` — Edit warehouses
- `warehouse@delete` — Delete warehouses

### User Management (Admin)
- `user@read` — View users
- `user@create` — Create users
- `user@update` — Edit users (including resetting passwords)
- `user@delete` — Delete users

### Access Control (Admin)
- `role@read` — View roles
- `role@create` — Create roles
- `role@update` — Edit roles
- `role@delete` — Delete roles
- `permission@read` — View permissions
- `permission@create` — Create permissions
- `permission@update` — Edit permissions
- `permission@delete` — Delete permissions

### Pallet Management
- `pallet@read` — View pallets
- `pallet@create` — Create pallets
- `pallet@update` — Edit pallets
- `pallet@delete` — Delete pallets

### Pallet Type Management
- `pallet_type@read` — View pallet types
- `pallet_type@create` — Create pallet types
- `pallet_type@update` — Edit pallet types
- `pallet_type@delete` — Delete pallet types

### Storage Location Management
- `storage_location@read` — View storage locations
- `storage_location@create` — Create storage locations
- `storage_location@update` — Edit storage locations
- `storage_location@delete` — Delete storage locations
- `storage_location@import` — Import storage locations via Excel

### Other
- `stock-movement@read` — View stock movement history
- `notification@read` — View notifications
- `notification@broadcast` — Send broadcast notifications
- `notification@delete` — Delete notifications
- `transaction@putaway` — View putaway assignment data, list/complete putaway lines, and submit pallet assignments for any inbound (IN) transaction type (3D layout page)
- `transaction@dispatch` — View dispatch assignment data, list/complete pick lines, and submit pallet dispatch assignments for any outbound (OUT) transaction type (3D layout page)
- `activity_log@read` — View activity audit log

### Inventory Aging Analyzer
- `inventoryAging@read` — View inventory aging analytics (dead stock, slow moving, value at risk)

## How to Assign Permissions to a User

1. Go to Access Control: navigate to `/access-control`
2. Click on Roles to view existing roles
3. Click on the role you want to modify
4. Add or remove permissions from that role
5. All users assigned to that role will automatically get the updated permissions

Alternatively, assign a different role to the user:
1. Go to Users: navigate to `/users`
2. Find the user and open their detail
3. Edit their role assignment
