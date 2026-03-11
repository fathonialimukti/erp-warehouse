import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";
import { approvalRequestStatusValues, mapRequestStatusToApproval } from "./approval-utils.js";

export const approvalRequestRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                    status: z.enum(approvalRequestStatusValues).optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const skip = (page - 1) * limit;

            const where = {
                ...(input?.status ? { status: input.status } : {}),
            };

            const [data, total] = await Promise.all([
                prisma.approvalRequest.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: "desc" },
                    include: { transaksiGudang: true, requester: true },
                }),
                prisma.approvalRequest.count({ where }),
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
            const request = await prisma.approvalRequest.findUnique({
                where: { id: input.id },
                include: {
                    transaksiGudang: true,
                    requester: true,
                    steps: { include: { approver: true } },
                },
            });

            if (!request) {
                throw new Error("ApprovalRequest not found");
            }

            return request;
        }),

    create: protectedProcedure
        .input(
            z.object({
                transaksiGudangId: z.string().min(1, "TransaksiGudang is required"),
            })
        )
        .mutation(async ({ ctx, input }) => {
            return prisma.$transaction(async (tx) => {
                const existing = await tx.approvalRequest.findUnique({
                    where: { transaksiGudangId: input.transaksiGudangId },
                });

                if (existing) {
                    throw new Error("ApprovalRequest already exists");
                }

                const request = await tx.approvalRequest.create({
                    data: {
                        transaksiGudangId: input.transaksiGudangId,
                        requesterId: ctx.user.userId,
                        status: "PENDING",
                        currentLevel: 1,
                    },
                });

                await tx.transaksiGudang.update({
                    where: { id: input.transaksiGudangId },
                    data: { statusApproval: "MENUNGGU" },
                });

                return request;
            });
        }),

    updateStatus: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                status: z.enum(approvalRequestStatusValues),
                currentLevel: z.number().int().min(1).optional(),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.$transaction(async (tx) => {
                const request = await tx.approvalRequest.update({
                    where: { id: input.id },
                    data: {
                        status: input.status,
                        currentLevel: input.currentLevel ?? undefined,
                    },
                });

                await tx.transaksiGudang.update({
                    where: { id: request.transaksiGudangId },
                    data: { statusApproval: mapRequestStatusToApproval(input.status) },
                });

                return request;
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.approvalRequest.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
