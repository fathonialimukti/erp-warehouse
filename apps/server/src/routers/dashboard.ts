import { prisma } from '../lib/prisma.js';
import { protectedProcedure, router } from '../trpc.js';

export const dashboardRouter = router({
    summary: protectedProcedure.query(async () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0,
            23,
            59,
            59,
            999,
        );

        const [
            palletTotal,
            palletNotAvailable,
            // Inbound proposed (across all IN transaction types)
            receivingProposed,
            wipCompletionProposed,
            rmaReceiptProposed,
            foundProposed,
            lossProposed,
            // Outbound proposed (across all OUT transaction types)
            shipmentProposed,
            wipIssueProposed,
            returnToSupplierProposed,
            disposalProposed,
            // Putaway pending
            putawayPending,
            // Dispatch pending
            dispatchPending,
            // This month activity
            receivingThisMonth,
            shipmentThisMonth,
        ] = await Promise.all([
            prisma.pallet.count(),
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
            prisma.receivingTransaction.count({
                where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
            }),
            prisma.shipment.count({
                where: { createdAt: { gte: startOfMonth, lte: endOfMonth } },
            }),
        ]);

        const inboundProposed = receivingProposed + wipCompletionProposed + rmaReceiptProposed + foundProposed;
        const outboundProposed = shipmentProposed + wipIssueProposed + returnToSupplierProposed + disposalProposed;

        return {
            palletTurnover: {
                dispatched: palletNotAvailable,
                total: palletTotal,
            },
            pendingApprovals: {
                inbound: inboundProposed,
                outbound: outboundProposed,
                loss: lossProposed,
            },
            execution: {
                putawayPending,
                dispatchPending,
            },
            monthlyActivity: {
                receiving: receivingThisMonth,
                shipment: shipmentThisMonth,
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
