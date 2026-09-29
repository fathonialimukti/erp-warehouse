import { describe, it, expect } from "vitest";
import { getPaginationItems } from "../../lib/pagination";

describe("getPaginationItems", () => {
  it("returns all pages contiguously when totalPages <= 7", () => {
    expect(getPaginationItems(5, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPaginationItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("uses ellipsis for an 8+ page range", () => {
    expect(getPaginationItems(5, 10)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      10,
    ]);
    expect(getPaginationItems(5, 10)).toContain("ellipsis");
  });

  it("returns an empty array when totalPages is 0", () => {
    expect(getPaginationItems(1, 0)).toEqual([]);
  });
});
