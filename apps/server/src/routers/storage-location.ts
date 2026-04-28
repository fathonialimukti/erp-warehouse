import { z } from "zod";
import { logActivity } from "../lib/activity-log.js";
import { prisma } from "../lib/prisma.js";
import { hasPermission, protectedProcedure, router, transactional } from "../trpc.js";
import { TRPCError } from "@trpc/server";
import { getMessage } from "../lib/locale.js";
import { baseListInputSchema, buildPaginationMeta, buildPaginationParams, buildTextSearchWhere } from "../lib/list-query.js";

const lokasiStatusValues = ["ACTIVE", "MAINTENANCE", "FULL"] as const;

const importRowSchema = z.object({
    id: z.string().min(1, "ID is required"),
    status: z.enum(lokasiStatusValues).optional(),
});

const getStorageLocationOrThrow = async (id: string, locale: 'en' | 'id') => {
    const lokasi = await prisma.storageLocation.findUnique({
        where: { id },
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
        throw new TRPCError({ code: "NOT_FOUND", message: getMessage(locale, 'storageLocation.notFound') });
    }

    return lokasi;
};

export const storageLocationRouter = router({
    list: protectedProcedure.use(hasPermission('storage_location@read'))
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

            const data = await prisma.storageLocation.findMany({
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
            });
            const total = await prisma.storageLocation.count({ where });

            return {
                data,
                meta: buildPaginationMeta({ page, limit, total }),
            };
        }),

    exportAll: protectedProcedure.use(hasPermission('storage_location@read'))
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

    detail: protectedProcedure.use(hasPermission('storage_location@read'))
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            return getStorageLocationOrThrow(input.id, ctx.locale);
        }),

    create: protectedProcedure.use(hasPermission('storage_location@create')).use(transactional)
        .input(
            z.object({
                warehouseId: z.string().min(1, "Warehouse is required"),
                id: z.string().min(1, "ID is required"),
                status: z.enum(lokasiStatusValues).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const storageLocation = await ctx.db.storageLocation.create({
                data: {
                    id: input.id.trim(),
                    warehouseId: input.warehouseId,
                    status: input.status ?? "ACTIVE",
                },
            });

            await logActivity(ctx.db, {
                action: "CREATE",
                userId: ctx.user!.userId,
                resource: "storage_location",
                resourceId: storageLocation.id,
                message: `Created storage location ${storageLocation.id}`,
                detail: {
                    data: storageLocation,
                },
            });

            return storageLocation;
        }),

    update: protectedProcedure.use(hasPermission('storage_location@update')).use(transactional)
        .input(
            z.object({
                currentId: z.string(),
                id: z.string().min(1, "ID is required"),
                warehouseId: z.string().min(1, "Warehouse is required"),
                status: z.enum(lokasiStatusValues).optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const existingStorageLocation = await getStorageLocationOrThrow(input.currentId, ctx.locale);

            const storageLocation = await ctx.db.storageLocation.update({
                where: { id: input.currentId },
                data: {
                    id: input.id.trim(),
                    warehouseId: input.warehouseId,
                    status: input.status ?? "ACTIVE",
                },
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "storage_location",
                resourceId: storageLocation.id,
                message: `Updated storage location ${storageLocation.id}`,
                detail: {
                    before: existingStorageLocation,
                    after: storageLocation,
                },
            });

            return storageLocation;
        }),

    delete: protectedProcedure.use(hasPermission('storage_location@delete')).use(transactional)
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const existingStorageLocation = await getStorageLocationOrThrow(input.id, ctx.locale);

            await ctx.db.storageLocation.delete({
                where: { id: input.id },
            });

            await logActivity(ctx.db, {
                action: "DELETE",
                userId: ctx.user!.userId,
                resource: "storage_location",
                resourceId: existingStorageLocation.id,
                message: `Deleted storage location ${existingStorageLocation.id}`,
                detail: {
                    latest: existingStorageLocation,
                },
            });

            return { success: true };
        }),


    importBatch: protectedProcedure.use(hasPermission('storage_location@import')).use(transactional)
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

            await logActivity(ctx.db, {
                action: "IMPORT",
                userId: ctx.user!.userId,
                resource: "storage_location",
                resourceId: input.warehouseId,
                message: `Imported storage locations for warehouse ${input.warehouseId}`,
                detail: {
                    warehouseId: input.warehouseId,
                    created: createdCount,
                    updated: updatedCount,
                    deleted: deletedCount,
                    rows: normalizedRows,
                },
            });

            return {
                success: true,
                created: createdCount,
                updated: updatedCount,
                deleted: deletedCount,
            };
        }),
});
