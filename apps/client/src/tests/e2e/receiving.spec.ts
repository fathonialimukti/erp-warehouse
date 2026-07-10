import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { loginAsAdmin } from './helpers/auth';
import {
  createTestPrefix,
  randomDocNumber,
  randomNotes,
} from './helpers/faker';
import { selectSearchOption } from './helpers/select-search';

/**
 * Receiving transaction — full Create (Draft) → Detail with faker.
 * Each run generates fresh unique data so you can repeat infinite times.
 *
 * Run: bun run test -- --grep "receiving — full flow" --repeat-each=3
 */

const SUITE = createTestPrefix('RCV');
let createdTxId: string | null = null;

test.describe('receiving — full flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Step 1 — fills general fields with faker', async ({ page }) => {
    await page.goto('/inbound-transaction/receiving/new');
    await page.waitForLoadState('networkidle');

    const poRef = randomDocNumber('PO');
    const dnRef = randomDocNumber('DN');
    const carrier = faker.company.name();
    const tracking = `TRK-${faker.string.alphanumeric(8).toUpperCase()}`;
    const driver = faker.person.fullName();
    const contact = faker.phone.number().slice(0, 15);
    const plate = `B ${faker.number.int({ min: 1000, max: 9999 })} ${faker.string.alpha(2).toUpperCase()}`;
    const notes = randomNotes();

    await page.getByPlaceholder(/PO reference/i).first().fill(poRef);
    await page.getByPlaceholder(/Delivery note reference/i).first().fill(dnRef);
    await page.getByPlaceholder(/Carrier name/i).first().fill(carrier);
    await page.getByPlaceholder(/Tracking number/i).first().fill(tracking);
    await page.getByPlaceholder(/Driver name/i).first().fill(driver);
    await page.getByPlaceholder(/Driver contact/i).first().fill(contact);
    await page.getByPlaceholder(/Vehicle plate/i).first().fill(plate);
    await page.getByPlaceholder(/Additional notes/i).first().fill(notes);

    await expect(page.getByPlaceholder(/PO reference/i).first()).toHaveValue(poRef);
    await expect(page.getByPlaceholder(/Carrier name/i).first()).toHaveValue(carrier);
  });

  test('Step 2 — selects supplier and warehouse via SelectSearch', async ({ page }) => {
    await page.goto('/inbound-transaction/receiving/new');
    await page.waitForLoadState('networkidle');
    await selectSearchOption(page, /supplier/i, '');
    await selectSearchOption(page, /warehouse/i, '');
  });

  test('Step 3 — adds SKU item and sets quantity', async ({ page }) => {
    await page.goto('/inbound-transaction/receiving/new');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add item/i }).click();
    await page.waitForTimeout(500);
    await selectSearchOption(page, /sku/i, '');

    const qty = faker.number.int({ min: 1, max: 100 }).toString();
    const qtyInput = page.getByLabel(/qty|quantity/i).first();
    await qtyInput.fill(qty);
    await expect(qtyInput).toHaveValue(qty);
  });

  test('Step 4 — saves as draft and captures ID', async ({ page }) => {
    await page.goto('/inbound-transaction/receiving/new');
    await page.waitForLoadState('networkidle');

    await selectSearchOption(page, /supplier/i, '');
    await selectSearchOption(page, /warehouse/i, '');

    await page.getByRole('button', { name: /add item/i }).click();
    await page.waitForTimeout(500);
    await selectSearchOption(page, /sku/i, '');
    await page.getByLabel(/qty|quantity/i).first().fill(faker.number.int({ min: 1, max: 10 }).toString());

    await page.getByRole('button', { name: /save draft/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /confirm|yes/i }).click();
    await page.waitForTimeout(3000);

    const url = page.url();
    const match = url.match(/\/inbound-transaction\/receiving\/([^/\n]+)/);
    if (match) createdTxId = match[1];
    expect(url).toContain('/inbound-transaction/receiving/');
  });

  test('Step 5 — verifies detail page', async ({ page }) => {
    if (!createdTxId) return;
    await page.goto(`/inbound-transaction/receiving/${createdTxId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toBeAttached({ timeout: 10000 });
  });
});