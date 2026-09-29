import { tool } from "ai";
import { z } from "zod";
import { prisma } from "./prisma.js";

/**
 * Server-side AI tools for the Reorder Assistant.
 *
 * `get_reorder_suggestions` is fully deterministic (no LLM): it computes
 * 30-day average usage per SKU from stock_movements, days-of-cover from
 * available pallets, and suggests a reorder quantity when cover is low.
 * `draft_reorder_receiving` turns a confirmed suggestion into a DRAFT
 * receiving transaction (header + items only — human completes it).
 */

const REORDER_LEAD_DAYS = 14;
const LOOKBACK_DAYS = 30;

const draftReorderInputSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  createdById: z.string().min(1, "Created by is required"),
  items: z
    .array(
      z.object({
        skuId: z.string().min(1, "SKU is required"),
        quantity: z.coerce.number().positive("Quantity must be greater than 0"),
      }),
    )
    .min(1, "At least one item is required"),
});

export const reorderTools = {
  get_reorder_suggestions: tool({
    description:
      "Get reorder suggestions for SKUs running low on stock. " +
      "Computes 30-day average usage, days-of-cover from available pallets, and a suggested " +
      "reorder quantity (14-day lead-time buffer) for SKUs that are out of stock or below cover. " +
      "Includes the preferred supplier and estimated order value. " +
      "Use this when the user asks what to reorder, what is running low, or wants replenishment suggestions.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const since = new Date(
          Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
        );

        // 30-day OUT usage per SKU (from stock movements)
        const usageRows = await prisma.stockMovement.groupBy({
          by: ["skuId"],
          where: {
            direction: "OUT",
            transactionDate: { gte: since },
          },
          _sum: { quantity: true },
        });
        const usageBySku = new Map(
          usageRows.map((r) => [r.skuId, Number(r._sum.quantity ?? 0)]),
        );

        // Available pallets per SKU (with warehouse)
        const palletRows = await prisma.pallet.findMany({
          where: { status: "AVAILABLE" },
          select: {
            skuId: true,
            sku: {
              select: {
                id: true,
                code: true,
                name: true,
                packagesPerPallet: true,
                quantityPerPackage: true,
                standardCost: true,
                suppliers: {
                  select: {
                    supplierId: true,
                    supplier: { select: { name: true } },
                    unitPrice: true,
                    minimumOrderQty: true,
                    isPreferred: true,
                  },
                },
              },
            },
            storageLocation: {
              select: {
                warehouseId: true,
                warehouse: { select: { name: true } },
              },
            },
          },
        });

        // Aggregate per SKU (across warehouses)
        const skuMap = new Map<
          string,
          {
            skuId: string;
            skuCode: string | null;
            skuName: string;
            availableQty: number;
            standardCost: number | null;
            suppliers: Array<{
              supplierId: string;
              supplierName: string;
              unitPrice: number | null;
              minimumOrderQty: number | null;
              isPreferred: boolean;
            }>;
            warehouseNames: Set<string>;
          }
        >();

        for (const p of palletRows) {
          const sku = p.sku;
          const qtyPerPallet =
            Number(sku.quantityPerPackage) * sku.packagesPerPallet;
          const entry = skuMap.get(sku.id) ?? {
            skuId: sku.id,
            skuCode: sku.code,
            skuName: sku.name,
            availableQty: 0,
            standardCost: sku.standardCost ? Number(sku.standardCost) : null,
            suppliers: sku.suppliers.map((s) => ({
              supplierId: s.supplierId,
              supplierName: s.supplier.name,
              unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
              minimumOrderQty: s.minimumOrderQty
                ? Number(s.minimumOrderQty)
                : null,
              isPreferred: s.isPreferred,
            })),
            warehouseNames: new Set<string>(),
          };
          entry.availableQty += qtyPerPallet;
          if (p.storageLocation) {
            entry.warehouseNames.add(p.storageLocation.warehouse.name);
          }
          skuMap.set(sku.id, entry);
        }

        // Include SKUs with zero pallets (out of stock) — they have no pallet rows,
        // so query SKUs that have usage but no available pallets.
        const skusWithUsage = await prisma.sku.findMany({
          where: { id: { in: [...usageBySku.keys()] } },
          select: {
            id: true,
            code: true,
            name: true,
            standardCost: true,
            suppliers: {
              select: {
                supplierId: true,
                supplier: { select: { name: true } },
                unitPrice: true,
                minimumOrderQty: true,
                isPreferred: true,
              },
            },
          },
        });
        for (const sku of skusWithUsage) {
          if (!skuMap.has(sku.id)) {
            skuMap.set(sku.id, {
              skuId: sku.id,
              skuCode: sku.code,
              skuName: sku.name,
              availableQty: 0,
              standardCost: sku.standardCost ? Number(sku.standardCost) : null,
              suppliers: sku.suppliers.map((s) => ({
                supplierId: s.supplierId,
                supplierName: s.supplier.name,
                unitPrice: s.unitPrice ? Number(s.unitPrice) : null,
                minimumOrderQty: s.minimumOrderQty
                  ? Number(s.minimumOrderQty)
                  : null,
                isPreferred: s.isPreferred,
              })),
              warehouseNames: new Set<string>(),
            });
          }
        }

        const suggestions = [];
        for (const entry of skuMap.values()) {
          const avgDailyUsage =
            (usageBySku.get(entry.skuId) ?? 0) / LOOKBACK_DAYS;
          const daysOfCover =
            avgDailyUsage > 0 ? entry.availableQty / avgDailyUsage : Infinity;

          const reason =
            entry.availableQty === 0
              ? "OUT_OF_STOCK"
              : daysOfCover < REORDER_LEAD_DAYS
                ? "LOW_COVER"
                : "OK";
          if (reason === "OK") continue;

          const suggestedReorderQty = Math.ceil(
            avgDailyUsage * REORDER_LEAD_DAYS,
          );
          const preferred =
            entry.suppliers.find((s) => s.isPreferred) ??
            entry.suppliers[0] ??
            null;
          const unitPrice = preferred?.unitPrice ?? entry.standardCost;
          const estOrderValue = Math.round(
            suggestedReorderQty * (unitPrice ?? 0),
          );

          suggestions.push({
            skuId: entry.skuId,
            skuCode: entry.skuCode,
            skuName: entry.skuName,
            warehouseId: null,
            warehouseName:
              entry.warehouseNames.size > 0
                ? [...entry.warehouseNames].join(", ")
                : "Unknown",
            availableQty: Math.round(entry.availableQty),
            avgDailyUsage: Math.round(avgDailyUsage * 100) / 100,
            daysOfCover:
              daysOfCover === Infinity
                ? null
                : Math.round(daysOfCover * 10) / 10,
            suggestedReorderQty,
            preferredSupplierId: preferred?.supplierId ?? null,
            preferredSupplierName: preferred?.supplierName ?? null,
            unitPrice: unitPrice ?? null,
            estOrderValue,
            reason,
          });
        }

        suggestions.sort((a, b) => {
          const rank = { OUT_OF_STOCK: 0, LOW_COVER: 1 } as const;
          return (
            rank[a.reason as keyof typeof rank] -
            rank[b.reason as keyof typeof rank]
          );
        });

        return {
          suggestions,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        return {
          suggestions: [],
          generatedAt: new Date().toISOString(),
          error:
            error instanceof Error
              ? error.message
              : "Failed to compute reorder suggestions",
        };
      }
    },
  }),

  draft_reorder_receiving: tool({
    description:
      "Draft a DRAFT-status receiving transaction for confirmed reorder suggestions. " +
      "Creates the transaction header + items only — no pallets, no putaway lines. " +
      "The user must review and complete the draft in the UI. " +
      "Use this ONLY after the user confirms a reorder suggestion.",
    inputSchema: draftReorderInputSchema,
    // Pause until the user approves the draft in the chat UI (AI SDK v6).
    needsApproval: async () => true,
    execute: async ({ warehouseId, supplierId, createdById, items }) => {
      try {
        const created = await prisma.$transaction(async (tx) => {
          return tx.receivingTransaction.create({
            data: {
              date: new Date(),
              warehouseId,
              supplierId,
              createdById,
              approvalHistory: [],
              approvalStatus: "DRAFT",
              items: {
                create: items.map((item) => ({
                  skuId: item.skuId,
                  quantity: item.quantity,
                })),
              },
            },
            select: { id: true },
          });
        });

        return {
          draftCreated: true,
          transactionId: created.id,
          items,
        };
      } catch (error) {
        return {
          draftCreated: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to draft reorder receiving transaction",
        };
      }
    },
  }),
};
