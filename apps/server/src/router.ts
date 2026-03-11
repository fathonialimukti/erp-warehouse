import { publicProcedure, router } from './trpc.js';
import { authRouter } from './routers/auth.js';
import { userRouter } from './routers/user.js';
import { roleRouter } from './routers/role.js';
import { permissionRouter } from './routers/permission.js';
import { warehouseRouter } from './routers/warehouse.js';

export const appRouter = router({
    hello: publicProcedure.query(() => ({ message: 'Hello World' })),
    auth: authRouter,
    user: userRouter,
    role: roleRouter,
    permission: permissionRouter,
    warehouse: warehouseRouter,
});

export type AppRouter = typeof appRouter;
