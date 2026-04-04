import { gudangRouter } from "./gudang.js";
import { jenisPaletRouter } from "./jenis-palet.js";
import { lokasiPenyimpananRouter } from "./lokasi-penyimpanan.js";
import { paletRouter } from "./palet.js";
import { router } from "../trpc.js";

export const warehouseRouter = router({
    gudang: gudangRouter,
    jenisPalet: jenisPaletRouter,
    lokasiPenyimpanan: lokasiPenyimpananRouter,
    palet: paletRouter,
});
