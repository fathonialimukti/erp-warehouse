-- Migration: purchase order item timestamps
-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

