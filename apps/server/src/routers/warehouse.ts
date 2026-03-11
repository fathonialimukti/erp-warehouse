import { gudangRouter } from "./gudang.js";
import { jenisPaletRouter } from "./jenis-palet.js";
import { lokasiPenyimpananRouter } from "./lokasi-penyimpanan.js";
import { paletRouter } from "./palet.js";
import { transaksiGudangRouter } from "./transaksi-gudang.js";
import { approvalRequestRouter } from "./approval-request.js";
import { approvalStepRouter } from "./approval-step.js";
import { router } from "../trpc.js";

export const warehouseRouter = router({
    gudang: gudangRouter,
    jenisPalet: jenisPaletRouter,
    lokasiPenyimpanan: lokasiPenyimpananRouter,
    palet: paletRouter,
    transaksiGudang: transaksiGudangRouter,
    approvalRequest: approvalRequestRouter,
    approvalStep: approvalStepRouter,
});
