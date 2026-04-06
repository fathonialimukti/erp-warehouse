import { publicProcedure, router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { userRouter } from './routers/user.js';
import { roleRouter } from './routers/role.js';
import { permissionRouter } from './routers/permission.js';
import { warehouseRouter } from './routers/warehouse.js';
import { activityLogRouter } from './routers/activity-log.js';
import { skuRouter } from './routers/sku.js';
import { jenisPaletRouter } from './routers/jenis-palet.js';
import { paletRouter } from './routers/palet.js';
import { uploadRouter } from './routers/upload.js';

export const appRouter = router({
    hello: publicProcedure.query(() => ({ message: 'Hello World' })),
    auth: authRouter,
    user: userRouter,
    role: roleRouter,
    permission: permissionRouter,
    warehouse: warehouseRouter,
    activityLog: activityLogRouter,
    sku: skuRouter,
    jenisPalet: jenisPaletRouter,
    palet: paletRouter,
    upload: uploadRouter,
});

export type AppRouter = typeof appRouter;
