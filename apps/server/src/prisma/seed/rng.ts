export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit — stable across processes/Bun versions. */
export function seedByKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pickInt(seed: number, min: number, max: number): number {
  return min + Math.floor(mulberry32(seed)() * (max - min + 1));
}
export function pickUnit<T>(seed: number, arr: readonly T[]): T {
  return arr[pickInt(seed, 0, arr.length - 1)]!;
}
export function pickQty(seed: number, min: number, max: number): number {
  return pickInt(seed, min, max);
}
