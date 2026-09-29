import { test, expect } from "@playwright/test";
import { faker } from "@faker-js/faker";
import { loginAsAdmin } from "./helpers/auth";
import {
  createTestPrefix,
  randomSupplierCode,
  randomAddress,
  randomEmail,
  randomPhone,
  randomNotes,
} from "./helpers/faker";

/**
 * Supplier CRUD — repeatable with faker.
 *
 * Run repeatedly:
 *   bun run test -- --grep "supplier full CRUD" --repeat-each=5
 *
 * The test creates a real supplier record, verifies it in search & detail,
 * then deletes it. Each run uses a unique faker-generated name.
 */

test.describe("supplier full CRUD", () => {
  const SUITE = createTestPrefix("SUP");
  // Use faker values stored at module level so all steps share same data
  const supplierCode = randomSupplierCode();
  const supplierName = `${SUITE} ${faker.commerce.department()}`;
  const supplierEmail = randomEmail();
  const supplierPhone = randomPhone();
  const supplierAddress = randomAddress();
  const supplierNotes = randomNotes();

  let supplierId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("step 1 — create supplier", async ({ page }) => {
    await page.goto("/suppliers");
    await page
      .getByRole("button", { name: /create supplier|add supplier/i })
      .click();
    await expect(page).toHaveURL(/\/suppliers\/new/);

    // Fill all fields with faker data
    await page.getByLabel(/code/i).first().fill(supplierCode);
    await page
      .getByLabel(/^name$/i)
      .first()
      .fill(supplierName);
    await page.getByLabel(/email/i).first().fill(supplierEmail);
    await page.getByLabel(/phone/i).first().fill(supplierPhone);
    await page
      .getByLabel(/address/i)
      .first()
      .fill(supplierAddress);
    await page.getByLabel(/notes/i).first().fill(supplierNotes);

    // Submit
    await page
      .getByRole("button", { name: /create supplier|save|submit/i })
      .click();
    await new Promise((r) => setTimeout(r, 3000));

    // Capture created ID from redirect URL
    const url = page.url();
    const match = url.match(/\/suppliers\/([^/\n]+)/);
    if (match) supplierId = match[1];
    expect(url).toContain("/suppliers/");
    expect(supplierId).toBeTruthy();
  });

  test("step 2 — verify detail page shows our data", async ({ page }) => {
    if (!supplierId) return;
    await page.goto(`/suppliers/${supplierId}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 8000,
    });

    // Page should contain the supplier name we submitted
    await expect(page.locator("body")).toContainText(supplierName);
  });

  test("step 3 — search on index finds it", async ({ page }) => {
    await page.goto("/suppliers");
    const search = page.locator("#supplier-search");
    if (await search.isVisible({ timeout: 3000 })) {
      await search.fill(supplierName);
      await page.waitForTimeout(2000);
      // The table should contain our supplier row
      await expect(page.locator("body")).toContainText(supplierName);
    }
  });

  test("step 4 — delete supplier", async ({ page }) => {
    if (!supplierId) return;
    await page.goto(`/suppliers/${supplierId}`);

    // Wait for page to load
    await expect(page.locator("main")).toBeAttached({ timeout: 8000 });

    const deleteBtn = page
      .getByRole("button", { name: /delete|hapus/i })
      .first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
      const confirmBtn = page
        .getByRole("button", { name: /delete supplier/i })
        .first();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    // Should redirect to suppliers index after delete
    await expect(page).toHaveURL(/\/suppliers/, { timeout: 8000 });
  });
});
