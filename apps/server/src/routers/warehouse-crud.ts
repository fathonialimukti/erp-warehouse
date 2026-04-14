import { z } from "zod";
import { deleteManagedUpload, persistUploadedImage } from "../lib/upload-file.js";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";

export const warehouseRouter = router({
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
                        { id: { contains: search, mode: "insensitive" as const } },
                        { name: { contains: search, mode: "insensitive" as const } },
                        { address: { contains: search, mode: "insensitive" as const } },
                    ],
                }
                : {};

            const [data, total] = await Promise.all([
                prisma.warehouse.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                }),
                prisma.warehouse.count({ where }),
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
            const warehouse = await prisma.warehouse.findUnique({
                where: { id: input.id },
            });

            if (!warehouse) {
                throw new Error("Warehouse not found");
            }

            return warehouse;
        }),

    create: protectedProcedure
        .input(
            z.object({
                id: z.string().min(1, "ID is required"),
                name: z.string().min(1, "Name is required"),
                address: z.string().min(1, "Address is required"),
                totalCapacity: z.number().int().optional(),
                photo: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const photo = input.photo
                ? await persistUploadedImage({ image: input.photo, folder: 'warehouses', req: ctx.req })
                : null;

            return prisma.warehouse.create({
                data: {
                    id: input.id.trim(),
                    name: input.name,
                    address: input.address,
                    totalCapacity: input.totalCapacity ?? null,
                    photo,
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                currentId: z.string(),
                id: z.string().min(1, "ID is required"),
                name: z.string().min(1, "Name is required"),
                address: z.string().min(1, "Address is required"),
                totalCapacity: z.number().int().optional(),
                photo: z.string().optional(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const existingWarehouse = await prisma.warehouse.findUnique({
                where: { id: input.currentId },
                select: { photo: true },
            });
            const photo = input.photo
                ? await persistUploadedImage({ image: input.photo, folder: 'warehouses', req: ctx.req })
                : null;

            if (existingWarehouse?.photo && existingWarehouse.photo !== photo) {
                await deleteManagedUpload(existingWarehouse.photo);
            }

            return prisma.warehouse.update({
                where: { id: input.currentId },
                data: {
                    id: input.id.trim(),
                    name: input.name,
                    address: input.address,
                    totalCapacity: input.totalCapacity ?? null,
                    photo,
                },
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            const existingWarehouse = await prisma.warehouse.findUnique({
                where: { id: input.id },
                select: { photo: true },
            });

            await prisma.warehouse.delete({
                where: { id: input.id },
            });

            await deleteManagedUpload(existingWarehouse?.photo ?? null);

            return { success: true };
        }),
});
