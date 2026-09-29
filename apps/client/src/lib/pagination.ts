/**
 * Page-number items for a compact HeroUI pagination: `1 … (p-1) p (p+1) … last`.
 * Matches the HeroUI "With Summary" example (ellipsis when more than 7 pages,
 * all pages otherwise).
 */
export function getPaginationItems(
  page: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  // ≤7 pages fit without gaps — show them all (per the contract above).
  if (totalPages <= 7) {
    return Array.from(
      { length: Math.max(0, totalPages) },
      (_, index) => index + 1,
    );
  }

  const items: Array<number | "ellipsis"> = [];
  items.push(1);

  if (page > 3) {
    items.push("ellipsis");
  }

  const startPage = Math.max(2, page - 1);
  const endPage = Math.min(totalPages - 1, page + 1);

  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (page < totalPages - 2) {
    items.push("ellipsis");
  }

  if (totalPages > 1) {
    items.push(totalPages);
  }

  return items;
}
