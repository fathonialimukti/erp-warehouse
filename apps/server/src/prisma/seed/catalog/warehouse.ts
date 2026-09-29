import type { DbClient } from "../../../lib/prisma.js";

export const WAREHOUSE_SEED = [
  {
    code: "WH01",
    name: "Raw Material Hub",
    address: "Eemhavenweg 40, 3089 KA Rotterdam",
    totalCapacity: 264,
  },
  {
    code: "WH02",
    name: "Production Buffer Warehouse",
    address: "Eemhavenweg 142, 3089 KA Rotterdam",
    totalCapacity: 108,
  },
  {
    code: "WH03",
    name: "Finished Goods Distribution Center",
    address: "De Werf 3, 3089 KA Rotterdam",
    totalCapacity: 324,
  },
] as const;

/** Idempotent: updates only `address` when the code already exists. */
export async function ensureWarehouses(
  db: DbClient,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const row of WAREHOUSE_SEED) {
    const existing = await db.warehouse.findUnique({
      where: { code: row.code },
      select: { id: true },
    });
    if (existing) {
      await db.warehouse.update({
        where: { id: existing.id },
        data: { address: row.address },
      });
      out[row.code] = existing.id;
    } else {
      const created = await db.warehouse.create({
        data: { ...row, objectId: row.code },
      });
      out[row.code] = created.id;
    }
  }
  return out;
}
