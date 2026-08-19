-- Enable pgvector for the knowledge_chunks.embedding column
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "StorageLocationStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'FULL');

-- CreateEnum
CREATE TYPE "PalletStatus" AS ENUM ('AVAILABLE', 'NOT_AVAILABLE');

-- CreateEnum
CREATE TYPE "WarehouseTransactionType" AS ENUM ('RECEIVING', 'WIP_COMPLETION', 'RMA_RECEIPT', 'WIP_ISSUE', 'SHIPMENT', 'RETURN_TO_SUPPLIER', 'DISPOSAL', 'SUBINVENTORY_TRANSFER', 'LOSS', 'FOUND');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT', 'NONE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PROPOSED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PutawayStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DispatchOpenStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PutawayLineStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PickLineStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SkuType" AS ENUM ('FINISHED_GOOD', 'RAW_MATERIAL', 'PACKAGING_MATERIAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('SYSTEM', 'RECEIVING', 'WIP_COMPLETION', 'RMA_RECEIPT', 'WIP_ISSUE', 'SHIPMENT', 'RETURN_TO_SUPPLIER', 'DISPOSAL', 'SUBINVENTORY_TRANSFER', 'LOSS', 'FOUND');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role_id" TEXT,
    "photo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_has_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_has_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "object_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT NOT NULL,
    "total_capacity" INTEGER,
    "photo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "status" "StorageLocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "photo" TEXT,
    "base_unit" TEXT NOT NULL DEFAULT 'kg',
    "type" "SkuType" NOT NULL DEFAULT 'RAW_MATERIAL',
    "object_id" TEXT,
    "package_name" TEXT NOT NULL DEFAULT 'carton',
    "packages_per_pallet" INTEGER NOT NULL DEFAULT 1,
    "quantity_per_package" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "package_unit" TEXT NOT NULL DEFAULT 'kg',
    "length" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "max_weight" DECIMAL(65,30),
    "standard_cost" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pallets" (
    "id" TEXT NOT NULL,
    "pallet_number" TEXT,
    "sku_id" TEXT NOT NULL,
    "storage_location_id" TEXT,
    "status" "PalletStatus" NOT NULL DEFAULT 'AVAILABLE',
    "source_type" "WarehouseTransactionType",
    "source_item_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_skus" (
    "supplier_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "supplier_item_code" TEXT,
    "unit_price" DECIMAL(65,30),
    "lead_time_days" INTEGER,
    "minimum_order_qty" DECIMAL(65,30),
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_skus_pkey" PRIMARY KEY ("supplier_id","sku_id")
);

-- CreateTable
CREATE TABLE "sku_inventory_balances" (
    "id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "opening_qty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_inbound" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_outbound" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "closing_qty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "transaction_type" "WarehouseTransactionType" NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "document_id" TEXT NOT NULL,
    "document_number" TEXT,
    "sku_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "signed_qty" DECIMAL(65,30) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by_id" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_transactions" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier_id" TEXT NOT NULL,
    "purchase_order_ref" TEXT,
    "delivery_note_ref" TEXT,
    "carrier" TEXT,
    "tracking_number" TEXT,
    "driver_name" TEXT,
    "driver_contact" TEXT,
    "vehicle_plate" TEXT,
    "files" JSONB,
    "notes" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "putaway_status" "PutawayStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receiving_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_transaction_items" (
    "id" TEXT NOT NULL,
    "sort_order" INTEGER DEFAULT 0,
    "receiving_transaction_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "details" TEXT,

    CONSTRAINT "receiving_transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wip_completions" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "work_order_ref" TEXT,
    "production_batch_no" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "putaway_status" "PutawayStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wip_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wip_completion_items" (
    "id" TEXT NOT NULL,
    "sort_order" INTEGER DEFAULT 0,
    "wip_completion_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "details" TEXT,

    CONSTRAINT "wip_completion_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rma_receipts" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "original_shipment_id" TEXT,
    "sales_order_ref" TEXT,
    "return_reason" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "putaway_status" "PutawayStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rma_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rma_receipt_items" (
    "id" TEXT NOT NULL,
    "sort_order" INTEGER DEFAULT 0,
    "rma_receipt_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "details" TEXT,

    CONSTRAINT "rma_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wip_issues" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "work_order_ref" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatch_status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wip_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wip_issue_items" (
    "id" TEXT NOT NULL,
    "wip_issue_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "details" TEXT,

    CONSTRAINT "wip_issue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shipment_number" TEXT,
    "sales_order_ref" TEXT,
    "recipient" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "carrier" TEXT,
    "tracking_number" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatch_status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "dispatch_open_status" "DispatchOpenStatus" NOT NULL DEFAULT 'CLOSED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" TEXT NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "details" TEXT,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_to_suppliers" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier_id" TEXT NOT NULL,
    "original_receiving_id" TEXT,
    "return_reason" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatch_status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_to_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_to_supplier_items" (
    "id" TEXT NOT NULL,
    "return_to_supplier_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "details" TEXT,

    CONSTRAINT "return_to_supplier_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposals" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disposal_reason" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatch_status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposal_items" (
    "id" TEXT NOT NULL,
    "disposal_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "details" TEXT,

    CONSTRAINT "disposal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subinventory_transfers" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transfer_reason" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subinventory_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subinventory_transfer_items" (
    "id" TEXT NOT NULL,
    "subinventory_transfer_id" TEXT NOT NULL,
    "pallet_id" TEXT NOT NULL,
    "from_location_id" TEXT NOT NULL,
    "to_location_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subinventory_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loss_transactions" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loss_reason" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loss_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loss_transaction_items" (
    "id" TEXT NOT NULL,
    "loss_transaction_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "details" TEXT,

    CONSTRAINT "loss_transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "found_transactions" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "found_reason" TEXT,
    "found_location" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "putaway_status" "PutawayStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "found_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "found_transaction_items" (
    "id" TEXT NOT NULL,
    "found_transaction_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "details" TEXT,

    CONSTRAINT "found_transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "putaway_lines" (
    "id" TEXT NOT NULL,
    "transaction_type" "WarehouseTransactionType" NOT NULL,
    "document_id" TEXT NOT NULL,
    "pallet_id" TEXT NOT NULL,
    "storage_location_id" TEXT,
    "status" "PutawayLineStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "putaway_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_lines" (
    "id" TEXT NOT NULL,
    "transaction_type" "WarehouseTransactionType" NOT NULL,
    "document_id" TEXT NOT NULL,
    "pallet_id" TEXT NOT NULL,
    "from_location_id" TEXT,
    "status" "PickLineStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_at" TIMESTAMP(3),
    "assigned_by_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pick_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "target_type" "NotificationTargetType" NOT NULL DEFAULT 'SYSTEM',
    "target_id" TEXT,
    "action_url" TEXT,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "user_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "embedding_model" TEXT,
    "embedding_updated_at" TIMESTAMP(3),
    "embedding_status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "storage_locations_warehouse_id_status_idx" ON "storage_locations"("warehouse_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "skus_code_key" ON "skus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "pallets_pallet_number_key" ON "pallets"("pallet_number");

-- CreateIndex
CREATE UNIQUE INDEX "pallets_storage_location_id_key" ON "pallets"("storage_location_id");

-- CreateIndex
CREATE INDEX "pallets_sku_id_status_idx" ON "pallets"("sku_id", "status");

-- CreateIndex
CREATE INDEX "pallets_source_type_source_item_id_idx" ON "pallets"("source_type", "source_item_id");

-- CreateIndex
CREATE INDEX "pallets_pallet_number_idx" ON "pallets"("pallet_number");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "supplier_skus_supplier_id_idx" ON "supplier_skus"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_skus_sku_id_idx" ON "supplier_skus"("sku_id");

-- CreateIndex
CREATE INDEX "sku_inventory_balances_sku_id_idx" ON "sku_inventory_balances"("sku_id");

-- CreateIndex
CREATE INDEX "sku_inventory_balances_warehouse_id_year_month_idx" ON "sku_inventory_balances"("warehouse_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "sku_inventory_balances_sku_id_warehouse_id_year_month_key" ON "sku_inventory_balances"("sku_id", "warehouse_id", "year", "month");

-- CreateIndex
CREATE INDEX "stock_movements_sku_id_warehouse_id_transaction_date_idx" ON "stock_movements"("sku_id", "warehouse_id", "transaction_date");

-- CreateIndex
CREATE INDEX "stock_movements_document_id_idx" ON "stock_movements"("document_id");

-- CreateIndex
CREATE INDEX "stock_movements_transaction_type_transaction_date_idx" ON "stock_movements"("transaction_type", "transaction_date");

-- CreateIndex
CREATE INDEX "stock_movements_warehouse_id_transaction_date_idx" ON "stock_movements"("warehouse_id", "transaction_date");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_transactions_document_number_key" ON "receiving_transactions"("document_number");

-- CreateIndex
CREATE INDEX "receiving_transactions_supplier_id_idx" ON "receiving_transactions"("supplier_id");

-- CreateIndex
CREATE INDEX "receiving_transactions_created_by_id_idx" ON "receiving_transactions"("created_by_id");

-- CreateIndex
CREATE INDEX "receiving_transactions_approved_by_id_idx" ON "receiving_transactions"("approved_by_id");

-- CreateIndex
CREATE INDEX "receiving_transactions_approval_status_idx" ON "receiving_transactions"("approval_status");

-- CreateIndex
CREATE INDEX "receiving_transactions_document_number_idx" ON "receiving_transactions"("document_number");

-- CreateIndex
CREATE INDEX "receiving_transactions_date_idx" ON "receiving_transactions"("date");

-- CreateIndex
CREATE INDEX "receiving_transactions_warehouse_id_idx" ON "receiving_transactions"("warehouse_id");

-- CreateIndex
CREATE INDEX "receiving_transactions_approval_status_date_idx" ON "receiving_transactions"("approval_status", "date");

-- CreateIndex
CREATE INDEX "receiving_transaction_items_receiving_transaction_id_idx" ON "receiving_transaction_items"("receiving_transaction_id");

-- CreateIndex
CREATE INDEX "receiving_transaction_items_sku_id_idx" ON "receiving_transaction_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "wip_completions_document_number_key" ON "wip_completions"("document_number");

-- CreateIndex
CREATE INDEX "wip_completions_created_by_id_idx" ON "wip_completions"("created_by_id");

-- CreateIndex
CREATE INDEX "wip_completions_approved_by_id_idx" ON "wip_completions"("approved_by_id");

-- CreateIndex
CREATE INDEX "wip_completions_approval_status_idx" ON "wip_completions"("approval_status");

-- CreateIndex
CREATE INDEX "wip_completions_document_number_idx" ON "wip_completions"("document_number");

-- CreateIndex
CREATE INDEX "wip_completions_date_idx" ON "wip_completions"("date");

-- CreateIndex
CREATE INDEX "wip_completions_warehouse_id_idx" ON "wip_completions"("warehouse_id");

-- CreateIndex
CREATE INDEX "wip_completions_approval_status_date_idx" ON "wip_completions"("approval_status", "date");

-- CreateIndex
CREATE INDEX "wip_completion_items_wip_completion_id_idx" ON "wip_completion_items"("wip_completion_id");

-- CreateIndex
CREATE INDEX "wip_completion_items_sku_id_idx" ON "wip_completion_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "rma_receipts_document_number_key" ON "rma_receipts"("document_number");

-- CreateIndex
CREATE INDEX "rma_receipts_original_shipment_id_idx" ON "rma_receipts"("original_shipment_id");

-- CreateIndex
CREATE INDEX "rma_receipts_created_by_id_idx" ON "rma_receipts"("created_by_id");

-- CreateIndex
CREATE INDEX "rma_receipts_approved_by_id_idx" ON "rma_receipts"("approved_by_id");

-- CreateIndex
CREATE INDEX "rma_receipts_approval_status_idx" ON "rma_receipts"("approval_status");

-- CreateIndex
CREATE INDEX "rma_receipts_document_number_idx" ON "rma_receipts"("document_number");

-- CreateIndex
CREATE INDEX "rma_receipts_date_idx" ON "rma_receipts"("date");

-- CreateIndex
CREATE INDEX "rma_receipts_warehouse_id_idx" ON "rma_receipts"("warehouse_id");

-- CreateIndex
CREATE INDEX "rma_receipts_approval_status_date_idx" ON "rma_receipts"("approval_status", "date");

-- CreateIndex
CREATE INDEX "rma_receipt_items_rma_receipt_id_idx" ON "rma_receipt_items"("rma_receipt_id");

-- CreateIndex
CREATE INDEX "rma_receipt_items_sku_id_idx" ON "rma_receipt_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "wip_issues_document_number_key" ON "wip_issues"("document_number");

-- CreateIndex
CREATE INDEX "wip_issues_created_by_id_idx" ON "wip_issues"("created_by_id");

-- CreateIndex
CREATE INDEX "wip_issues_approved_by_id_idx" ON "wip_issues"("approved_by_id");

-- CreateIndex
CREATE INDEX "wip_issues_approval_status_idx" ON "wip_issues"("approval_status");

-- CreateIndex
CREATE INDEX "wip_issues_document_number_idx" ON "wip_issues"("document_number");

-- CreateIndex
CREATE INDEX "wip_issues_date_idx" ON "wip_issues"("date");

-- CreateIndex
CREATE INDEX "wip_issues_warehouse_id_idx" ON "wip_issues"("warehouse_id");

-- CreateIndex
CREATE INDEX "wip_issues_approval_status_date_idx" ON "wip_issues"("approval_status", "date");

-- CreateIndex
CREATE INDEX "wip_issue_items_wip_issue_id_idx" ON "wip_issue_items"("wip_issue_id");

-- CreateIndex
CREATE INDEX "wip_issue_items_sku_id_idx" ON "wip_issue_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_document_number_key" ON "shipments"("document_number");

-- CreateIndex
CREATE INDEX "shipments_created_by_id_idx" ON "shipments"("created_by_id");

-- CreateIndex
CREATE INDEX "shipments_approved_by_id_idx" ON "shipments"("approved_by_id");

-- CreateIndex
CREATE INDEX "shipments_approval_status_idx" ON "shipments"("approval_status");

-- CreateIndex
CREATE INDEX "shipments_dispatch_status_idx" ON "shipments"("dispatch_status");

-- CreateIndex
CREATE INDEX "shipments_document_number_idx" ON "shipments"("document_number");

-- CreateIndex
CREATE INDEX "shipments_date_idx" ON "shipments"("date");

-- CreateIndex
CREATE INDEX "shipments_warehouse_id_idx" ON "shipments"("warehouse_id");

-- CreateIndex
CREATE INDEX "shipments_approval_status_date_idx" ON "shipments"("approval_status", "date");

-- CreateIndex
CREATE INDEX "shipment_items_shipment_id_idx" ON "shipment_items"("shipment_id");

-- CreateIndex
CREATE INDEX "shipment_items_sku_id_idx" ON "shipment_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_to_suppliers_document_number_key" ON "return_to_suppliers"("document_number");

-- CreateIndex
CREATE INDEX "return_to_suppliers_supplier_id_idx" ON "return_to_suppliers"("supplier_id");

-- CreateIndex
CREATE INDEX "return_to_suppliers_original_receiving_id_idx" ON "return_to_suppliers"("original_receiving_id");

-- CreateIndex
CREATE INDEX "return_to_suppliers_created_by_id_idx" ON "return_to_suppliers"("created_by_id");

-- CreateIndex
CREATE INDEX "return_to_suppliers_approved_by_id_idx" ON "return_to_suppliers"("approved_by_id");

-- CreateIndex
CREATE INDEX "return_to_suppliers_approval_status_idx" ON "return_to_suppliers"("approval_status");

-- CreateIndex
CREATE INDEX "return_to_suppliers_document_number_idx" ON "return_to_suppliers"("document_number");

-- CreateIndex
CREATE INDEX "return_to_suppliers_date_idx" ON "return_to_suppliers"("date");

-- CreateIndex
CREATE INDEX "return_to_suppliers_warehouse_id_idx" ON "return_to_suppliers"("warehouse_id");

-- CreateIndex
CREATE INDEX "return_to_suppliers_approval_status_date_idx" ON "return_to_suppliers"("approval_status", "date");

-- CreateIndex
CREATE INDEX "return_to_supplier_items_return_to_supplier_id_idx" ON "return_to_supplier_items"("return_to_supplier_id");

-- CreateIndex
CREATE INDEX "return_to_supplier_items_sku_id_idx" ON "return_to_supplier_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "disposals_document_number_key" ON "disposals"("document_number");

-- CreateIndex
CREATE INDEX "disposals_created_by_id_idx" ON "disposals"("created_by_id");

-- CreateIndex
CREATE INDEX "disposals_approved_by_id_idx" ON "disposals"("approved_by_id");

-- CreateIndex
CREATE INDEX "disposals_approval_status_idx" ON "disposals"("approval_status");

-- CreateIndex
CREATE INDEX "disposals_document_number_idx" ON "disposals"("document_number");

-- CreateIndex
CREATE INDEX "disposals_date_idx" ON "disposals"("date");

-- CreateIndex
CREATE INDEX "disposals_warehouse_id_idx" ON "disposals"("warehouse_id");

-- CreateIndex
CREATE INDEX "disposals_approval_status_date_idx" ON "disposals"("approval_status", "date");

-- CreateIndex
CREATE INDEX "disposal_items_disposal_id_idx" ON "disposal_items"("disposal_id");

-- CreateIndex
CREATE INDEX "disposal_items_sku_id_idx" ON "disposal_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "subinventory_transfers_document_number_key" ON "subinventory_transfers"("document_number");

-- CreateIndex
CREATE INDEX "subinventory_transfers_created_by_id_idx" ON "subinventory_transfers"("created_by_id");

-- CreateIndex
CREATE INDEX "subinventory_transfers_approved_by_id_idx" ON "subinventory_transfers"("approved_by_id");

-- CreateIndex
CREATE INDEX "subinventory_transfers_approval_status_idx" ON "subinventory_transfers"("approval_status");

-- CreateIndex
CREATE INDEX "subinventory_transfers_document_number_idx" ON "subinventory_transfers"("document_number");

-- CreateIndex
CREATE INDEX "subinventory_transfers_date_idx" ON "subinventory_transfers"("date");

-- CreateIndex
CREATE INDEX "subinventory_transfers_warehouse_id_idx" ON "subinventory_transfers"("warehouse_id");

-- CreateIndex
CREATE INDEX "subinventory_transfers_approval_status_date_idx" ON "subinventory_transfers"("approval_status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "subinventory_transfer_items_pallet_id_key" ON "subinventory_transfer_items"("pallet_id");

-- CreateIndex
CREATE INDEX "subinventory_transfer_items_subinventory_transfer_id_idx" ON "subinventory_transfer_items"("subinventory_transfer_id");

-- CreateIndex
CREATE INDEX "subinventory_transfer_items_from_location_id_idx" ON "subinventory_transfer_items"("from_location_id");

-- CreateIndex
CREATE INDEX "subinventory_transfer_items_to_location_id_idx" ON "subinventory_transfer_items"("to_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "loss_transactions_document_number_key" ON "loss_transactions"("document_number");

-- CreateIndex
CREATE INDEX "loss_transactions_created_by_id_idx" ON "loss_transactions"("created_by_id");

-- CreateIndex
CREATE INDEX "loss_transactions_approved_by_id_idx" ON "loss_transactions"("approved_by_id");

-- CreateIndex
CREATE INDEX "loss_transactions_approval_status_idx" ON "loss_transactions"("approval_status");

-- CreateIndex
CREATE INDEX "loss_transactions_document_number_idx" ON "loss_transactions"("document_number");

-- CreateIndex
CREATE INDEX "loss_transactions_date_idx" ON "loss_transactions"("date");

-- CreateIndex
CREATE INDEX "loss_transactions_warehouse_id_idx" ON "loss_transactions"("warehouse_id");

-- CreateIndex
CREATE INDEX "loss_transactions_approval_status_date_idx" ON "loss_transactions"("approval_status", "date");

-- CreateIndex
CREATE INDEX "loss_transaction_items_loss_transaction_id_idx" ON "loss_transaction_items"("loss_transaction_id");

-- CreateIndex
CREATE INDEX "loss_transaction_items_sku_id_idx" ON "loss_transaction_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "found_transactions_document_number_key" ON "found_transactions"("document_number");

-- CreateIndex
CREATE INDEX "found_transactions_created_by_id_idx" ON "found_transactions"("created_by_id");

-- CreateIndex
CREATE INDEX "found_transactions_approved_by_id_idx" ON "found_transactions"("approved_by_id");

-- CreateIndex
CREATE INDEX "found_transactions_approval_status_idx" ON "found_transactions"("approval_status");

-- CreateIndex
CREATE INDEX "found_transactions_document_number_idx" ON "found_transactions"("document_number");

-- CreateIndex
CREATE INDEX "found_transactions_date_idx" ON "found_transactions"("date");

-- CreateIndex
CREATE INDEX "found_transactions_warehouse_id_idx" ON "found_transactions"("warehouse_id");

-- CreateIndex
CREATE INDEX "found_transactions_approval_status_date_idx" ON "found_transactions"("approval_status", "date");

-- CreateIndex
CREATE INDEX "found_transaction_items_found_transaction_id_idx" ON "found_transaction_items"("found_transaction_id");

-- CreateIndex
CREATE INDEX "found_transaction_items_sku_id_idx" ON "found_transaction_items"("sku_id");

-- CreateIndex
CREATE UNIQUE INDEX "putaway_lines_pallet_id_key" ON "putaway_lines"("pallet_id");

-- CreateIndex
CREATE INDEX "putaway_lines_document_id_idx" ON "putaway_lines"("document_id");

-- CreateIndex
CREATE INDEX "putaway_lines_transaction_type_status_idx" ON "putaway_lines"("transaction_type", "status");

-- CreateIndex
CREATE INDEX "putaway_lines_storage_location_id_idx" ON "putaway_lines"("storage_location_id");

-- CreateIndex
CREATE UNIQUE INDEX "pick_lines_pallet_id_key" ON "pick_lines"("pallet_id");

-- CreateIndex
CREATE INDEX "pick_lines_document_id_idx" ON "pick_lines"("document_id");

-- CreateIndex
CREATE INDEX "pick_lines_transaction_type_status_idx" ON "pick_lines"("transaction_type", "status");

-- CreateIndex
CREATE INDEX "pick_lines_from_location_id_idx" ON "pick_lines"("from_location_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_target_type_target_id_idx" ON "notifications"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "notifications_created_by_id_idx" ON "notifications"("created_by_id");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_resource_resource_id_action_idx" ON "activity_logs"("resource", "resource_id", "action");

-- CreateIndex
CREATE INDEX "activity_logs_action_created_at_idx" ON "activity_logs"("action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_documents_slug_key" ON "knowledge_documents"("slug");

-- CreateIndex
CREATE INDEX "knowledge_chunks_source_idx" ON "knowledge_chunks"("source");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_has_permissions" ADD CONSTRAINT "role_has_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_has_permissions" ADD CONSTRAINT "role_has_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pallets" ADD CONSTRAINT "pallets_storage_location_id_fkey" FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_skus" ADD CONSTRAINT "supplier_skus_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_skus" ADD CONSTRAINT "supplier_skus_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_inventory_balances" ADD CONSTRAINT "sku_inventory_balances_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_inventory_balances" ADD CONSTRAINT "sku_inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_transactions" ADD CONSTRAINT "receiving_transactions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_transactions" ADD CONSTRAINT "receiving_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_transactions" ADD CONSTRAINT "receiving_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_transactions" ADD CONSTRAINT "receiving_transactions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_transaction_items" ADD CONSTRAINT "receiving_transaction_items_receiving_transaction_id_fkey" FOREIGN KEY ("receiving_transaction_id") REFERENCES "receiving_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_transaction_items" ADD CONSTRAINT "receiving_transaction_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_completions" ADD CONSTRAINT "wip_completions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_completions" ADD CONSTRAINT "wip_completions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_completions" ADD CONSTRAINT "wip_completions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_completion_items" ADD CONSTRAINT "wip_completion_items_wip_completion_id_fkey" FOREIGN KEY ("wip_completion_id") REFERENCES "wip_completions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_completion_items" ADD CONSTRAINT "wip_completion_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_receipts" ADD CONSTRAINT "rma_receipts_original_shipment_id_fkey" FOREIGN KEY ("original_shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_receipts" ADD CONSTRAINT "rma_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_receipts" ADD CONSTRAINT "rma_receipts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_receipts" ADD CONSTRAINT "rma_receipts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_receipt_items" ADD CONSTRAINT "rma_receipt_items_rma_receipt_id_fkey" FOREIGN KEY ("rma_receipt_id") REFERENCES "rma_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rma_receipt_items" ADD CONSTRAINT "rma_receipt_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_issues" ADD CONSTRAINT "wip_issues_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_issues" ADD CONSTRAINT "wip_issues_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_issues" ADD CONSTRAINT "wip_issues_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_issue_items" ADD CONSTRAINT "wip_issue_items_wip_issue_id_fkey" FOREIGN KEY ("wip_issue_id") REFERENCES "wip_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wip_issue_items" ADD CONSTRAINT "wip_issue_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_to_suppliers" ADD CONSTRAINT "return_to_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_to_suppliers" ADD CONSTRAINT "return_to_suppliers_original_receiving_id_fkey" FOREIGN KEY ("original_receiving_id") REFERENCES "receiving_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_to_suppliers" ADD CONSTRAINT "return_to_suppliers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_to_suppliers" ADD CONSTRAINT "return_to_suppliers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_to_suppliers" ADD CONSTRAINT "return_to_suppliers_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_to_supplier_items" ADD CONSTRAINT "return_to_supplier_items_return_to_supplier_id_fkey" FOREIGN KEY ("return_to_supplier_id") REFERENCES "return_to_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_to_supplier_items" ADD CONSTRAINT "return_to_supplier_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposals" ADD CONSTRAINT "disposals_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposals" ADD CONSTRAINT "disposals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposals" ADD CONSTRAINT "disposals_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_items" ADD CONSTRAINT "disposal_items_disposal_id_fkey" FOREIGN KEY ("disposal_id") REFERENCES "disposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disposal_items" ADD CONSTRAINT "disposal_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subinventory_transfers" ADD CONSTRAINT "subinventory_transfers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subinventory_transfers" ADD CONSTRAINT "subinventory_transfers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subinventory_transfers" ADD CONSTRAINT "subinventory_transfers_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subinventory_transfer_items" ADD CONSTRAINT "subinventory_transfer_items_subinventory_transfer_id_fkey" FOREIGN KEY ("subinventory_transfer_id") REFERENCES "subinventory_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subinventory_transfer_items" ADD CONSTRAINT "subinventory_transfer_items_pallet_id_fkey" FOREIGN KEY ("pallet_id") REFERENCES "pallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subinventory_transfer_items" ADD CONSTRAINT "subinventory_transfer_items_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subinventory_transfer_items" ADD CONSTRAINT "subinventory_transfer_items_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "storage_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_transactions" ADD CONSTRAINT "loss_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_transactions" ADD CONSTRAINT "loss_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_transactions" ADD CONSTRAINT "loss_transactions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_transaction_items" ADD CONSTRAINT "loss_transaction_items_loss_transaction_id_fkey" FOREIGN KEY ("loss_transaction_id") REFERENCES "loss_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loss_transaction_items" ADD CONSTRAINT "loss_transaction_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_transactions" ADD CONSTRAINT "found_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_transactions" ADD CONSTRAINT "found_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_transactions" ADD CONSTRAINT "found_transactions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_transaction_items" ADD CONSTRAINT "found_transaction_items_found_transaction_id_fkey" FOREIGN KEY ("found_transaction_id") REFERENCES "found_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "found_transaction_items" ADD CONSTRAINT "found_transaction_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_lines" ADD CONSTRAINT "putaway_lines_pallet_id_fkey" FOREIGN KEY ("pallet_id") REFERENCES "pallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_lines" ADD CONSTRAINT "putaway_lines_storage_location_id_fkey" FOREIGN KEY ("storage_location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "putaway_lines" ADD CONSTRAINT "putaway_lines_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_lines" ADD CONSTRAINT "pick_lines_pallet_id_fkey" FOREIGN KEY ("pallet_id") REFERENCES "pallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_lines" ADD CONSTRAINT "pick_lines_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "storage_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_lines" ADD CONSTRAINT "pick_lines_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pick_lines" ADD CONSTRAINT "pick_lines_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
