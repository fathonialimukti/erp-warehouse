import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";
import { TRPCError } from "@trpc/server";
import { getMessage } from "../lib/locale.js";
import { baseListInputSchema, buildPaginationMeta, buildPaginationParams, buildTextSearchWhere } from "../lib/list-query.js";

const lokasiStatusValues = ["ACTIVE", "MAINTENANCE", "FULL"] as const;

const importRowSchema = z.object({
    id: z.string().min(1, "ID is required"),
    status: z.enum(lokasiStatusValues).optional(),
});

export const storageLocationRouter = router({
    list: protectedProcedure
        .input(
            baseListInputSchema
                .extend({
                    limit: z.number().min(1).max(500).default(10),
                    warehouseId: z.string().optional(),
                    status: z.enum(lokasiStatusValues).optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search;

            const where = {
                ...(input?.warehouseId ? { warehouseId: input.warehouseId } : {}),
                ...(input?.status ? { status: input.status } : {}),
                ...buildTextSearchWhere(search, ["id"] as const),
            };

            const [data, total] = await Promise.all([
                prisma.storageLocation.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { id: "asc" },
                    include: {
                        warehouse: true,
                        pallet: {
                            include: {
                                palletType: {
                                    include: { sku: true },
                                },
                            },
                        },
                    },
                }),
                prisma.storageLocation.count({ where }),
            ]);

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    exportAll: protectedProcedure
        .input(z.object({ warehouseId: z.string().min(1, "Warehouse is required") }))
        .query(async ({ input }) => {
            return prisma.storageLocation.findMany({
                where: { warehouseId: input.warehouseId },
                orderBy: { id: "asc" },
                include: {
                    pallet: {
                        include: {
                            palletType: {
                                include: { sku: true },
                            },
                        },
                    },
                },
            });
        }),

    detail: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            const lokasi = await prisma.storageLocation.findUnique({
                where: { id: input.id },
                include: {
                    warehouse: true,
                    pallet: {
                        include: {
                            palletType: {
                                include: { sku: true },
                            },
                        },
                    },
                },
            });

            if (!lokasi) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, 'storageLocation.notFound') });
            }

            return lokasi;
        }),

    create: transactionalProtectedProcedure
        .input(
            z.object({
                warehouseId: z.string().min(1, "Warehouse is required"),
                id: z.string().min(1, "ID is required"),
                status: z.enum(lokasiStatusValues).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            return ctx.db.storageLocation.create({
                data: {
                    id: input.id.trim(),
                    warehouseId: input.warehouseId,
                    status: input.status ?? "ACTIVE",
                },
            });
        }),

    update: transactionalProtectedProcedure
        .input(
            z.object({
                currentId: z.string(),
                id: z.string().min(1, "ID is required"),
                warehouseId: z.string().min(1, "Warehouse is required"),
                status: z.enum(lokasiStatusValues).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            return ctx.db.storageLocation.update({
                where: { id: input.currentId },
                data: {
                    id: input.id.trim(),
                    warehouseId: input.warehouseId,
                    status: input.status ?? "ACTIVE",
                },
            });
        }),

    delete: transactionalProtectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            await ctx.db.storageLocation.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),


    importBatch: transactionalProtectedProcedure
        .input(
            z.object({
                warehouseId: z.string().min(1, "Warehouse is required"),
                rows: z.array(importRowSchema),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const normalizedRows = input.rows.map((row) => ({
                ...row,
                id: row.id.trim(),
            }));

            const emptyId = normalizedRows.find((row) => !row.id);
            if (emptyId) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, 'storageLocation.importRowMissingId') });
            }

            const duplicateIds = normalizedRows
                .map((row) => row.id)
                .filter((id, index, arr) => arr.indexOf(id) !== index);
            if (duplicateIds.length > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, 'storageLocation.importDuplicateIds', {
                        ids: Array.from(new Set(duplicateIds)).join(', '),
                    }),
                });
            }

            const existingRows = await ctx.db.storageLocation.findMany({
                where: { warehouseId: input.warehouseId },
                include: {
                    pallet: true,
                },
            });

            const importedIdSet = new Set(normalizedRows.map((row) => row.id));
            const toDelete = existingRows.filter((row) => !importedIdSet.has(row.id));
            const blockedDelete = toDelete.filter((row) => row.pallet !== null);

            if (blockedDelete.length > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, 'storageLocation.importCannotDeleteFilled', {
                        ids: blockedDelete.map((row) => row.id).join(', '),
                    }),
                });
            }

            const existingIdSet = new Set(existingRows.map((row) => row.id));
            const deletedCount = toDelete.length;
            const createdCount = normalizedRows.filter((row) => !existingIdSet.has(row.id)).length;
            const updatedCount = normalizedRows.filter((row) => existingIdSet.has(row.id)).length;

            if (toDelete.length > 0) {
                await ctx.db.storageLocation.deleteMany({
                    where: {
                        id: {
                            in: toDelete.map((row) => row.id),
                        },
                    },
                });
            }

            for (const row of normalizedRows) {
                await ctx.db.storageLocation.upsert({
                    where: { id: row.id },
                    create: {
                        id: row.id,
                        warehouseId: input.warehouseId,
                        status: row.status ?? "ACTIVE",
                    },
                    update: {
                        id: row.id,
                        warehouseId: input.warehouseId,
                        status: row.status ?? "ACTIVE",
                    },
                });
            }

            return {
                success: true,
                created: createdCount,
                updated: updatedCount,
                deleted: deletedCount,
            };
        }),
});
