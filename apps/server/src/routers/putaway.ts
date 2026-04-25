import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getMessage } from "../lib/locale.js";
import { logActivity } from "../lib/activity-log.js";
import { hasPermission, protectedProcedure, router, transactional } from "../trpc.js";

const putawayPreviewInputSchema = z.object({
    inboundTransactionId: z.string().min(1),
});

const putawayAssignmentSchema = z.object({
    palletId: z.string().min(1),
    storageLocationId: z.string().min(1),
});

const putawayAssignInputSchema = z.object({
    inboundTransactionId: z.string().min(1),
    assignments: z.array(putawayAssignmentSchema).min(1),
    message: z.string().optional(),
});

export const putawayRouter = router({
    getAssignmentPreview: protectedProcedure
        .use(hasPermission("putaway_read"))
        .input(putawayPreviewInputSchema)
        .query(async ({ ctx, input }) => {
            const inbound = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.inboundTransactionId },
                select: {
                    id: true,
                    warehouseId: true,
                    approvalStatus: true,
                },
            });

            if (!inbound) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "inboundTransaction.notFound") });
            }

            if (inbound.approvalStatus !== "APPROVED") {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "putaway.transactionMustBeApproved") });
            }

            const pendingPallets = await ctx.db.pallet.findMany({
                where: {
                    status: "AVAILABLE",
                    storageLocationId: null,
                    inboundTransactionItem: {
                        inboundTransactionId: input.inboundTransactionId,
                    },
                },
                orderBy: { createdAt: "asc" },
                include: {
                    palletType: {
                        include: {
                            sku: {
                                select: { id: true, name: true },
                            },
                        },
                    },
                },
            });

            const availableLocations = await ctx.db.storageLocation.findMany({
                where: {
                    warehouseId: inbound.warehouseId,
                    status: "ACTIVE",
                    pallet: null,
                },
                orderBy: { id: "asc" },
                select: {
                    id: true,
                },
            });

            const assignmentCount = Math.min(pendingPallets.length, availableLocations.length);
            const suggestedAssignments = pendingPallets
                .slice(0, assignmentCount)
                .map((pallet, index) => {
                    const location = availableLocations[index];
                    if (!location) {
                        return null;
                    }

                    return {
                        palletId: pallet.id,
                        palletTypeId: pallet.palletTypeId,
                        palletTypeName: pallet.palletType.name,
                        skuId: pallet.palletType.sku.id,
                        skuName: pallet.palletType.sku.name,
                        storageLocationId: location.id,
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            return {
                inboundTransactionId: input.inboundTransactionId,
                warehouseId: inbound.warehouseId,
                pendingPalletCount: pendingPallets.length,
                availableLocationCount: availableLocations.length,
                hasInsufficientLocations: pendingPallets.length > availableLocations.length,
                suggestedAssignments,
            };
        }),

    assignSuggested: protectedProcedure
        .use(hasPermission("putaway_assign"))
        .use(transactional)
        .input(putawayAssignInputSchema)
        .mutation(async ({ ctx, input }) => {
            const inbound = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.inboundTransactionId },
                select: {
                    id: true,
                    warehouseId: true,
                    approvalStatus: true,
                },
            });

            if (!inbound) {
                throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, "inboundTransaction.notFound") });
            }

            if (inbound.approvalStatus !== "APPROVED") {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, "putaway.transactionMustBeApproved") });
            }

            const uniquePalletIds = new Set<string>();
            const uniqueLocationIds = new Set<string>();

            for (const assignment of input.assignments) {
                if (uniquePalletIds.has(assignment.palletId)) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: getMessage(ctx.locale, "putaway.duplicatePalletAssignment"),
                    });
                }
                if (uniqueLocationIds.has(assignment.storageLocationId)) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: getMessage(ctx.locale, "putaway.duplicateLocationAssignment"),
                    });
                }

                uniquePalletIds.add(assignment.palletId);
                uniqueLocationIds.add(assignment.storageLocationId);
            }

            const pendingPallets = await ctx.db.pallet.findMany({
                where: {
                    status: "AVAILABLE",
                    storageLocationId: null,
                    inboundTransactionItem: {
                        inboundTransactionId: input.inboundTransactionId,
                    },
                },
                select: {
                    id: true,
                },
            });

            if (pendingPallets.length === 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, "putaway.noPendingPallets"),
                });
            }

            if (input.assignments.length !== pendingPallets.length) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, "putaway.assignmentCountMismatch", {
                        expected: pendingPallets.length,
                        actual: input.assignments.length,
                    }),
                });
            }

            const pendingPalletIdSet = new Set(pendingPallets.map((pallet) => pallet.id));
            for (const assignment of input.assignments) {
                if (!pendingPalletIdSet.has(assignment.palletId)) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: getMessage(ctx.locale, "putaway.palletNotAssignable"),
                    });
                }
            }

            const locations = await ctx.db.storageLocation.findMany({
                where: {
                    id: {
                        in: Array.from(uniqueLocationIds),
                    },
                },
                include: {
                    pallet: {
                        select: { id: true },
                    },
                },
            });

            if (locations.length !== uniqueLocationIds.size) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, "putaway.locationNotAssignable"),
                });
            }

            for (const location of locations) {
                if (location.warehouseId !== inbound.warehouseId || location.status !== "ACTIVE" || location.pallet) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: getMessage(ctx.locale, "putaway.locationNotAssignable"),
                    });
                }
            }

            const before = input.assignments.map((assignment) => ({
                palletId: assignment.palletId,
                storageLocationId: null,
            }));

            await Promise.all(
                input.assignments.map((assignment) =>
                    ctx.db.pallet.update({
                        where: { id: assignment.palletId },
                        data: {
                            storageLocationId: assignment.storageLocationId,
                        },
                    }),
                ),
            );

            const after = input.assignments.map((assignment) => ({
                palletId: assignment.palletId,
                storageLocationId: assignment.storageLocationId,
            }));

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "inbound_transaction",
                resourceId: input.inboundTransactionId,
                message: `Assigning ${input.assignments.length} inbound pallets to storage locations for ${input.inboundTransactionId}`,
                detail: {
                    before,
                    after,
                    assignmentMessage: input.message ?? null,
                },
            });

            return {
                success: true,
                inboundTransactionId: input.inboundTransactionId,
                assignedCount: input.assignments.length,
                assignments: after,
            };
        }),
});