import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";
import {
    approvalRequestStatusValues,
    approvalStepActionValues,
    mapRequestStatusToApproval,
} from "./approval-utils.js";

export const approvalStepRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    approvalRequestId: z.string().optional(),
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const skip = (page - 1) * limit;

            const where = {
                ...(input?.approvalRequestId ? { approvalRequestId: input.approvalRequestId } : {}),
            };

            const [data, total] = await Promise.all([
                prisma.approvalStep.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { tanggalAction: "desc" },
                    include: { approver: true, approvalRequest: true },
                }),
                prisma.approvalStep.count({ where }),
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

    create: protectedProcedure
        .input(
            z.object({
                approvalRequestId: z.string().min(1, "ApprovalRequest is required"),
                level: z.number().int().min(1),
                action: z.enum(approvalStepActionValues),
                catatan: z.string().optional(),
                nextStatus: z.enum(approvalRequestStatusValues).optional(),
                nextLevel: z.number().int().min(1).optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            return prisma.$transaction(async (tx) => {
                const step = await tx.approvalStep.create({
                    data: {
                        approvalRequestId: input.approvalRequestId,
                        approverId: ctx.user.userId,
                        level: input.level,
                        action: input.action,
                        catatan: input.catatan ?? null,
                    },
                });

                if (input.nextStatus) {
                    const request = await tx.approvalRequest.update({
                        where: { id: input.approvalRequestId },
                        data: {
                            status: input.nextStatus,
                            currentLevel: input.nextLevel ?? undefined,
                        },
                    });

                    await tx.transaksiGudang.update({
                        where: { id: request.transaksiGudangId },
                        data: { statusApproval: mapRequestStatusToApproval(input.nextStatus) },
                    });
                }

                return step;
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.approvalStep.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
