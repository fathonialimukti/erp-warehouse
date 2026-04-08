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
import { notificationRouter } from './routers/notification.js';
import { transaksiMasukRouter } from './routers/transaksi-masuk.js';
import { transaksiKeluarRouter } from './routers/transaksi-keluar.js';
import { transaksiTemuanRouter } from './routers/transaksi-temuan.js';
import { transaksiKehilanganRouter } from './routers/transaksi-kehilangan.js';

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
    transaksiMasuk: transaksiMasukRouter,
    transaksiKeluar: transaksiKeluarRouter,
    transaksiTemuan: transaksiTemuanRouter,
    transaksiKehilangan: transaksiKehilanganRouter,
    upload: uploadRouter,
    notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
