# ERP Warehouse Management System Overview

This is a Warehouse ERP (Enterprise Resource Planning) system for managing warehouse operations including receiving goods, shipping, inventory, and stock management.

## Main Features

- **Receiving Transactions** (`/receiving-transactions`): Record goods received from suppliers into the warehouse
- **Shipments** (`/shipments`): Record goods shipped out to customers
- **WIP Completions** (`/wip-completions`): Record work-in-progress completions from production
- **WIP Issues** (`/wip-issues`): Record materials issued for work-in-progress production
- **RMA Receipts** (`/rma-receipts`): Record returned merchandise authorizations from customers
- **Return to Supplier** (`/return-to-supplier`): Record goods returned back to suppliers
- **Subinventory Transfer** (`/subinventory-transfers`): Transfer goods between storage locations within the warehouse
- **Loss Transactions** (`/loss-transactions`): Record lost or damaged inventory
- **Found Transactions** (`/found-transactions`): Record inventory found during cycle counts
- **Disposals** (`/disposals`): Record disposed/scrapped inventory

## Supporting Modules

- **SKU Management** (`/skus`): Manage Stock Keeping Units (products)
- **Warehouse Management** (`/warehouses`): Manage warehouse facilities and storage locations
- **Supplier Management** (`/suppliers`): Manage supplier information
- **Pallet Management** (`/pallets`): Manage pallets used in warehouse operations
- **User Management** (`/users`): Manage system users (admin only)
- **Access Control** (`/access-control`): Manage roles and permissions (admin only)
- **Stock Movement** (`/stock-movements`): View stock movement history
- **Activity Log** (`/activity-logs`): View audit trail of system actions

## Document Lifecycle

Most transaction documents follow this approval workflow:
1. **DRAFT** - Initial state, document is being created and can be edited
2. **PROPOSED** - Document has been submitted for approval
3. **APPROVED** - Document has been approved and inventory has been updated
4. **REJECTED** - Document has been rejected and needs revision
