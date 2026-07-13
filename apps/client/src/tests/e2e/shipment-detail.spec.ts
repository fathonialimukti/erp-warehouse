import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Shipment detail page — E2E smoke test for the fine-tuned detail UI.
 *
 * Navigates from the outbound-transaction list into the first shipment's
 * detail page and asserts the shared components render: hero summary,
 * KPI cards, items table, and audit trail.
 */
const SUITE = 'SHIPMENT-DETAIL';

async function openFirstShipmentDetail(page: Page) {
  await page.goto('/outbound-transaction?tab=shipment');
  await page.waitForLoadState('domcontentloaded');
  // Wait for the table to render rows
  await page.locator('[role="row"]').nth(1).waitFor({ state: 'visible', timeout: 15000 });
  // Row action menu -> Detail
  const firstRowMenu = page.locator('[role="row"]').nth(1).getByRole('button', { name: /actions/i }).first();
  await firstRowMenu.click();
  await page.getByRole('menuitem', { name: /detail/i }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('main')).toBeAttached({ timeout: 10000 });
}

test.describe('shipment detail — fine-tuned UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('renders hero summary, KPI cards, items table and audit trail', async ({ page }) => {
    await openFirstShipmentDetail(page);

    // Hero summary card title (document number or id) is present
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // KPI cards: Total Items / Total Quantity / Approval / Dispatch
    // KPI labels render as uppercase <p> elements; scope to avoid matching status chips.
    const kpiLabel = (text: RegExp) =>
      page.locator('p.text-\\[11px\\]').filter({ hasText: text });
    await expect(kpiLabel(/total items/i)).toBeVisible();
    await expect(kpiLabel(/total quantity/i)).toBeVisible();
    await expect(kpiLabel(/approval/i)).toBeVisible();
    await expect(kpiLabel(/dispatch/i)).toBeVisible();

    // Items table section
    await expect(page.getByText(/shipment items/i)).toBeVisible();

    // Audit trail section
    await expect(page.getByText(/audit trail/i)).toBeVisible();
  });

  test('shows not-found state for an unknown id', async ({ page }) => {
    await page.goto('/outbound-transaction/shipment/does-not-exist-id');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 10000 });
  });
});
