import { Page } from "@playwright/test";

/**
 * Open a SelectSearch dropdown by its aria-label and select the first available option.
 * The SelectSearch is a server-backed dropdown with a search field inside a popover.
 * HeroUI Select renders as a button, not a combobox.
 *
 * Structure inside Select.Popover:
 *   <div> <SearchField (aria-label="Search …")> </div> <ListBox role="listbox"> …
 * so the search input is a SIBLING of the listbox, never a descendant.
 */
export async function selectSearchOption(
  page: Page,
  ariaLabel: string | RegExp,
  searchTerm: string,
): Promise<void> {
  // Scope to main content: sidebar/nav buttons can share the same name
  // (e.g. 'Warehouses') and a page-wide match navigates away mid-flow.
  const trigger = page
    .locator("main")
    .getByRole("button", { name: ariaLabel })
    .first();
  await trigger.click();

  // Wait for the popover to appear
  await page.waitForTimeout(1000);

  // Type a search term to trigger the debounced query. SelectSearch inputs
  // carry an aria-label starting with "Search" (their placeholder text).
  const term = searchTerm || "a";
  const searchInput = page
    .locator('input[aria-label*="Search" i]:visible')
    .last();
  await searchInput.fill(term);

  // Wait for results to load (debounce + network)
  await page.waitForTimeout(2500);

  // Pick the first option of the open listbox.
  const option = page
    .locator('[role="listbox"]:visible')
    .last()
    .locator('[role="option"]')
    .first();
  await option
    .waitFor({ state: "visible", timeout: 8000 })
    .catch(() => undefined);
  await option.click({ timeout: 8000 }).catch(() => undefined);

  // Popover close animation
  await page.waitForTimeout(500);
}
