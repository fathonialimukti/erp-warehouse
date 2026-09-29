import { tool } from "ai";
import { z } from "zod";
import { prisma } from "./prisma.js";

/**
 * Server-side AI tools for "Describe & Create" — the flagship portfolio demo.
 *
 * The AI turns a natural-language sentence ("receive 50 pcs of SKU-PB-001 from
 * supplier X at warehouse A") into a DRAFT-status ERP transaction. The draft is
 * header + items only — NO pallets, NO putaway/pick lines, NO activity logs,
 * NO notifications. The human reviews the draft in the UI and completes it.
 *
 * Drafting (not finalizing) is deliberate: the approval workflow
 * (DRAFT → PROPOSED → APPROVED/REJECTED) stays human-owned, so the AI can
 * never bypass governance.
 */

const draftItemSchema = z.object({
  skuId: z.string().min(1, "SKU is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
});

const draftReceivingInputSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  createdById: z.string().min(1, "Created by is required"),
  items: z.array(draftItemSchema).min(1, "At least one item is required"),
});

const draftShipmentInputSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required"),
  recipient: z.string().optional(),
  createdById: z.string().min(1, "Created by is required"),
  items: z.array(draftItemSchema).min(1, "At least one item is required"),
});

export const draftTools = {
  draft_receiving_transaction: tool({
    description:
      "Draft a RECEIVING (inbound from supplier) transaction as DRAFT status from a natural-language request. " +
      "Creates the transaction header + items only — no pallets, no putaway lines. " +
      "The user must review and complete the draft in the UI. " +
      'Use this when the user describes receiving goods, e.g. "receive 50 pcs of SKU-PB-001 from supplier X at warehouse A". ' +
      "After drafting, tell the user the draft id and that it needs review + approval.",
    inputSchema: draftReceivingInputSchema,
    // Pause until the user approves the draft in the chat UI (AI SDK v6).
    needsApproval: async () => true,
    execute: async ({ warehouseId, supplierId, createdById, items }) => {
      try {
        const created = await prisma.$transaction(async (tx) => {
          return tx.receivingTransaction.create({
            data: {
              date: new Date(),
              supplierId,
              warehouseId,
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
              : "Failed to draft receiving transaction",
        };
      }
    },
  }),

  draft_shipment_transaction: tool({
    description:
      "Draft a SHIPMENT (outbound to customer) transaction as DRAFT status from a natural-language request. " +
      "Creates the transaction header + items only — no pick lines. " +
      "The user must review and complete the draft in the UI. " +
      'Use this when the user describes shipping goods, e.g. "ship 20 pcs of SKU-PB-001 to customer PT ABC from warehouse A". ' +
      "After drafting, tell the user the draft id and that it needs review + approval.",
    inputSchema: draftShipmentInputSchema,
    // Pause until the user approves the draft in the chat UI (AI SDK v6).
    needsApproval: async () => true,
    execute: async ({ warehouseId, recipient, createdById, items }) => {
      try {
        const created = await prisma.$transaction(async (tx) => {
          return tx.shipment.create({
            data: {
              date: new Date(),
              recipient: recipient ?? null,
              warehouseId,
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
              : "Failed to draft shipment transaction",
        };
      }
    },
  }),
};
