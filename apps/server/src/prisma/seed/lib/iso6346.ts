const LETTER_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19,
  J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29,
  S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
};

function charValue(ch: string): number {
  return /^\d$/.test(ch) ? Number(ch) : LETTER_VALUES[ch]!;
}

/** Owner must be 4 uppercase letters (last = U); serial 0..999999. */
export function isoCheckDigit(owner: string, serial: number): number {
  const body = (owner + String(serial).padStart(6, "0")).toUpperCase();
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += charValue(body[i]!) * 2 ** i;
  const rem = sum % 11;
  return rem === 10 ? 0 : rem;
}

/** Full ISO 6346 identifier: owner + 6-digit serial + check digit. */
export function isoContainerId(owner: string, serial: number): string {
  return `${owner.toUpperCase()}${String(serial).padStart(6, "0")}${isoCheckDigit(owner, serial)}`;
}