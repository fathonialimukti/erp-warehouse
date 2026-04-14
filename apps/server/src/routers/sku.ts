import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { deleteManagedUpload, persistUploadedImage } from "../lib/upload-file.js";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";

export const skuRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                    search: z.string().optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const search = input?.search;
            const skip = (page - 1) * limit;

            const where = search
                ? {
                    OR: [
                        { name: { contains: search, mode: "insensitive" as const } },
                        { id: { contains: search, mode: "insensitive" as const } },
                        { description: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {};

            const [data, total] = await Promise.all([
                prisma.sku.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.sku.count({ where }),
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
            const sku = await prisma.sku.findUnique({
                where: { id: input.id },
            });

            if (!sku) {
                throw new TRPCError({ code: "NOT_FOUND", message: "SKU tidak ditemukan" });
            }

            return sku;
        }),

    create: protectedProcedure
        .input(
            z.object({
                id: z.string().min(1, "ID is required"),
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                photo: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const photo = input.photo
                ? await persistUploadedImage({ image: input.photo, folder: 'skus', req: ctx.req })
                : null;

            return prisma.sku.create({
                data: {
                    id: input.id,
                    name: input.name,
                    description: input.description ?? null,
                    photo,
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                newId: z.string().min(1, "New ID is required"),
                name: z.string().min(1, "Name is required"),
                description: z.string().optional(),
                photo: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const existingSku = await prisma.sku.findUnique({
                where: { id: input.id },
                select: { photo: true },
            });
            const photo = input.photo
                ? await persistUploadedImage({ image: input.photo, folder: 'skus', req: ctx.req })
                : null;

            if (existingSku?.photo && existingSku.photo !== photo) {
                await deleteManagedUpload(existingSku.photo);
            }

            return prisma.sku.update({
                where: { id: input.id },
                data: {
                    id: input.newId,
                    name: input.name,
                    description: input.description ?? null,
                    photo,
                },
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            const existingSku = await prisma.sku.findUnique({
                where: { id: input.id },
                select: { photo: true },
            });

            await prisma.sku.delete({
                where: { id: input.id },
            });

            await deleteManagedUpload(existingSku?.photo ?? null);

            return { success: true };
        }),
});
