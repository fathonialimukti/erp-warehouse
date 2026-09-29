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
import { runHistory, clearMaintenanceFlags } from "./steps/10-history.js";
import { runOpenQueue } from "./steps/09-open-queue.js";
import { runReorderPolicies } from "./steps/11-reorder-policies.js";
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
  // The history step's maintenance flags are identified by the activity-log
  // rows it wrote, and the deleteMany below drops those rows — so clear the
  // flags FIRST or they would survive as orphaned MAINTENANCE slots and
  // accumulate two per warehouse on every re-seed.
  await clearMaintenanceFlags(prisma);

  // Workflow notifications carry no FK to their document, so drop the ones the
  // transaction/purchase-order workflows produced before their documents go.
  await prisma.notification.deleteMany({
    where: {
      targetType: {
        in: [
          "RECEIVING",
          "WIP_COMPLETION",
          "RMA_RECEIPT",
          "WIP_ISSUE",
          "SHIPMENT",
          "RETURN_TO_SUPPLIER",
          "DISPOSAL",
          "SUBINVENTORY_TRANSFER",
          "LOSS",
          "FOUND",
          "PURCHASE_ORDER",
        ],
      },
    },
  });

  await prisma.pickLine.deleteMany();
  await prisma.putawayLine.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.skuInventoryBalance.deleteMany();
  // The activity feed keeps the LOGIN/LOGOUT rows a real session produces, so
  // only the resources the transaction steps log are dropped with their rows.
  await prisma.activityLog.deleteMany({
    where: {
      resource: {
        in: [
          "purchase_order",
          "receiving_transaction",
          "wip_issue",
          "wip_completion",
          "loss_transaction",
          "found_transaction",
          "rma_receipt",
          "return_to_supplier",
          "disposal",
          "subinventory_transfer",
          "stock_count",
          "storage_location",
        ],
      },
    },
  });

  await prisma.stockCountLine.deleteMany();
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

  await prisma.stockCount.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
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
  await prisma.purchaseOrder.deleteMany();

  await prisma.pallet.deleteMany();
  await prisma.supplierSku.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.sku.deleteMany();
}

export async function runSeed(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("🚀 Nexus Electronics seed starting…");
  console.log(
    `   Config: SEED_MONTHS=${MONTH_WINDOW}, SEED_SKIP_RESET=${SKIP_RESET}`,
  );

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
    console.log(
      `   Plan: ${events.length} events (${MONTH_WINDOW} month window)`,
    );

    // 5. Execute month-by-month so inbound is drained by outbound within each
    //    month (WH01 fills with raw receipts, then ships them to the assembler).
    const pool = new LocationPool(prisma);
    const ctx = {
      approver: userIds["supervisor@aetherglo.com"]!,
      operator: userIds["inbound@aetherglo.com"]!,
    };
    for (let m = 0; m < MONTH_WINDOW; m++) {
      const monthEvents = events.filter((e) => e.monthIndex === m);
      await runReceiving(prisma, ids, monthEvents, pool, ctx);
      await runShipments(prisma, ids, monthEvents, pool, ctx);
      await runInternal(prisma, ids, monthEvents, pool, ctx);
    }

    // 4b. Leave work in flight. The plan above deliberately drains every
    //    document it creates, which left Pending Approvals / Putaway Queue /
    //    Dispatch Queue at 0 on a freshly seeded DB.
    //
    //    4a comes first: the monthly plan has no purchase orders, WIP issues,
    //    cycle counts or adjustment documents, so those domains read empty.
    //    The history step also packs the racks to the front, which the open
    //    queue then draws its dispatch stock from.
    //
    //    Sliced to the same window as the plan: without that, SEED_MONTHS=3
    //    still wrote twelve months of history on stock the 3-month plan never
    //    created.
    await runHistory(
      prisma,
      ids,
      pool,
      {
        approver: userIds["supervisor@aetherglo.com"]!,
        operator: userIds["inbound@aetherglo.com"]!,
        picker: userIds["outbound@aetherglo.com"]!,
        counter: userIds["inventory@aetherglo.com"]!,
        planner: userIds["manager@aetherglo.com"]!,
      },
      MONTH_WINDOW,
    );

    await runOpenQueue(prisma, ids, {
      approver: userIds["supervisor@aetherglo.com"]!,
      operator: userIds["inbound@aetherglo.com"]!,
      picker: userIds["outbound@aetherglo.com"]!,
    });
    console.log(
      "   Open queue: 5 awaiting approval, 4 to put away, 4 to dispatch",
    );

    // 4c. Reorder policies, last: the thresholds are derived from the on-hand
    //     pallet counts the open queue and history above left behind, so the
    //     Reorder page buckets items against the stock a recruiter sees.
    const reorder = await runReorderPolicies(prisma, ids);
    console.log(
      `   Reorder: ${reorder.policies} policies (${reorder.belowMin} below min, ` +
        `${reorder.belowReorder} below reorder point)`,
    );

    await runBalances(prisma, MONTH_WINDOW);
    console.log("   Balances computed");

    // 6. Knowledge base bootstrap (DB source of truth; disk = seed input only)
    const knowledgeDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../knowledge",
    );
    const knowledgeSeed = await importKnowledgeFromDisk(prisma, knowledgeDir);
    console.log(
      `   Knowledge: ${knowledgeSeed.documents} doc(s), ${knowledgeSeed.chunks} chunk(s)`,
    );

    // 7. AI settings. NO credential is ever committed or seeded: the keys come
    //    from the operator's environment, and an absent key leaves the row
    //    empty so `resolveAiValue` / `resolveSetting` fall through to the env
    //    var and then to "not configured". The app boots and every non-AI
    //    feature works with AI disabled — the assistant routes already degrade
    //    to a deterministic fallback reply (see routers/assistant.ts).
    const aiApiKey = process.env.AI_API_KEY?.trim() ?? "";
    const aiEmbeddingApiKey = process.env.AI_EMBEDDING_API_KEY?.trim() ?? "";
    const upsertSetting = (key: string, value: string) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });

    await upsertSetting("ai.baseUrl", "https://api.upstage.ai/v1");
    await upsertSetting("ai.apiKey", aiApiKey);
    await upsertSetting("ai.model", "solar-pro4");
    await upsertSetting("ai.embeddingBaseUrl", "https://api.upstage.ai/v1");
    await upsertSetting("ai.embeddingApiKey", aiEmbeddingApiKey);
    await upsertSetting("ai.embeddingModel", "solar-embedding-2-query");
    console.log(
      aiApiKey || aiEmbeddingApiKey
        ? "   AI settings: Upstage Solar Pro 4 + solar-embedding-2-query (keys from AI_API_KEY / AI_EMBEDDING_API_KEY)"
        : "   AI settings: base URLs and models seeded, keys EMPTY (AI_API_KEY / AI_EMBEDDING_API_KEY unset) — AI features disabled",
    );

    // 8. Summary + integrity
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
