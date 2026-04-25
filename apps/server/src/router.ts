import { publicProcedure, router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { userRouter } from './routers/user.js';
import { roleRouter } from './routers/role.js';
import { permissionRouter } from './routers/permission.js';
import { warehouseRouter } from './routers/warehouse.js';
import { activityLogRouter } from './routers/activity-log.js';
import { skuRouter } from './routers/sku.js';
import { palletTypeRouter } from './routers/pallet-type.js';
import { palletRouter } from './routers/pallet.js';
import { uploadRouter } from './routers/upload.js';
import { notificationRouter } from './routers/notification.js';
import { inboundTransactionRouter } from './routers/inbound-transaction.js';
import { outboundTransactionRouter } from './routers/outbound-transaction.js';
import { foundTransactionRouter } from './routers/found-transaction.js';
import { lossTransactionRouter } from './routers/loss-transaction.js';
import { putawayRouter } from './routers/putaway.js';

export const appRouter = router({
    hello: publicProcedure.query(() => ({ message: 'Hello World' })),
    auth: authRouter,
    user: userRouter,
    role: roleRouter,
    permission: permissionRouter,
    warehouse: warehouseRouter,
    activityLog: activityLogRouter,
    sku: skuRouter,
    palletType: palletTypeRouter,
    pallet: palletRouter,
    inboundTransaction: inboundTransactionRouter,
    outboundTransaction: outboundTransactionRouter,
    foundTransaction: foundTransactionRouter,
    lossTransaction: lossTransactionRouter,
    putaway: putawayRouter,
    upload: uploadRouter,
    notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
