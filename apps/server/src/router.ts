import { publicProcedure, router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { userRouter } from './routers/user.js';
import { accessControlRouter } from './routers/access-control.js';
import { warehouseRouter } from './routers/warehouse.js';
import { activityLogRouter } from './routers/activity-log.js';
import { skuRouter } from './routers/sku.js';
import { palletRouter } from './routers/pallet.js';
import { uploadRouter } from './routers/upload.js';
import { backupRouter } from './routers/backup.js';
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
import { aiWarehouseRouter } from './routers/ai-warehouse.js';
import { landingRouter } from './routers/landing.js';
import { knowledgeRouter } from './routers/knowledge.js';
import { settingsRouter } from './routers/settings.js';
import { systemLogRouter } from './routers/system-log.js';
import { userPreferenceRouter } from './routers/user-preference.js';
import { reorderRouter } from './routers/reorder.js';
import { stockCountRouter } from './routers/stock-count.js';
import { purchaseOrderRouter } from './routers/purchase-order.js';
import { searchRouter } from './routers/search.js';
import { assistantRouter } from './routers/assistant.js';

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
    backup: backupRouter,
    notification: notificationRouter,
    dashboard: dashboardRouter,
    report: reportRouter,
    inventoryAging: inventoryAgingRouter,
    aiAnalytics: aiAnalyticsRouter,
    aiWarehouse: aiWarehouseRouter,
    landing: landingRouter,
    knowledge: knowledgeRouter,
    settings: settingsRouter,
    systemLog: systemLogRouter,
    userPreference: userPreferenceRouter,
    reorder: reorderRouter,
    stockCount: stockCountRouter,
    purchaseOrder: purchaseOrderRouter,
    search: searchRouter,
    assistant: assistantRouter,
});

export type AppRouter = typeof appRouter;
