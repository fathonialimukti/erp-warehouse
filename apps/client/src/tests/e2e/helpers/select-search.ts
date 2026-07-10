import { Page } from '@playwright/test';

/**
 * Open a SelectSearch dropdown by its aria-label and select the first available option.
 * The SelectSearch is a server-backed dropdown with a search field inside a popover.
 * HeroUI Select renders as a button, not a combobox.
 */
export async function selectSearchOption(
  page: Page,
  ariaLabel: string | RegExp,
  searchTerm: string,
): Promise<void> {
  // Click the Select trigger button (HeroUI renders Select as button, not combobox)
  const trigger = page.getByRole('button', { name: ariaLabel }).first();
  await trigger.click();

  // Wait for the popover to appear
  await page.waitForTimeout(1000);

  // Find the search input inside the popover
  const searchInput = page.locator('[role="dialog"] input[type="search"], input[placeholder*="Search"]').first();
  
  // Type a search term to trigger the debounced query
  const term = searchTerm || 'a';
  await searchInput.fill(term);

  // Wait for results to load (debounce + network)
  await page.waitForTimeout(2500);

  // HeroUI ListBox items might not have role="option" in some versions
  // Try multiple selectors to find the first clickable item
  const option = page.locator('[role="option"], [role="listbox"] > div, ul[role="listbox"] li').first();
  
  try {
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await option.click();
  } catch (e) {
    // Fallback: try clicking by text content if role-based selectors fail
    const fallbackOption = page.locator('text=/./').first();
    await fallbackOption.click({ timeout: 5000 }).catch(() => {});
  }
  
  await page.waitForTimeout(500);
}