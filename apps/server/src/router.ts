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
import { transactionRouter } from './routers/transaction.js';
import { supplierRouter } from './routers/supplier.js';
import { productRouter } from './routers/product.js';
import { stockMovementRouter } from './routers/stock-movement.js';
import { documentNumberRouter } from './routers/document-number.js';
import { dashboardRouter } from './routers/dashboard.js';
import { reportRouter } from './routers/report.js';
import { inventoryAgingRouter } from './routers/inventory-aging.js';
import { aiAnalyticsRouter } from './routers/ai-analytics.js';
import { landingRouter } from './routers/landing.js';
import { knowledgeRouter } from './routers/knowledge.js';

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
    wipCompletion: wipCompletionRouter,
    rmaReceipt: rmaReceiptRouter,
    wipIssue: wipIssueRouter,
    shipment: shipmentRouter,
    returnToSupplier: returnToSupplierRouter,
    disposal: disposalRouter,
    subinventoryTransfer: subinventoryTransferRouter,
    transaction: transactionRouter,
    supplier: supplierRouter,
    product: productRouter,
    stockMovement: stockMovementRouter,
    documentNumber: documentNumberRouter,
    upload: uploadRouter,
    notification: notificationRouter,
    dashboard: dashboardRouter,
    report: reportRouter,
    inventoryAging: inventoryAgingRouter,
    aiAnalytics: aiAnalyticsRouter,
    landing: landingRouter,
    knowledge: knowledgeRouter,
});

export type AppRouter = typeof appRouter;
