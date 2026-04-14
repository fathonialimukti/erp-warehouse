import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";

const palletStatusValues = [
    "RECEIVED",
    "PLACED",
    "DISPATCHED",
    "LOST",
    "FOUND",
    "DAMAGED",
] as const;

export const palletRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                    search: z.string().optional(),
                    status: z.enum(palletStatusValues).optional(),
                    palletTypeId: z.string().optional(),
                    storageLocationId: z.string().optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const search = input?.search;
            const skip = (page - 1) * limit;

            const where = {
                ...(input?.status ? { status: input.status } : {}),
                ...(input?.palletTypeId ? { palletTypeId: input.palletTypeId } : {}),
                ...(input?.storageLocationId
                    ? { storageLocationId: input.storageLocationId }
                    : {}),
                ...(search
                    ? {
                        OR: [
                            { id: { contains: search, mode: "insensitive" as const } },
                            { palletType: { id: { contains: search, mode: "insensitive" as const } } },
                            { palletType: { name: { contains: search, mode: "insensitive" as const } } },
                        ],
                    }
                    : {}),
            };

            const [data, total] = await Promise.all([
                prisma.pallet.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                    include: {
                        palletType: { include: { sku: true } },
                        storageLocation: { include: { warehouse: true } },
                    },
                }),
                prisma.pallet.count({ where }),
            ]);

            return {
                data,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }),

    detail: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            const pallet = await prisma.pallet.findUnique({
                where: { id: input.id },
                include: {
                    palletType: { include: { sku: true } },
                    storageLocation: { include: { warehouse: true } },
                },
            });

            if (!pallet) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Pallet not found" });
            }

            return pallet;
        }),

    create: transactionalProtectedProcedure
        .input(
            z.object({
                palletTypeId: z.string().min(1, "Pallet type is required"),
                storageLocationId: z.string().optional(),
                status: z.enum(palletStatusValues).default("RECEIVED"),
                receivedAt: z.coerce.date().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            return ctx.db.pallet.create({
                data: {
                    palletTypeId: input.palletTypeId,
                    storageLocationId: input.storageLocationId ?? null,
                    status: input.status,
                    receivedAt: input.receivedAt ?? null,
                },
                include: {
                    palletType: { include: { sku: true } },
                },
            });
        }),

    update: transactionalProtectedProcedure
        .input(
            z.object({
                id: z.string(),
                palletTypeId: z.string().min(1, "Pallet type is required"),
                storageLocationId: z.string().optional(),
                status: z.enum(palletStatusValues),
                receivedAt: z.coerce.date().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            return ctx.db.pallet.update({
                where: { id: input.id },
                data: {
                    palletTypeId: input.palletTypeId,
                    storageLocationId: input.storageLocationId ?? null,
                    status: input.status,
                    receivedAt: input.receivedAt ?? null,
                },
                include: {
                    palletType: { include: { sku: true } },
                },
            });
        }),

    delete: transactionalProtectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            await ctx.db.pallet.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});

