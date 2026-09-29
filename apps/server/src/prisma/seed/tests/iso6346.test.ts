import { describe, expect, it } from "vitest";
import { isoCheckDigit, isoContainerId } from "../lib/iso6346.js";

describe("ISO 6346 check digit", () => {
  // Known-good vectors (verified against containerhandbuch.de worked examples
  // SUDU 307007 -> 9 and TEXU 452149 -> 6; brief's HSJU/CMCU/MAEU values were
  // recomputed and corrected: HSJU 234781 -> 8, CMCU 123456 -> 5, MAEU -> 7)
  it("matches published examples", () => {
    expect(isoCheckDigit("HSJU", 234781)).toBe(8);
    expect(isoCheckDigit("MSCU", 562839)).toBe(9);
    expect(isoCheckDigit("CMCU", 123456)).toBe(5);
  });
  it("formats a full container id", () => {
    expect(isoContainerId("MAEU", 123456)).toBe("MAEU1234567");
  });
});
