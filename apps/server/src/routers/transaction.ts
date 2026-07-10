import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getMessage } from "../lib/locale.js";
import { hasPermission, protectedProcedure, router, transactional } from "../trpc.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";
import { logActivity } from "../lib/activity-log.js";
import {
    writeStockMovementsFromDocument,
    computePutawayStatus,
    DIRECTION_BY_TYPE,
    PUTAWAY_TYPES,
    DISPATCH_TYPES,
    resolveTransactionDocument,
    type ResolvedTransactionDocument,
} from "../lib/transaction.js";
import type { DbClient } from "../lib/prisma.js";
import type { WarehouseTransactionType } from "../prisma/generated/client.js";

const isPutawayType = (v: string): v is WarehouseTransactionType =>
    (PUTAWAY_TYPES as readonly string[]).includes(v);
const isDispatchType = (v: string): v is WarehouseTransactionType =>
    (DISPATCH_TYPES as readonly string[]).includes(v);

/** Sync parent document putawayStatus after completing putaway lines. */
async function syncPutawayStatus(
    db: DbClient,
    transactionType: WarehouseTransactionType,
    documentId: string,
    postedById: string,
): Promise<void> {
    const newStatus = await computePutawayStatus(db, transactionType, documentId);
    switch (transactionType) {
        case "RECEIVING":
            await db.receivingTransaction.update({ where: { id: documentId }, data: { putawayStatus: newStatus } });
            break;
        case "WIP_COMPLETION":
            await db.wipCompletion.update({ where: { id: documentId }, data: { putawayStatus: newStatus } });
            break;
        case "RMA_RECEIPT":
            await db.rmaReceipt.update({ where: { id: documentId }, data: { putawayStatus: newStatus } });
            break;
        case "FOUND":
            await db.foundTransaction.update({ where: { id: documentId }, data: { putawayStatus: newStatus } });
            break;
        default:
            break;
    }
    if (newStatus === "COMPLETED") {
        await writeStockMovementsFromDocument(db, transactionType, documentId, "IN", postedById);
    }
}

/** Sync parent document dispatchStatus after completing pick lines. */
async function syncDispatchStatus(
    db: DbClient,
    transactionType: WarehouseTransactionType,
    documentId: string,
    postedById: string,
): Promise<void> {
    const total = await db.pickLine.count({ where: { documentId, transactionType } });
    const completed = await db.pickLine.count({ where: { documentId, transactionType, status: "COMPLETED" } });
    const newStatus = completed === 0 ? "PENDING" : completed === total ? "COMPLETED" : "PARTIAL";

    switch (transactionType) {
        case "WIP_ISSUE":
            await db.wipIssue.update({ where: { id: documentId }, data: { dispatchStatus: newStatus } });
            break;
        case "SHIPMENT":
            await db.shipment.update({ where: { id: documentId }, data: { dispatchStatus: newStatus } });
            break;
        case "RETURN_TO_SUPPLIER":
            await db.returnToSupplier.update({ where: { id: documentId }, data: { dispatchStatus: newStatus } });
            break;
        case "DISPOSAL":
            await db.disposal.update({ where: { id: documentId }, data: { dispatchStatus: newStatus } });
            break;
        default:
            break;
    }
    if (newStatus === "COMPLETED") {
        await writeStockMovementsFromDocument(db, transactionType, documentId, "OUT", postedById);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUTAWAY (IN direction) — place pallets into storage locations
// ─────────────────────────────────────────────────────────────────────────────

const putawayRouter = router({
    /**
     * Unified list of IN-direction transactions that still need putaway.
     * Unions all PUTAWAY_TYPES filtered to APPROVED + putawayStatus != COMPLETED.
     */
    list: protectedProcedure
        .use(hasPermission("transaction@putaway"))
        .input(
            z.object({
                page: z.number().int().positive().optional(),
                limit: z.number().int().positive().max(200).optional(),
                search: z.string().optional(),
                approvalStatus: z.string().optional(),
                putawayStatus: z.enum(["PENDING", "PARTIAL", "COMPLETED"]).optional(),
                warehouseId: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search?.trim();

            const whereBase: Record<string, unknown> = {
                approvalStatus: input?.approvalStatus ?? "APPROVED",
                ...(input?.putawayStatus ? { putawayStatus: input.putawayStatus } : { NOT: { putawayStatus: "COMPLETED" } }),
                ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
                ...(search
                    ? {
                          OR: [
                              { reference: { contains: search, mode: "insensitive" as const } },
                              { documentNumber: { contains: search, mode: "insensitive" as const } },
                          ],
                      }
                    : {}),
            };

            const modelByType: Record<string, any> = {
                RECEIVING: ctx.db.receivingTransaction,
                WIP_COMPLETION: ctx.db.wipCompletion,
                RMA_RECEIPT: ctx.db.rmaReceipt,
                FOUND: ctx.db.foundTransaction,
            };

            const queries = PUTAWAY_TYPES.map((type) => {
                const model = modelByType[type];
                return model
                    .findMany({
                        where: whereBase,
                        select: { id: true, reference: true, documentNumber: true, putawayStatus: true },
                        orderBy: { createdAt: "desc" },
                    })
                    .then((rows: any[]) =>
                        rows.map((r: any) => ({
                            id: r.id,
                            reference: r.reference ?? r.documentNumber ?? null,
                            putawayStatus: r.putawayStatus,
                            transactionType: type,
                        })),
                    );
            });

            const nested = await Promise.all(queries);
            const all = nested.flat();
            const total = all.length;
            const start = skip ?? 0;
            const paged = all.slice(start, start + (limit ?? 50));

            return { data: paged, meta: buildPaginationMeta({ page, limit, total }) };
        }),

    /**
     * Get putaway assignment data for a single approved IN-direction transaction.
     * Returns the parent putaway status + every pallet (with its current storage
     * location, SKU name, and pallet-type object id) so the 3D layout page can
     * render unassigned pallets and highlight empty locations.
     */
    getAssignmentData: protectedProcedure
        .use(hasPermission("transaction@putaway"))
        .input(z.object({ transactionType: z.enum(PUTAWAY_TYPES as [string, ...string[]]), inboundTransactionId: z.string() }))
        .query(async ({ ctx, input }) => {
            if (!isPutawayType(input.transactionType)) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "transaction.notPutawayType") });
            }
            const doc = await resolveTransactionDocument(ctx.db, input.transactionType, input.inboundTransactionId);
            if (!doc) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "transaction.notFound") });
            }

            const lines = await ctx.db.putawayLine.findMany({
                where: { documentId: input.inboundTransactionId, transactionType: input.transactionType },
                select: {
                    palletId: true,
                    storageLocationId: true,
                    status: true,
                    pallet: {
                        select: {
                            id: true,
                            palletNumber: true,
                            sku: { select: { id: true, name: true, objectId: true } },
                        },
                    },
                },
                orderBy: { createdAt: "asc" },
            });

            const allPallets = lines.map((line) => ({
                palletId: line.palletId,
                palletNumber: line.pallet.palletNumber,
                storageLocationId: line.storageLocationId,
                palletTypeObjectId: line.pallet.sku?.objectId ?? null,
                skuName: line.pallet.sku?.name ?? null,
                palletTypeName: line.pallet.sku?.name ?? null,
            }));

            return {
                putawayStatus: doc.putawayStatus ?? "PENDING",
                allPallets,
            };
        }),

    /**
     * Replace ALL pallet→storage-location assignments for an IN-direction transaction.
     * Idempotent: re-submitting an already-COMPLETED line is a no-op. When all lines
     * are COMPLETED, stock movements are written (goods physically in the warehouse).
     */
    submitAssignment: protectedProcedure
        .use(hasPermission("transaction@putaway"))
        .use(transactional)
        .input(
            z.object({
                transactionType: z.enum(PUTAWAY_TYPES as [string, ...string[]]),
                inboundTransactionId: z.string(),
                assignments: z
                    .array(z.object({ palletId: z.string(), storageLocationId: z.string().min(1) }))
                    .min(1),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (!isPutawayType(input.transactionType)) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "transaction.notPutawayType") });
            }
            const doc = await resolveTransactionDocument(ctx.db, input.transactionType, input.inboundTransactionId);
            if (!doc) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "transaction.notFound") });
            }
            if (doc.approvalStatus !== "APPROVED") {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "transaction.notApproved") });
            }

            const lines = await ctx.db.putawayLine.findMany({
                where: { documentId: input.inboundTransactionId, transactionType: input.transactionType },
                select: { id: true, palletId: true, storageLocationId: true, status: true },
            });
            const lineByPallet = new Map(lines.map((l) => [l.palletId, l]));

            const results: Array<{ palletId: string; storageLocationId: string; status: string }> = [];

            for (const assignment of input.assignments) {
                const line = lineByPallet.get(assignment.palletId);
                if (!line) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: getMessage(ctx.locale, "transaction.palletNotInTransaction", { palletId: assignment.palletId }),
                    });
                }

                const location = await ctx.db.storageLocation.findUnique({
                    where: { id: assignment.storageLocationId },
                    select: { id: true, warehouseId: true, status: true },
                });
                if (!location) {
                    throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "putaway.locationNotFound") });
                }
                if (location.warehouseId !== doc.warehouseId) {
                    throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "transaction.locationWrongWarehouse") });
                }

                if (line.status === "COMPLETED" && line.storageLocationId === assignment.storageLocationId) {
                    results.push({ palletId: assignment.palletId, storageLocationId: assignment.storageLocationId, status: "COMPLETED" });
                    continue;
                }

                const occupant = await ctx.db.pallet.findFirst({
                    where: { storageLocationId: assignment.storageLocationId, id: { not: assignment.palletId } },
                    select: { id: true },
                });
                if (occupant) {
                    throw new TRPCError({ code: "CONFLICT", message: getMessage(ctx.locale, "transaction.locationOccupied", { locationId: assignment.storageLocationId }) });
                }

                await ctx.db.pallet.update({
                    where: { id: assignment.palletId },
                    data: { storageLocationId: assignment.storageLocationId },
                });

                await ctx.db.putawayLine.update({
                    where: { id: line.id },
                    data: {
                        status: "COMPLETED",
                        storageLocationId: assignment.storageLocationId,
                        completedAt: new Date(),
                        completedById: ctx.user!.userId,
                    },
                });

                results.push({ palletId: assignment.palletId, storageLocationId: assignment.storageLocationId, status: "COMPLETED" });

                await logActivity(ctx.db, {
                    action: "UPDATE",
                    userId: ctx.user!.userId,
                    resource: "putaway_line",
                    resourceId: line.id,
                    message: `Menyelesaikan putaway ${line.id} ke lokasi ${assignment.storageLocationId}`,
                    detail: {
                        before: { status: line.status, storageLocationId: line.storageLocationId ?? null },
                        after: { status: "COMPLETED", storageLocationId: assignment.storageLocationId },
                    },
                });
            }

            await syncPutawayStatus(ctx.db, input.transactionType, input.inboundTransactionId, ctx.user!.userId);

            return { success: true, assignments: results };
        }),

    /** Get a single PutawayLine by id (IN-direction line completion view). */
    detail: protectedProcedure
        .use(hasPermission("transaction@putaway"))
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const row = await ctx.db.putawayLine.findUnique({
                where: { id: input.id },
                include: {
                    pallet: { include: { storageLocation: { select: { id: true, warehouseId: true } } } },
                    storageLocation: { select: { id: true, warehouseId: true } },
                    completedBy: { select: { id: true, name: true } },
                },
            });
            if (!row) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "putaway.notFound") });
            }
            return row;
        }),

    /** List PutawayLines (IN-direction) filtered by document/type/status. */
    lines: protectedProcedure
        .use(hasPermission("transaction@putaway"))
        .input(
            z.object({
                page: z.number().int().positive().optional(),
                limit: z.number().int().positive().max(200).optional(),
                search: z.string().optional(),
                documentId: z.string().optional(),
                transactionType: z.string().optional(),
                status: z.enum(["PENDING", "COMPLETED"]).optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search?.trim();
            const where: Record<string, unknown> = {
                ...(input?.documentId ? { documentId: input.documentId } : {}),
                ...(input?.transactionType ? { transactionType: input.transactionType } : {}),
                ...(input?.status ? { status: input.status } : {}),
                ...(search
                    ? {
                          OR: [
                              { documentId: { contains: search, mode: "insensitive" as const } },
                              { id: { contains: search, mode: "insensitive" as const } },
                              { pallet: { palletNumber: { contains: search, mode: "insensitive" as const } } },
                          ],
                      }
                    : {}),
            };
            const rows = await ctx.db.putawayLine.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    pallet: { include: { storageLocation: { select: { id: true, warehouseId: true } } } },
                    storageLocation: { select: { id: true, warehouseId: true } },
                    completedBy: { select: { id: true, name: true } },
                },
            });
            const total = await ctx.db.putawayLine.count({ where });
            return { data: rows, meta: buildPaginationMeta({ page, limit, total }) };
        }),

    /**
     * Complete a single PutawayLine (IN-direction line execution).
     * Sets the pallet's storageLocationId to the line's target, marks the line
     * COMPLETED, syncs the parent document putawayStatus, and writes stock
     * movements when all lines are done.
     */
    complete: protectedProcedure
        .use(hasPermission("transaction@putaway"))
        .use(transactional)
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const line = await ctx.db.putawayLine.findUnique({
                where: { id: input.id },
                include: { pallet: { select: { id: true, storageLocationId: true } } },
            });
            if (!line) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "putaway.notFound") });
            }
            if (line.status === "COMPLETED") {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "putaway.alreadyCompleted") });
            }
            if (!line.storageLocationId) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "putaway.locationNotFound") });
            }

            await ctx.db.pallet.update({
                where: { id: line.palletId },
                data: { storageLocationId: line.storageLocationId },
            });

            const completed = await ctx.db.putawayLine.update({
                where: { id: input.id },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    completedById: ctx.user!.userId,
                },
                include: {
                    pallet: { include: { storageLocation: { select: { id: true, warehouseId: true } } } },
                    storageLocation: { select: { id: true, warehouseId: true } },
                    completedBy: { select: { id: true, name: true } },
                },
            });

            await syncPutawayStatus(ctx.db, line.transactionType, line.documentId, ctx.user!.userId);

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "putaway_line",
                resourceId: completed.id,
                message: `Menyelesaikan putaway ${completed.id}`,
                detail: {
                    before: { status: line.status, storageLocationId: line.pallet.storageLocationId ?? null },
                    after: { status: "COMPLETED", storageLocationId: line.storageLocationId },
                },
            });

            return completed;
        }),
});

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCH (OUT direction) — take pallets out of storage locations
// ─────────────────────────────────────────────────────────────────────────────

const dispatchRouter = router({
    /**
     * Unified list of OUT-direction transactions that still need picking.
     * Unions all DISPATCH_TYPES filtered to APPROVED + dispatchStatus != COMPLETED
     * (+ dispatchOpenStatus OPEN for SHIPMENT, the only type with that field).
     */
    list: protectedProcedure
        .use(hasPermission("transaction@dispatch"))
        .input(
            z.object({
                page: z.number().int().positive().optional(),
                limit: z.number().int().positive().max(200).optional(),
                search: z.string().optional(),
                approvalStatus: z.string().optional(),
                dispatchStatus: z.enum(["PENDING", "PARTIAL", "COMPLETED"]).optional(),
                dispatchOpenStatus: z.enum(["OPEN", "CLOSED"]).optional(),
                warehouseId: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search?.trim();

            const whereBase: Record<string, unknown> = {
                approvalStatus: input?.approvalStatus ?? "APPROVED",
                ...(input?.dispatchStatus ? { dispatchStatus: input.dispatchStatus } : { NOT: { dispatchStatus: "COMPLETED" } }),
                ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
                ...(search
                    ? {
                          OR: [
                              { reference: { contains: search, mode: "insensitive" as const } },
                              { documentNumber: { contains: search, mode: "insensitive" as const } },
                          ],
                      }
                    : {}),
            };

            const modelByType: Record<string, any> = {
                WIP_ISSUE: ctx.db.wipIssue,
                SHIPMENT: ctx.db.shipment,
                RETURN_TO_SUPPLIER: ctx.db.returnToSupplier,
                DISPOSAL: ctx.db.disposal,
            };

            const queries = DISPATCH_TYPES.map((type) => {
                const where =
                    type === "SHIPMENT" && input?.dispatchOpenStatus
                        ? { ...whereBase, dispatchOpenStatus: input.dispatchOpenStatus }
                        : whereBase;
                const model = modelByType[type];
                return model
                    .findMany({
                        where,
                        select: { id: true, reference: true, documentNumber: true, dispatchStatus: true },
                        orderBy: { createdAt: "desc" },
                    })
                    .then((rows: any[]) =>
                        rows.map((r: any) => ({
                            id: r.id,
                            reference: r.reference ?? r.documentNumber ?? null,
                            dispatchStatus: r.dispatchStatus,
                            transactionType: type,
                        })),
                    );
            });

            const nested = await Promise.all(queries);
            const all = nested.flat();
            const total = all.length;
            const start = skip ?? 0;
            const paged = all.slice(start, start + (limit ?? 50));

            return { data: paged, meta: buildPaginationMeta({ page, limit, total }) };
        }),

    /**
     * Get dispatch assignment data for a single approved OUT-direction transaction.
     * Returns items (SKU, pallet type, quantity) + available/assigned pallets
     * tagged with their item id so the 3D scene can render pickable pallets.
     */
    getAssignmentData: protectedProcedure
        .use(hasPermission("transaction@dispatch"))
        .input(z.object({ transactionType: z.enum(DISPATCH_TYPES as [string, ...string[]]), outboundTransactionId: z.string() }))
        .query(async ({ ctx, input }) => {
            if (!isDispatchType(input.transactionType)) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "transaction.notDispatchType") });
            }
            const doc = await resolveTransactionDocument(ctx.db, input.transactionType, input.outboundTransactionId);
            if (!doc) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "transaction.notFound") });
            }

            const pickLines = await ctx.db.pickLine.findMany({
                where: { documentId: input.outboundTransactionId, transactionType: input.transactionType },
                select: {
                    id: true,
                    status: true,
                    palletId: true,
                    pallet: {
                        select: {
                            id: true,
                            palletNumber: true,
                            storageLocationId: true,
                            sourceItemId: true,
                            sku: { select: { id: true, name: true, objectId: true, packageName: true } },
                        },
                    },
                },
                orderBy: { createdAt: "asc" },
            });

            const itemBySku = new Map(doc.items.map((it) => [it.skuId, it.id]));
            const pallets = pickLines.map((pl) => {
                const skuId = pl.pallet.sku?.id ?? null;
                const outboundTransactionItemId =
                    (pl.pallet as any).sourceItemId ?? (skuId ? itemBySku.get(skuId) ?? null : null);
                return {
                    palletId: pl.palletId,
                    palletNumber: pl.pallet.palletNumber,
                    storageLocationId: pl.pallet.storageLocationId,
                    outboundTransactionItemId,
                    skuId,
                    skuName: pl.pallet.sku?.name ?? null,
                    palletTypeObjectId: pl.pallet.sku?.objectId ?? null,
                    palletTypeName: pl.pallet.sku?.packageName ?? null,
                    status: pl.status,
                };
            });

            const items: Array<{
                outboundTransactionItemId: string;
                skuId: string;
                skuName: string | null;
                palletTypeName: string | null;
                palletTypeObjectId: string | null;
                quantity: number;
            }> = doc.items.map((it) => ({
                outboundTransactionItemId: it.id,
                skuId: it.skuId,
                skuName: null,
                palletTypeName: null,
                palletTypeObjectId: null,
                quantity: Number(it.quantity),
            }));

            const skuInfoById = new Map<string, { name: string | null; objectId: string | null; packageName: string | null }>();
            for (const p of pallets) {
                if (p.skuId && !skuInfoById.has(p.skuId)) {
                    skuInfoById.set(p.skuId, { name: p.skuName, objectId: p.palletTypeObjectId, packageName: p.palletTypeName });
                }
            }
            for (const item of items) {
                const info = skuInfoById.get(item.skuId);
                if (info) {
                    item.skuName = info.name;
                    item.palletTypeObjectId = info.objectId;
                    item.palletTypeName = info.packageName;
                }
            }

            const availablePallets = pallets
                .filter((p) => p.status === "PENDING")
                .map((p) => ({ palletId: p.palletId, palletNumber: p.palletNumber, outboundTransactionItemId: p.outboundTransactionItemId }));
            const assignedPallets = pallets
                .filter((p) => p.status === "COMPLETED")
                .map((p) => ({ palletId: p.palletId, palletNumber: p.palletNumber, outboundTransactionItemId: p.outboundTransactionItemId }));

            return {
                transactionType: input.transactionType,
                dispatchStatus: doc.dispatchStatus ?? "PENDING",
                items,
                availablePallets,
                assignedPallets,
            };
        }),

    /**
     * Submit dispatch assignments for an OUT-direction transaction.
     * For each { outboundTransactionItemId, palletId }: clears the pallet's
     * storageLocationId (pallet leaves warehouse), marks the PickLine COMPLETED.
     * When all PickLines are COMPLETED, stock movements are written.
     * Idempotent on already-completed picks.
     */
    submitAssignment: protectedProcedure
        .use(hasPermission("transaction@dispatch"))
        .use(transactional)
        .input(
            z.object({
                transactionType: z.enum(DISPATCH_TYPES as [string, ...string[]]),
                outboundTransactionId: z.string(),
                assignments: z
                    .array(z.object({ outboundTransactionItemId: z.string().min(1), palletId: z.string().min(1) }))
                    .min(1),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            if (!isDispatchType(input.transactionType)) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "transaction.notDispatchType") });
            }
            const doc = await resolveTransactionDocument(ctx.db, input.transactionType, input.outboundTransactionId);
            if (!doc) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "transaction.notFound") });
            }
            if (doc.approvalStatus !== "APPROVED") {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "transaction.notApproved") });
            }

            const pickLines = await ctx.db.pickLine.findMany({
                where: { documentId: input.outboundTransactionId, transactionType: input.transactionType },
                select: { id: true, palletId: true, status: true, fromLocationId: true },
            });
            const lineByPallet = new Map(pickLines.map((l) => [l.palletId, l]));
            const validPalletIds = new Set(pickLines.map((l) => l.palletId));

            const results: Array<{ palletId: string; status: string }> = [];

            for (const assignment of input.assignments) {
                if (!validPalletIds.has(assignment.palletId)) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: getMessage(ctx.locale, "transaction.palletNotInTransaction", { palletId: assignment.palletId }),
                    });
                }

                const line = lineByPallet.get(assignment.palletId)!;

                if (line.status === "COMPLETED") {
                    results.push({ palletId: assignment.palletId, status: "COMPLETED" });
                    continue;
                }

                await ctx.db.pallet.update({
                    where: { id: assignment.palletId },
                    data: { storageLocationId: null },
                });

                await ctx.db.pickLine.update({
                    where: { id: line.id },
                    data: { status: "COMPLETED", completedAt: new Date(), completedById: ctx.user!.userId },
                });

                results.push({ palletId: assignment.palletId, status: "COMPLETED" });

                await logActivity(ctx.db, {
                    action: "UPDATE",
                    userId: ctx.user!.userId,
                    resource: "pick_line",
                    resourceId: line.id,
                    message: `Menyelesaikan outbound pick ${line.id} untuk ${input.outboundTransactionId}`,
                    detail: {
                        before: { status: line.status, storageLocationId: line.fromLocationId ?? null },
                        after: { status: "COMPLETED", storageLocationId: null },
                    },
                });
            }

            await syncDispatchStatus(ctx.db, input.transactionType, input.outboundTransactionId, ctx.user!.userId);

            return { success: true, assignments: results };
        }),

    /** Get a single PickLine by id (OUT-direction line completion view). */
    detail: protectedProcedure
        .use(hasPermission("transaction@dispatch"))
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const row = await ctx.db.pickLine.findUnique({
                where: { id: input.id },
                include: {
                    pallet: { include: { storageLocation: { select: { id: true, warehouseId: true } } } },
                    fromLocation: { select: { id: true, warehouseId: true } },
                    assignedBy: { select: { id: true, name: true } },
                    completedBy: { select: { id: true, name: true } },
                },
            });
            if (!row) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "pick.notFound") });
            }
            return row;
        }),

    /** List PickLines (OUT-direction) filtered by document/type/status. */
    lines: protectedProcedure
        .use(hasPermission("transaction@dispatch"))
        .input(
            z.object({
                page: z.number().int().positive().optional(),
                limit: z.number().int().positive().max(200).optional(),
                search: z.string().optional(),
                documentId: z.string().optional(),
                transactionType: z.string().optional(),
                status: z.enum(["PENDING", "COMPLETED"]).optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search?.trim();
            const where: Record<string, unknown> = {
                ...(input?.documentId ? { documentId: input.documentId } : {}),
                ...(input?.transactionType ? { transactionType: input.transactionType } : {}),
                ...(input?.status ? { status: input.status } : {}),
                ...(search
                    ? {
                          OR: [
                              { documentId: { contains: search, mode: "insensitive" as const } },
                              { id: { contains: search, mode: "insensitive" as const } },
                          ],
                      }
                    : {}),
            };
            const rows = await ctx.db.pickLine.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    pallet: { include: { storageLocation: { select: { id: true, warehouseId: true } } } },
                    fromLocation: { select: { id: true, warehouseId: true } },
                    assignedBy: { select: { id: true, name: true } },
                    completedBy: { select: { id: true, name: true } },
                },
            });
            const total = await ctx.db.pickLine.count({ where });
            return { data: rows, meta: buildPaginationMeta({ page, limit, total }) };
        }),

    /**
     * Complete a single PickLine (OUT-direction line execution).
     * Clears the pallet's storageLocationId (pallet leaves warehouse), marks the
     * line COMPLETED, syncs the parent document dispatchStatus, and writes stock
     * movements when all lines are done.
     */
    complete: protectedProcedure
        .use(hasPermission("transaction@dispatch"))
        .use(transactional)
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const line = await ctx.db.pickLine.findUnique({
                where: { id: input.id },
                include: { pallet: { select: { id: true, storageLocationId: true } } },
            });
            if (!line) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "pick.notFound") });
            }
            if (line.status === "COMPLETED") {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "pick.alreadyCompleted") });
            }

            await ctx.db.pallet.update({
                where: { id: line.palletId },
                data: { storageLocationId: null },
            });

            const completed = await ctx.db.pickLine.update({
                where: { id: input.id },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    completedById: ctx.user!.userId,
                },
                include: {
                    pallet: { include: { storageLocation: { select: { id: true, warehouseId: true } } } },
                    fromLocation: { select: { id: true, warehouseId: true } },
                    assignedBy: { select: { id: true, name: true } },
                    completedBy: { select: { id: true, name: true } },
                },
            });

            await syncDispatchStatus(ctx.db, line.transactionType, line.documentId, ctx.user!.userId);

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "pick_line",
                resourceId: completed.id,
                message: `Menyelesaikan outbound pick ${completed.id}`,
                detail: {
                    before: { status: line.status, storageLocationId: line.pallet.storageLocationId ?? null },
                    after: { status: "COMPLETED", storageLocationId: null },
                },
            });

            return completed;
        }),
});

export const transactionRouter = router({
    putaway: putawayRouter,
    dispatch: dispatchRouter,
});

export type { ResolvedTransactionDocument };
