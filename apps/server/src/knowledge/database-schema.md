# Database Schema Reference

## Core Inventory Tables

### warehouses
- id (TEXT, PK, ULID)
- object_id (TEXT, nullable)
- name (TEXT)
- code (TEXT, unique, nullable)
- address (TEXT)
- total_capacity (INTEGER, nullable)
- photo (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### storage_locations
- id (TEXT, PK, ULID)
- warehouse_id (TEXT, FK -> warehouses.id)
- status (ENUM: ACTIVE, MAINTENANCE, FULL)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### skus
- id (TEXT, PK, ULID)
- code (TEXT, unique, nullable)
- name (TEXT)
- description (TEXT, nullable)
- photo (TEXT, nullable)
- base_unit (TEXT, default 'kg')
- type (ENUM: FINISHED_GOOD, RAW_MATERIAL, PACKAGING_MATERIAL)
- object_id (TEXT, nullable)
- package_name (TEXT, default 'carton')
- packages_per_pallet (INTEGER, default 1)
- quantity_per_package (DECIMAL, default 1)
- package_unit (TEXT, default 'kg')
- length (INTEGER, nullable)
- width (INTEGER, nullable)
- height (INTEGER, nullable)
- max_weight (DECIMAL, nullable)
- standard_cost (DECIMAL, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### pallets
- id (TEXT, PK, ULID)
- pallet_number (TEXT, unique, nullable)
- sku_id (TEXT, FK -> skus.id)
- storage_location_id (TEXT, FK -> storage_locations.id, unique, nullable)
- status (ENUM: AVAILABLE, NOT_AVAILABLE)
- source_type (ENUM: RECEIVING, WIP_COMPLETION, RMA_RECEIPT, FOUND, WIP_ISSUE, SHIPMENT, RETURN_TO_SUPPLIER, DISPOSAL, SUBINVENTORY_TRANSFER, LOSS)
- source_item_id (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### suppliers
- id (TEXT, PK, ULID)
- code (TEXT, unique, nullable)
- name (TEXT)
- email (TEXT, nullable)
- phone (TEXT, nullable)
- address (TEXT, nullable)
- notes (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### supplier_skus
- supplier_id (TEXT, FK -> suppliers.id)
- sku_id (TEXT, FK -> skus.id)
- supplier_item_code (TEXT, nullable)
- unit_price (DECIMAL, nullable)
- lead_time_days (INTEGER, nullable)
- minimum_order_qty (DECIMAL, nullable)
- is_preferred (BOOLEAN, default false)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- Primary Key: (supplier_id, sku_id)

### sku_inventory_balances
- id (TEXT, PK, ULID)
- sku_id (TEXT, FK -> skus.id)
- warehouse_id (TEXT, FK -> warehouses.id)
- year (INTEGER)
- month (INTEGER)
- opening_qty (DECIMAL, default 0)
- total_inbound (DECIMAL, default 0)
- total_outbound (DECIMAL, default 0)
- closing_qty (DECIMAL, default 0)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- Unique: (sku_id, warehouse_id, year, month)

### stock_movements
- id (TEXT, PK, ULID)
- transaction_type (ENUM: RECEIVING, WIP_COMPLETION, RMA_RECEIPT, FOUND, WIP_ISSUE, SHIPMENT, RETURN_TO_SUPPLIER, DISPOSAL, SUBINVENTORY_TRANSFER, LOSS)
- direction (ENUM: IN, OUT, NONE)
- document_id (TEXT)
- document_number (TEXT, nullable)
- sku_id (TEXT, FK -> skus.id)
- warehouse_id (TEXT, FK -> warehouses.id)
- quantity (DECIMAL)
- signed_qty (DECIMAL)
- transaction_date (DATE)
- posted_at (TIMESTAMP)
- posted_by_id (TEXT)
- notes (TEXT, nullable)

## Access Control Tables

### users
- id (TEXT, PK, ULID)
- email (TEXT, unique)
- name (TEXT, nullable)
- password (TEXT)
- role_id (TEXT, FK -> roles.id, nullable)
- photo (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### roles
- id (TEXT, PK, ULID)
- name (TEXT, unique)
- description (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### permissions
- id (TEXT, PK, ULID)
- name (TEXT, unique)
- description (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### role_has_permissions
- role_id (TEXT, FK -> roles.id)
- permission_id (TEXT, FK -> permissions.id)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- Primary Key: (role_id, permission_id)

## Transaction Tables (Inbound)

### receiving_transactions
- id (TEXT, PK, ULID)
- document_number (TEXT, unique, nullable)
- date (DATE)
- supplier_id (TEXT, FK -> suppliers.id)
- purchase_order_ref (TEXT, nullable)
- delivery_note_ref (TEXT, nullable)
- carrier (TEXT, nullable)
- tracking_number (TEXT, nullable)
- driver_name (TEXT, nullable)
- driver_contact (TEXT, nullable)
- vehicle_plate (TEXT, nullable)
- files (JSON, nullable)
- notes (TEXT, nullable)
- warehouse_id (TEXT, FK -> warehouses.id)
- created_by_id (TEXT, FK -> users.id)
- approved_by_id (TEXT, FK -> users.id, nullable)
- approved_at (TIMESTAMP, nullable)
- approval_history (JSON, nullable)
- approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED)
- putaway_status (ENUM: PENDING, PARTIAL, COMPLETED)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### receiving_transaction_items
- id (TEXT, PK, ULID)
- sort_order (INTEGER, default 0)
- receiving_transaction_id (TEXT, FK -> receiving_transactions.id)
- sku_id (TEXT, FK -> skus.id)
- quantity (DECIMAL)
- details (TEXT, nullable)

### wip_completions
- id (TEXT, PK, ULID)
- document_number (TEXT, unique, nullable)
- date (DATE)
- work_order_ref (TEXT, nullable)
- production_batch_no (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- warehouse_id (TEXT, FK -> warehouses.id)
- created_by_id (TEXT, FK -> users.id)
- approved_by_id (TEXT, FK -> users.id, nullable)
- approved_at (TIMESTAMP, nullable)
- approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED)
- putaway_status (ENUM: PENDING, PARTIAL, COMPLETED)

### rma_receipts
- id (TEXT, PK, ULID)
- document_number (TEXT, unique, nullable)
- date (DATE)
- original_shipment_id (TEXT, FK -> shipments.id, nullable)
- sales_order_ref (TEXT, nullable)
- return_reason (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- warehouse_id (TEXT, FK -> warehouses.id)
- approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED)
- putaway_status (ENUM: PENDING, PARTIAL, COMPLETED)

### found_transactions
- id (TEXT, PK, ULID)
- document_number (TEXT, unique, nullable)
- date (DATE)
- found_reason (TEXT, nullable)
- found_location (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- warehouse_id (TEXT, FK -> warehouses.id)
- approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED)
- putaway_status (ENUM: PENDING, PARTIAL, COMPLETED)

## Transaction Tables (Outbound)

### shipments
- id (TEXT, PK, ULID)
- document_number (TEXT, unique, nullable)
- date (DATE)
- shipment_number (TEXT, nullable)
- sales_order_ref (TEXT, nullable)
- recipient (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- carrier (TEXT, nullable)
- tracking_number (TEXT, nullable)
- warehouse_id (TEXT, FK -> warehouses.id)
- approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED)
- dispatch_status (ENUM: PENDING, PARTIAL, COMPLETED)
- dispatch_open_status (ENUM: OPEN, CLOSED)

### wip_issues
- id (TEXT, PK, ULID)
- document_number (TEXT, unique, nullable)
- date (DATE)
- work_order_ref (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- warehouse_id (TEXT, FK -> warehouses.id)
- approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED)
- dispatch_status (ENUM: PENDING, PARTIAL, COMPLETED)

### return_to_suppliers
- id (TEXT, PK, ULID)
- document_number (TEXT, unique, nullable)
- date (DATE)
- supplier_id (TEXT, FK -> suppliers.id)
- original_receiving_id (TEXT, FK -> receiving_transactions.id, nullable)
- return_reason (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- warehouse_id (TEXT, FK -> warehouses.id)
- approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED)
- dispatch_status (ENUM: PENDING, PARTIAL, COMPLETED)

### disposals
- id (TEXT, PK, ULID)
- document_number (TEXT, unique, nullable)
- date (DATE)
- disposal_reason (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- warehouse_id (TEXT, FK -> warehouses.id)
- approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED)
- dispatch_status (ENUM: PENDING, PARTIAL, COMPLETED)

### loss_transactions
- id (TEXT, PK, ULID)
- document_number (TEXT, unique, nullable)
- date (DATE)
- loss_reason (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- warehouse_id (TEXT, FK -> warehouses.id)
- approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED)

## Transaction Tables (Internal)

### subinventory_transfers
- id (TEXT, PK, ULID)
- document_number (TEXT, unique, nullable)
- date (DATE)
- transfer_reason (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- warehouse_id (TEXT, FK -> warehouses.id)
- approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED)

### subinventory_transfer_items
- id (TEXT, PK, ULID)
- subinventory_transfer_id (TEXT, FK -> subinventory_transfers.id)
- pallet_id (TEXT, FK -> pallets.id, unique)
- from_location_id (TEXT, FK -> storage_locations.id)
- to_location_id (TEXT, FK -> storage_locations.id)

## Putaway & Pick Lines

### putaway_lines
- id (TEXT, PK, ULID)
- transaction_type (ENUM: RECEIVING, WIP_COMPLETION, RMA_RECEIPT, FOUND)
- document_id (TEXT)
- pallet_id (TEXT, FK -> pallets.id, unique)
- storage_location_id (TEXT, FK -> storage_locations.id, nullable)
- status (ENUM: PENDING, COMPLETED)
- completed_at (TIMESTAMP, nullable)
- completed_by_id (TEXT, FK -> users.id, nullable)

### pick_lines
- id (TEXT, PK, ULID)
- transaction_type (ENUM: WIP_ISSUE, SHIPMENT, RETURN_TO_SUPPLIER, DISPOSAL)
- document_id (TEXT)
- pallet_id (TEXT, FK -> pallets.id, unique)
- from_location_id (TEXT, FK -> storage_locations.id, nullable)
- status (ENUM: PENDING, COMPLETED)
- assigned_at (TIMESTAMP, nullable)
- assigned_by_id (TEXT, FK -> users.id, nullable)
- completed_at (TIMESTAMP, nullable)
- completed_by_id (TEXT, FK -> users.id, nullable)

## Knowledge Base Tables

### knowledge_documents
- id (TEXT, PK, ULID)
- slug (TEXT, unique)
- title (TEXT)
- content (TEXT)
- is_active (BOOLEAN, default true)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### knowledge_chunks
- id (TEXT, PK, ULID)
- source (TEXT — matches document slug)
- title (TEXT)
- content (TEXT)
- embedding (VECTOR, nullable — for semantic search)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

## Other Tables

### notifications
- id (TEXT, PK, ULID)
- recipient_id (TEXT, FK -> users.id)
- created_by_id (TEXT, FK -> users.id, nullable)
- type (ENUM: INFO, SUCCESS, WARNING, ERROR)
- title (TEXT)
- message (TEXT)
- target_type (ENUM: SYSTEM, RECEIVING, WIP_COMPLETION, etc.)
- target_id (TEXT, nullable)
- is_read (BOOLEAN, default false)
- created_at (TIMESTAMP)

### activity_logs
- id (TEXT, PK, ULID)
- user_id (TEXT, FK -> users.id, nullable)
- action (ENUM: CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, LOGOUT, EXPORT, IMPORT)
- resource (TEXT — table name)
- resource_id (TEXT, nullable)
- message (TEXT)
- metadata (JSON, nullable)
- created_at (TIMESTAMP)

## Transaction Tables

All 10 transaction types follow a common pattern with these shared fields:
- id, document_number (unique), date (DATE), warehouse_id, created_by_id, approved_by_id (nullable), approved_at (nullable), approval_history (JSON, nullable), approval_status (ENUM: DRAFT, PROPOSED, APPROVED, REJECTED), created_at, updated_at

### receiving_transactions (GR - Inbound from supplier)
- supplier_id (TEXT, FK -> suppliers.id)
- purchase_order_ref (TEXT, nullable)
- delivery_note_ref (TEXT, nullable)
- carrier (TEXT, nullable)
- tracking_number (TEXT, nullable)
- driver_name (TEXT, nullable)
- driver_contact (TEXT, nullable)
- vehicle_plate (TEXT, nullable)
- files (JSON, nullable)
- notes (TEXT, nullable)
- putaway_status (ENUM: PENDING, PARTIAL, COMPLETED)

### receiving_transaction_items
- id (TEXT, PK)
- receiving_transaction_id (TEXT, FK -> receiving_transactions.id)
- sku_id (TEXT, FK -> skus.id)
- quantity (DECIMAL)
- details (TEXT, nullable)

### wip_completions (FGR - Inbound from production)
- work_order_ref (TEXT, nullable)
- production_batch_no (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- putaway_status (ENUM: PENDING, PARTIAL, COMPLETED)

### wip_completion_items
- id (TEXT, PK)
- wip_completion_id (TEXT, FK -> wip_completions.id)
- sku_id (TEXT, FK -> skus.id)
- quantity (DECIMAL)
- details (TEXT, nullable)

### rma_receipts (CRR - Inbound customer return)
- original_shipment_id (TEXT, FK -> shipments.id, nullable)
- sales_order_ref (TEXT, nullable)
- return_reason (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- putaway_status (ENUM: PENDING, PARTIAL, COMPLETED)

### rma_receipt_items
- id (TEXT, PK)
- rma_receipt_id (TEXT, FK -> rma_receipts.id)
- sku_id (TEXT, FK -> skus.id)
- quantity (DECIMAL)
- details (TEXT, nullable)

### found_transactions (FO - Inbound unexplained stock found)
- found_reason (TEXT, nullable)
- found_location (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- putaway_status (ENUM: PENDING, PARTIAL, COMPLETED)

### found_transaction_items
- id (TEXT, PK)
- found_transaction_id (TEXT, FK -> found_transactions.id)
- sku_id (TEXT, FK -> skus.id)
- quantity (DECIMAL)
- details (TEXT, nullable)

### wip_issues (MI - Outbound to production)
- work_order_ref (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- dispatch_status (ENUM: PENDING, PARTIAL, COMPLETED)

### wip_issue_items
- id (TEXT, PK)
- wip_issue_id (TEXT, FK -> wip_issues.id)
- sku_id (TEXT, FK -> skus.id)
- quantity (DECIMAL)
- details (TEXT, nullable)

### shipments (DO - Outbound to customer)
- shipment_number (TEXT, nullable)
- sales_order_ref (TEXT, nullable)
- recipient (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- carrier (TEXT, nullable)
- tracking_number (TEXT, nullable)
- dispatch_status (ENUM: PENDING, PARTIAL, COMPLETED)
- dispatch_open_status (ENUM: OPEN, CLOSED)

### shipment_items
- id (TEXT, PK)
- shipment_id (TEXT, FK -> shipments.id)
- sku_id (TEXT, FK -> skus.id)
- quantity (DECIMAL)
- details (TEXT, nullable)

### return_to_suppliers (SR - Outbound to supplier)
- supplier_id (TEXT, FK -> suppliers.id)
- original_receiving_id (TEXT, FK -> receiving_transactions.id, nullable)
- return_reason (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- dispatch_status (ENUM: PENDING, PARTIAL, COMPLETED)

### return_to_supplier_items
- id (TEXT, PK)
- return_to_supplier_id (TEXT, FK -> return_to_suppliers.id)
- sku_id (TEXT, FK -> skus.id)
- quantity (DECIMAL)
- details (TEXT, nullable)

### disposals (DS - Outbound scrap/write-off)
- disposal_reason (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)
- dispatch_status (ENUM: PENDING, PARTIAL, COMPLETED)

### disposal_items
- id (TEXT, PK)
- disposal_id (TEXT, FK -> disposals.id)
- sku_id (TEXT, FK -> skus.id)
- quantity (DECIMAL)
- details (TEXT, nullable)

### subinventory_transfers (TO - Internal location move)
- transfer_reason (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)

### subinventory_transfer_items
- id (TEXT, PK)
- subinventory_transfer_id (TEXT, FK -> subinventory_transfers.id)
- pallet_id (TEXT, FK -> pallets.id, unique)
- from_location_id (TEXT, FK -> storage_locations.id)
- to_location_id (TEXT, FK -> storage_locations.id)

### loss_transactions (LO - Outbound unexplained stock loss)
- loss_reason (TEXT, nullable)
- reference (TEXT, nullable)
- notes (TEXT, nullable)

### loss_transaction_items
- id (TEXT, PK)
- loss_transaction_id (TEXT, FK -> loss_transactions.id)
- sku_id (TEXT, FK -> skus.id)
- quantity (DECIMAL)
- details (TEXT, nullable)

## Execution Tables

### putaway_lines
- id (TEXT, PK)
- transaction_type (ENUM: same as transaction types)
- document_id (TEXT)
- pallet_id (TEXT, FK -> pallets.id, unique)
- storage_location_id (TEXT, FK -> storage_locations.id, nullable)
- status (ENUM: PENDING, COMPLETED)
- completed_at (TIMESTAMP, nullable)
- completed_by_id (TEXT, FK -> users.id, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### pick_lines
- id (TEXT, PK)
- transaction_type (ENUM: same as transaction types)
- document_id (TEXT)
- pallet_id (TEXT, FK -> pallets.id, unique)
- from_location_id (TEXT, FK -> storage_locations.id, nullable)
- status (ENUM: PENDING, COMPLETED)
- assigned_at (TIMESTAMP, nullable)
- assigned_by_id (TEXT, FK -> users.id, nullable)
- completed_at (TIMESTAMP, nullable)
- completed_by_id (TEXT, FK -> users.id, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

## People and Audit Tables

### users
- id (TEXT, PK)
- email (TEXT, unique)
- name (TEXT, nullable)
- password (TEXT) -- NEVER SELECT THIS
- role_id (TEXT, FK -> roles.id, nullable)
- photo (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### roles
- id (TEXT, PK)
- name (TEXT, unique)
- description (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### permissions
- id (TEXT, PK)
- name (TEXT, unique)
- description (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### role_has_permissions
- role_id (TEXT, FK -> roles.id)
- permission_id (TEXT, FK -> permissions.id)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- Primary Key: (role_id, permission_id)

### notifications
- id (TEXT, PK)
- user_id (TEXT, FK -> users.id)
- created_by_id (TEXT, FK -> users.id, nullable)
- title (TEXT)
- message (TEXT)
- type (ENUM: INFO, SUCCESS, WARNING, ERROR)
- target_type (ENUM: SYSTEM, RECEIVING, WIP_COMPLETION, RMA_RECEIPT, WIP_ISSUE, SHIPMENT, RETURN_TO_SUPPLIER, DISPOSAL, SUBINVENTORY_TRANSFER, LOSS, FOUND)
- target_id (TEXT, nullable)
- action_url (TEXT, nullable)
- metadata (JSON, nullable)
- is_read (BOOLEAN, default false)
- read_at (TIMESTAMP, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### activity_logs
- id (TEXT, PK)
- action (ENUM: CREATE, UPDATE, DELETE, APPROVE, REJECT, LOGIN, LOGOUT, EXPORT, IMPORT)
- user_id (TEXT, FK -> users.id)
- resource (TEXT)
- resource_id (TEXT)
- message (TEXT)
- detail (JSON, nullable)
- created_at (TIMESTAMP)

## Common Query Patterns

### Get available pallets for a SKU
SELECT p.id, p.status, sl.warehouse_id, s.code, s.name
FROM pallets p
JOIN skus s ON p.sku_id = s.id
LEFT JOIN storage_locations sl ON p.storage_location_id = sl.id
WHERE p.status = 'AVAILABLE' AND s.code = 'SKU-001';

### Get transaction summary by status
SELECT approval_status, COUNT(*) as count
FROM receiving_transactions
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY approval_status;

### Get monthly inventory balance
SELECT year, month, opening_qty, total_inbound, total_outbound, closing_qty
FROM sku_inventory_balances
WHERE sku_id = '01H...' AND warehouse_id = '01H...'
ORDER BY year DESC, month DESC
LIMIT 12;

### Get stock movements for a document
SELECT sm.transaction_type, sm.direction, sm.quantity, sm.signed_qty, sm.transaction_date,
       s.code as sku_code, s.name as sku_name
FROM stock_movements sm
JOIN skus s ON sm.sku_id = s.id
WHERE sm.document_id = '01H...'
ORDER BY sm.transaction_date DESC;

## Security Notes

- NEVER SELECT the password column from users table
- Use snake_case for all table and column names
- All IDs are ULID strings (26 characters)
- Decimal fields should be cast to numeric for calculations
- Date fields use DATE type (no time component)
- Timestamp fields use TIMESTAMP type
