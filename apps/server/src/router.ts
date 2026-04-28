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
import { inboundTransactionRouter } from './routers/inbound-transaction.js';
import { outboundTransactionRouter } from './routers/outbound-transaction.js';
import { foundTransactionRouter } from './routers/found-transaction.js';
import { lossTransactionRouter } from './routers/loss-transaction.js';

export const appRouter = router({
    hello: publicProcedure.query(() => ({ message: 'Hello World' })),
    auth: authRouter,
    user: userRouter,
    accessControl: accessControlRouter,
    warehouse: warehouseRouter,
    activityLog: activityLogRouter,
    sku: skuRouter,
    pallet: palletRouter,
    inboundTransaction: inboundTransactionRouter,
    outboundTransaction: outboundTransactionRouter,
    foundTransaction: foundTransactionRouter,
    lossTransaction: lossTransactionRouter,
    upload: uploadRouter,
    notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
