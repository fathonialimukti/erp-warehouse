-- Migration: production readiness (settings, logs, prefs, FEFO, reorder, stock count, purchase orders)
-- CreateEnum
CREATE TYPE "SystemLogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PROPOSED', 'APPROVED', 'REJECTED', 'RECEIVING', 'CLOSED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationTargetType" ADD VALUE 'STOCK_COUNT';
ALTER TYPE "NotificationTargetType" ADD VALUE 'PURCHASE_ORDER';
ALTER TYPE "NotificationTargetType" ADD VALUE 'REORDER';

-- AlterTable
ALTER TABLE "found_transactions" ADD COLUMN     "source_id" TEXT,
ADD COLUMN     "source_type" TEXT;

-- AlterTable
ALTER TABLE "loss_transactions" ADD COLUMN     "source_id" TEXT,
ADD COLUMN     "source_type" TEXT;

-- AlterTable
ALTER TABLE "pallets" ADD COLUMN     "expiry_date" DATE,
ADD COLUMN     "lot_no" TEXT;

-- AlterTable
ALTER TABLE "permissions" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "receiving_transaction_items" ADD COLUMN     "purchase_order_item_id" TEXT;

-- AlterTable
ALTER TABLE "receiving_transactions" ADD COLUMN     "purchase_order_id" TEXT;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "token_version" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" TEXT NOT NULL,
    "notify_in_app" BOOLEAN NOT NULL DEFAULT true,
    "notify_email" BOOLEAN NOT NULL DEFAULT false,
    "default_warehouse_id" TEXT,
    "page_size" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" "SystemLogLevel" NOT NULL DEFAULT 'INFO',
    "source" TEXT NOT NULL DEFAULT 'app',
    "message" TEXT NOT NULL,
    "request_id" TEXT,
    "user_id" TEXT,
    "path" TEXT,
    "method" TEXT,
    "status_code" INTEGER,
    "duration_ms" INTEGER,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_reorder_policies" (
    "id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "min_qty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "max_qty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reorder_point" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "preferred_supplier_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_reorder_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warehouse_id" TEXT NOT NULL,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "is_blind_count" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "counted_by_id" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" TEXT NOT NULL,
    "stock_count_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "pallet_id" TEXT,
    "storage_location_id" TEXT,
    "system_qty" DECIMAL(65,30) NOT NULL,
    "counted_qty" DECIMAL(65,30),
    "variance" DECIMAL(65,30),
    "counted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "document_number" TEXT,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_date" DATE,
    "supplier_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approval_history" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "received_qty" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(65,30),
    "details" TEXT,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "system_logs_level_created_at_idx" ON "system_logs"("level", "created_at");

-- CreateIndex
CREATE INDEX "system_logs_source_created_at_idx" ON "system_logs"("source", "created_at");

-- CreateIndex
CREATE INDEX "system_logs_created_at_idx" ON "system_logs"("created_at");

-- CreateIndex
CREATE INDEX "sku_reorder_policies_warehouse_id_idx" ON "sku_reorder_policies"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "sku_reorder_policies_sku_id_warehouse_id_key" ON "sku_reorder_policies"("sku_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_counts_document_number_key" ON "stock_counts"("document_number");

-- CreateIndex
CREATE INDEX "stock_counts_warehouse_id_idx" ON "stock_counts"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_counts_status_idx" ON "stock_counts"("status");

-- CreateIndex
CREATE INDEX "stock_counts_document_number_idx" ON "stock_counts"("document_number");

-- CreateIndex
CREATE INDEX "stock_counts_created_by_id_idx" ON "stock_counts"("created_by_id");

-- CreateIndex
CREATE INDEX "stock_count_lines_stock_count_id_idx" ON "stock_count_lines"("stock_count_id");

-- CreateIndex
CREATE INDEX "stock_count_lines_sku_id_idx" ON "stock_count_lines"("sku_id");

-- CreateIndex
CREATE INDEX "stock_count_lines_pallet_id_idx" ON "stock_count_lines"("pallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_document_number_key" ON "purchase_orders"("document_number");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "purchase_orders_warehouse_id_idx" ON "purchase_orders"("warehouse_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "purchase_orders_created_by_id_idx" ON "purchase_orders"("created_by_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_sku_id_idx" ON "purchase_order_items"("sku_id");

-- CreateIndex
CREATE INDEX "pallets_expiry_date_idx" ON "pallets"("expiry_date");

-- CreateIndex
CREATE INDEX "receiving_transaction_items_purchase_order_item_id_idx" ON "receiving_transaction_items"("purchase_order_item_id");

-- CreateIndex
CREATE INDEX "receiving_transactions_purchase_order_id_idx" ON "receiving_transactions"("purchase_order_id");

-- AddForeignKey
ALTER TABLE "receiving_transactions" ADD CONSTRAINT "receiving_transactions_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_transaction_items" ADD CONSTRAINT "receiving_transaction_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_reorder_policies" ADD CONSTRAINT "sku_reorder_policies_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_reorder_policies" ADD CONSTRAINT "sku_reorder_policies_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_reorder_policies" ADD CONSTRAINT "sku_reorder_policies_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_fkey" FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_pallet_id_fkey" FOREIGN KEY ("pallet_id") REFERENCES "pallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
