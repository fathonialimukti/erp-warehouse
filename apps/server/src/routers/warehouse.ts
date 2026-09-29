import { warehouseRouter as warehouseSubRouter } from "./warehouse-crud.js";
import { storageLocationRouter } from "./storage-location.js";
import { palletRouter } from "./pallet.js";
import { warehouseLayoutRouter } from "./warehouse-layout.js";
import { router } from "../trpc.js";

export const warehouseRouter = router({
  warehouse: warehouseSubRouter,
  storageLocation: storageLocationRouter,
  pallet: palletRouter,
  layout: warehouseLayoutRouter,
});
