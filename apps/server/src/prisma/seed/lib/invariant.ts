export function assertNonNegative(n: number, label: string): void {
  if (n < 0) throw new Error(`invariant violated: ${label} = ${n}`);
}
export function assertNoOverage(planned: number, available: number, label: string): void {
  if (planned > available) throw new Error(`overage: ${label} planned ${planned} > available ${available}`);
}
export function assertOccupancy(used: number, capacity: number, label: string): void {
  if (used > capacity) throw new Error(`occupancy exceeded: ${label} ${used} > ${capacity}`);
}