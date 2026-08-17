import type { DbClient } from "../../../lib/prisma.js";

/**
 * FIFO pool of free, ACTIVE storage locations per warehouse.
 *
 * `take` returns the lowest-id free locations (deterministic), marks them used
 * in-memory so a single seed run never double-assigns, and throws if the
 * warehouse runs out of free ACTIVE slots. `release` returns a location to the
 * pool (used by outbound/internal steps when a pallet leaves a location).
 */
export class LocationPool {
  private used = new Set<string>();

  constructor(private db: DbClient) {}

  async take(warehouseId: string, count: number): Promise<string[]> {
    const rows = await this.db.storageLocation.findMany({
      where: {
        warehouseId,
        status: "ACTIVE",
        pallet: null,
        id: { notIn: [...this.used] },
      },
      orderBy: { id: "asc" },
      take: count,
      select: { id: true },
    });
    if (rows.length < count) {
      throw new Error(
        `LocationPool: need ${count} free ACTIVE locations in ${warehouseId}, have ${rows.length}`,
      );
    }
    for (const r of rows) this.used.add(r.id);
    return rows.map((r) => r.id);
  }

  release(locationId: string): void {
    this.used.delete(locationId);
  }
}
