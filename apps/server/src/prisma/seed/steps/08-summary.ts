import type { DbClient } from "../../../lib/prisma.js";

/** Prints the same summary table as the old seed.ts, plus pallet/container counts. */
export async function printSummary(db: DbClient): Promise<void> {
  const summary = {
    warehouses: await db.warehouse.count(),
    locations: await db.storageLocation.count(),
    skus: await db.sku.count(),
    pallets: await db.pallet.count(),
    stockMovements: await db.stockMovement.count(),
    receiving: await db.receivingTransaction.count(),
    wipCompletion: await db.wipCompletion.count(),
    rmaReceipt: await db.rmaReceipt.count(),
    wipIssue: await db.wipIssue.count(),
    shipment: await db.shipment.count(),
    returnToSupplier: await db.returnToSupplier.count(),
    disposal: await db.disposal.count(),
    subinventoryTransfer: await db.subinventoryTransfer.count(),
    loss: await db.lossTransaction.count(),
    found: await db.foundTransaction.count(),
    balances: await db.skuInventoryBalance.count(),
    knowledgeDocuments: await db.knowledgeDocument.count(),
    knowledgeChunks: await db.knowledgeChunk.count(),
  };

  console.log("\n🎉 Database seeding completed successfully!");
  console.log("\n📊 Summary:");
  console.table(summary);
}
