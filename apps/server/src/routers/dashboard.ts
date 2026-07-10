import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { protectedProcedure, router } from '../trpc.js';

export const dashboardRouter = router({
    summary: protectedProcedure.query(async () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        const [
            palletTotal,
            palletAvailable,
            palletNotAvailable,
            // Inbound PROPOSED counts
            receivingProposed,
            wipCompletionProposed,
            rmaReceiptProposed,
            foundProposed,
            lossProposed,
            // Outbound PROPOSED counts
            shipmentProposed,
            wipIssueProposed,
            returnToSupplierProposed,
            disposalProposed,
            // Execution queues
            putawayPending,
            dispatchPending,
            // This month inbound activity
            receivingThisMonth,
            wipCompletionThisMonth,
            rmaReceiptThisMonth,
            foundThisMonth,
            // This month outbound activity
            shipmentThisMonth,
            wipIssueThisMonth,
            returnToSupplierThisMonth,
            disposalThisMonth,
            // Previous month (for delta)
            receivingPrevMonth,
            shipmentPrevMonth,
        ] = await Promise.all([
            prisma.pallet.count(),
            prisma.pallet.count({ where: { status: 'AVAILABLE' } }),
            prisma.pallet.count({ where: { status: 'NOT_AVAILABLE' } }),
            prisma.receivingTransaction.count({ where: { approvalStatus: 'PROPOSED' } }),
            prisma.wipCompletion.count({ where: { approvalStatus: 'PROPOSED' } }),
            prisma.rmaReceipt.count({ where: { approvalStatus: 'PROPOSED' } }),
            prisma.foundTransaction.count({ where: { approvalStatus: 'PROPOSED' } }),
            prisma.lossTransaction.count({ where: { approvalStatus: 'PROPOSED' } }),
            prisma.shipment.count({ where: { approvalStatus: 'PROPOSED' } }),
            prisma.wipIssue.count({ where: { approvalStatus: 'PROPOSED' } }),
            prisma.returnToSupplier.count({ where: { approvalStatus: 'PROPOSED' } }),
            prisma.disposal.count({ where: { approvalStatus: 'PROPOSED' } }),
            prisma.putawayLine.count({ where: { status: 'PENDING' } }),
            prisma.pickLine.count({ where: { status: 'PENDING' } }),
            prisma.receivingTransaction.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
            prisma.wipCompletion.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
            prisma.rmaReceipt.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
            prisma.foundTransaction.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
            prisma.shipment.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
            prisma.wipIssue.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
            prisma.returnToSupplier.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
            prisma.disposal.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
            prisma.receivingTransaction.count({ where: { createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } } }),
            prisma.shipment.count({ where: { createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } } }),
        ]);

        const totalInboundThisMonth = receivingThisMonth + wipCompletionThisMonth + rmaReceiptThisMonth + foundThisMonth;
        const totalOutboundThisMonth = shipmentThisMonth + wipIssueThisMonth + returnToSupplierThisMonth + disposalThisMonth;
        const totalInboundProposed = receivingProposed + wipCompletionProposed + rmaReceiptProposed + foundProposed;
        const totalOutboundProposed = shipmentProposed + wipIssueProposed + returnToSupplierProposed + disposalProposed;

        return {
            pallets: {
                total: palletTotal,
                available: palletAvailable,
                notAvailable: palletNotAvailable,
            },
            pendingApprovals: {
                total: totalInboundProposed + totalOutboundProposed + lossProposed,
                inbound: totalInboundProposed,
                outbound: totalOutboundProposed,
                loss: lossProposed,
                breakdown: {
                    receiving: receivingProposed,
                    wipCompletion: wipCompletionProposed,
                    rmaReceipt: rmaReceiptProposed,
                    found: foundProposed,
                    shipment: shipmentProposed,
                    wipIssue: wipIssueProposed,
                    returnToSupplier: returnToSupplierProposed,
                    disposal: disposalProposed,
                },
            },
            execution: {
                putawayPending,
                dispatchPending,
            },
            monthlyActivity: {
                totalInbound: totalInboundThisMonth,
                totalOutbound: totalOutboundThisMonth,
                receiving: receivingThisMonth,
                wipCompletion: wipCompletionThisMonth,
                rmaReceipt: rmaReceiptThisMonth,
                found: foundThisMonth,
                shipment: shipmentThisMonth,
                wipIssue: wipIssueThisMonth,
                returnToSupplier: returnToSupplierThisMonth,
                disposal: disposalThisMonth,
            },
            prevMonthActivity: {
                receiving: receivingPrevMonth,
                shipment: shipmentPrevMonth,
            },
        };
    }),

    warehouseAllocations: protectedProcedure.query(async () => {
        const [warehouses, allLocations, fullLocations] = await Promise.all([
            prisma.warehouse.findMany({
                select: {
                    id: true,
                    name: true,
                },
            }),
            prisma.storageLocation.groupBy({
                by: ['warehouseId'],
                _count: { id: true },
            }),
            prisma.storageLocation.groupBy({
                by: ['warehouseId'],
                where: { status: 'FULL' },
                _count: { id: true },
            }),
        ]);

        const warehouseNameMap: Record<string, string> = {};
        warehouses.forEach((warehouse) => {
            warehouseNameMap[warehouse.id] = warehouse.name;
        });

        const usedMap: Record<string, number> = {};
        fullLocations.forEach(({ warehouseId, _count }) => {
            usedMap[warehouseId] = _count.id;
        });

        return allLocations.map(({ warehouseId, _count }) => {
            const total = _count.id;
            const used = usedMap[warehouseId] ?? 0;
            const rate = total > 0 ? Math.round((used / total) * 100) : 0;
            return {
                warehouseId,
                warehouseName: warehouseNameMap[warehouseId] ?? null,
                total,
                used,
                rate,
            };
        });
    }),

    activityFeed: protectedProcedure
        .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
        .query(async ({ input }) => {
            const take = input?.limit ?? 10;

            const data = await prisma.activityLog.findMany({
                take,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });

            return { data };
        }),

    myTasks: protectedProcedure.query(async ({ ctx }) => {
        const userId = ctx.user!.userId;

        // Fetch the user's permissions so approval counts only include transaction
        // types the user is actually allowed to approve. Without this, a user with
        // only `receiving@approve` would be told they have approvals waiting that
        // they cannot action.
        const userWithPerms = await ctx.db.user.findUnique({
            where: { id: userId },
            include: {
                role: {
                    include: {
                        permissions: { include: { permission: true } },
                    },
                },
            },
        });
        const userPerms = new Set(
            (userWithPerms?.role?.permissions ?? []).map((rp) => rp.permission.name),
        );
        const canApprove = (perm: string) => userPerms.has(perm);

        const [
            approvableReceiving, approvableWipCompletion, approvableRmaReceipt,
            approvableShipment, approvableWipIssue, approvableRts,
            approvableDisposal, approvableLoss, approvableFound,
            putawayPending, pickPending,
            draftReceiving, draftWipCompletion, draftRmaReceipt, draftFound,
            draftShipment, draftWipIssue, draftRts, draftDisposal, draftLoss,
            myRecentActivity,
        ] = await Promise.all([
            canApprove('receiving@approve')
                ? prisma.receivingTransaction.count({ where: { approvalStatus: 'PROPOSED', createdById: { not: userId } } })
                : Promise.resolve(0),
            canApprove('wip-completion@approve')
                ? prisma.wipCompletion.count({ where: { approvalStatus: 'PROPOSED', createdById: { not: userId } } })
                : Promise.resolve(0),
            canApprove('rma-receipt@approve')
                ? prisma.rmaReceipt.count({ where: { approvalStatus: 'PROPOSED', createdById: { not: userId } } })
                : Promise.resolve(0),
            canApprove('shipment@approve')
                ? prisma.shipment.count({ where: { approvalStatus: 'PROPOSED', createdById: { not: userId } } })
                : Promise.resolve(0),
            canApprove('wip-issue@approve')
                ? prisma.wipIssue.count({ where: { approvalStatus: 'PROPOSED', createdById: { not: userId } } })
                : Promise.resolve(0),
            canApprove('return-to-supplier@approve')
                ? prisma.returnToSupplier.count({ where: { approvalStatus: 'PROPOSED', createdById: { not: userId } } })
                : Promise.resolve(0),
            canApprove('disposal@approve')
                ? prisma.disposal.count({ where: { approvalStatus: 'PROPOSED', createdById: { not: userId } } })
                : Promise.resolve(0),
            canApprove('loss@approve')
                ? prisma.lossTransaction.count({ where: { approvalStatus: 'PROPOSED', createdById: { not: userId } } })
                : Promise.resolve(0),
            canApprove('found@approve')
                ? prisma.foundTransaction.count({ where: { approvalStatus: 'PROPOSED', createdById: { not: userId } } })
                : Promise.resolve(0),
            prisma.putawayLine.count({ where: { status: 'PENDING' } }),
            prisma.pickLine.count({ where: { status: 'PENDING' } }),
            prisma.receivingTransaction.count({ where: { approvalStatus: 'DRAFT', createdById: userId } }),
            prisma.wipCompletion.count({ where: { approvalStatus: 'DRAFT', createdById: userId } }),
            prisma.rmaReceipt.count({ where: { approvalStatus: 'DRAFT', createdById: userId } }),
            prisma.foundTransaction.count({ where: { approvalStatus: 'DRAFT', createdById: userId } }),
            prisma.shipment.count({ where: { approvalStatus: 'DRAFT', createdById: userId } }),
            prisma.wipIssue.count({ where: { approvalStatus: 'DRAFT', createdById: userId } }),
            prisma.returnToSupplier.count({ where: { approvalStatus: 'DRAFT', createdById: userId } }),
            prisma.disposal.count({ where: { approvalStatus: 'DRAFT', createdById: userId } }),
            prisma.lossTransaction.count({ where: { approvalStatus: 'DRAFT', createdById: userId } }),
            prisma.activityLog.findMany({
                where: { userId },
                take: 5,
                orderBy: { createdAt: 'desc' },
                select: { id: true, action: true, message: true, resource: true, resourceId: true, createdAt: true },
            }),
        ]);

        const totalApprovals = approvableReceiving + approvableWipCompletion + approvableRmaReceipt
            + approvableShipment + approvableWipIssue + approvableRts
            + approvableDisposal + approvableLoss + approvableFound;

        const myDraftInbound = draftReceiving + draftWipCompletion + draftRmaReceipt + draftFound;
        const myDraftOutbound = draftShipment + draftWipIssue + draftRts + draftDisposal + draftLoss;

        return {
            totalApprovals,
            execution: { putawayPending, pickPending },
            myDrafts: { inbound: myDraftInbound, outbound: myDraftOutbound, total: myDraftInbound + myDraftOutbound },
            myRecentActivity,
        };
    }),
});
