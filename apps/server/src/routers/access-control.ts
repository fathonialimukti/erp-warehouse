import { router } from "../trpc.js";
import { permissionRouter } from "./permission.js";
import { roleRouter } from "./role.js";

export const accessControlRouter = router({
  role: roleRouter,
  permission: permissionRouter,
});
