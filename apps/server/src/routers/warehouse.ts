import { warehouseRouter as warehouseSubRouter } from "./warehouse-crud.js";
import { palletTypeRouter } from "./pallet-type.js";
import { storageLocationRouter } from "./storage-location.js";
import { palletRouter } from "./pallet.js";
import { router } from "../trpc.js";

export const warehouseRouter = router({
    warehouse: warehouseSubRouter,
    palletType: palletTypeRouter,
    storageLocation: storageLocationRouter,
    pallet: palletRouter,
});
