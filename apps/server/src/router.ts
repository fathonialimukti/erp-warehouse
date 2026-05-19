import { publicProcedure, router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { userRouter } from './routers/user.js';
import { accessControlRouter } from './routers/access-control.js';
import { warehouseRouter } from './routers/warehouse.js';
import { activityLogRouter } from './routers/activity-log.js';
import { skuRouter } from './routers/sku.js';
import { palletRouter } from './routers/pallet.js';
import { uploadRouter } from './routers/upload.js';
import { notificationRouter } from './routers/notification.js';
import { foundTransactionRouter } from './routers/found-transaction.js';
import { lossTransactionRouter } from './routers/loss-transaction.js';
import { receivingTransactionRouter } from './routers/receiving-transaction.js';
import { wipCompletionRouter } from './routers/wip-completion.js';
import { rmaReceiptRouter } from './routers/rma-receipt.js';
import { wipIssueRouter } from './routers/wip-issue.js';
import { shipmentRouter } from './routers/shipment.js';
import { returnToSupplierRouter } from './routers/return-to-supplier.js';
import { disposalRouter } from './routers/disposal.js';
import { subinventoryTransferRouter } from './routers/subinventory-transfer.js';
import { putawayRouter } from './routers/putaway.js';
import { outboundPickRouter } from './routers/outbound-pick.js';
import { supplierRouter } from './routers/supplier.js';
import { stockMovementRouter } from './routers/stock-movement.js';
import { documentNumberRouter } from './routers/document-number.js';
import { dashboardRouter } from './routers/dashboard.js';

export const appRouter = router({
    hello: publicProcedure.query(() => ({ message: 'Hello World' })),
    auth: authRouter,
    user: userRouter,
    accessControl: accessControlRouter,
    warehouse: warehouseRouter,
    activityLog: activityLogRouter,
    sku: skuRouter,
    pallet: palletRouter,
    foundTransaction: foundTransactionRouter,
    lossTransaction: lossTransactionRouter,
    receivingTransaction: receivingTransactionRouter,
    inboundTransaction: receivingTransactionRouter,
    wipCompletion: wipCompletionRouter,
    rmaReceipt: rmaReceiptRouter,
    wipIssue: wipIssueRouter,
    shipment: shipmentRouter,
    returnToSupplier: returnToSupplierRouter,
    disposal: disposalRouter,
    subinventoryTransfer: subinventoryTransferRouter,
    putaway: putawayRouter,
    outboundPick: outboundPickRouter,
    supplier: supplierRouter,
    stockMovement: stockMovementRouter,
    documentNumber: documentNumberRouter,
    upload: uploadRouter,
    notification: notificationRouter,
    dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
