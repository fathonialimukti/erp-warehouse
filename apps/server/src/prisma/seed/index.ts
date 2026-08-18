import "dotenv/config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { prisma } from "../../lib/prisma.js";
import { importKnowledgeFromDisk } from "../../lib/knowledge-ingest.js";
import { seedPermissionsAndRoles, seedUsers } from "./steps/01-access.js";
import { seedMaster } from "./steps/02-master.js";
import { buildPlan } from "./steps/03-schedule.js";
import { runReceiving } from "./steps/04-receiving.js";
import { runInternal } from "./steps/05-internal.js";
import { runShipments } from "./steps/06-outbound.js";
import { runBalances } from "./steps/07-balances.js";
import { printSummary } from "./steps/08-summary.js";
import { LocationPool } from "./lib/location-pool.js";

const MONTH_WINDOW = Number(process.env.SEED_MONTHS) || 12;
const SKIP_RESET = process.env.SEED_SKIP_RESET === "true";

/**
 * Deletes the transaction-domain rows so a re-seed starts clean (unless
 * SKIP_RESET). Warehouses and storage locations are the user's own master data
 * and are NEVER deleted — the seed only updates warehouse addresses and uses
 * existing locations via the LocationPool.
 */
async function resetWarehouseDomain(): Promise<void> {
  await prisma.pickLine.deleteMany();
  await prisma.putawayLine.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.skuInventoryBalance.deleteMany();

  await prisma.subinventoryTransferItem.deleteMany();
  await prisma.lossTransactionItem.deleteMany();
  await prisma.foundTransactionItem.deleteMany();
  await prisma.disposalItem.deleteMany();
  await prisma.returnToSupplierItem.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.wipIssueItem.deleteMany();
  await prisma.rmaReceiptItem.deleteMany();
  await prisma.wipCompletionItem.deleteMany();
  await prisma.receivingTransactionItem.deleteMany();

  await prisma.subinventoryTransfer.deleteMany();
  await prisma.lossTransaction.deleteMany();
  await prisma.foundTransaction.deleteMany();
  await prisma.disposal.deleteMany();
  await prisma.returnToSupplier.deleteMany();
  await prisma.rmaReceipt.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.wipIssue.deleteMany();
  await prisma.wipCompletion.deleteMany();
  await prisma.receivingTransaction.deleteMany();

  await prisma.pallet.deleteMany();
  await prisma.supplierSku.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.sku.deleteMany();
}

export async function runSeed(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("🚀 Nexus Electronics seed starting…");
  console.log(`   Config: SEED_MONTHS=${MONTH_WINDOW}, SEED_SKIP_RESET=${SKIP_RESET}`);

  try {
    // 1. Access + users (raw SQL, same behavior as before)
    const roleIds = await seedPermissionsAndRoles(client);
    const userIds = await seedUsers(client, roleIds);

    // 2. Warehouse-domain reset (unless skipped)
    if (!SKIP_RESET) {
      await resetWarehouseDomain();
    }

    // 3. Master data (Prisma)
    const ids = await seedMaster(prisma);

    // 4. Build the deterministic plan (pure), sliced to the configured window.
    const events = buildPlan().filter((e) => e.monthIndex < MONTH_WINDOW);
    console.log(`   Plan: ${events.length} events (${MONTH_WINDOW} month window)`);

    // 5. Execute month-by-month so inbound is drained by outbound within each
    //    month (WH01 fills with raw receipts, then ships them to the assembler).
    const pool = new LocationPool(prisma);
    const ctx = {
      approver: userIds["ops.supervisor@nexus-electronics.eu"]!,
      operator: userIds["ops.receiving@nexus-electronics.eu"]!,
    };
    for (let m = 0; m < MONTH_WINDOW; m++) {
      const monthEvents = events.filter((e) => e.monthIndex === m);
      await runReceiving(prisma, ids, monthEvents, pool, ctx);
      await runShipments(prisma, ids, monthEvents, pool, ctx);
      await runInternal(prisma, ids, monthEvents, pool, ctx);
    }
    await runBalances(prisma);
    console.log("   Balances computed");

    // 6. Knowledge base bootstrap (DB source of truth; disk = seed input only)
    const knowledgeDir = join(dirname(fileURLToPath(import.meta.url)), "../../knowledge");
    const knowledgeSeed = await importKnowledgeFromDisk(prisma, knowledgeDir);
    console.log(
      `   Knowledge: ${knowledgeSeed.documents} doc(s), ${knowledgeSeed.chunks} chunk(s)`,
    );

    // 7. Summary + integrity
    await printSummary(prisma);
    console.log("🎉 Seed completed.");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    throw err;
  } finally {
    await client.end();
    await prisma.$disconnect();
  }
}
