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
        const [allLocations, fullLocations] = await Promise.all([
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

        const usedMap: Record<string, number> = {};
        fullLocations.forEach(({ warehouseId, _count }) => {
            usedMap[warehouseId] = _count.id;
        });

        return allLocations.map(({ warehouseId, _count }) => {
            const total = _count.id;
            const used = usedMap[warehouseId] ?? 0;
            const rate = total > 0 ? Math.round((used / total) * 100) : 0;
            return { warehouseId, total, used, rate };
        });
    }),
});
