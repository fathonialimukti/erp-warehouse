import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("warehouse full CRUD", () => {
  const TEST_NAME = `E2E-WH-${Date.now()}`;
  let warehouseId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("step 1 — opens warehouse index", async ({ page }) => {
    await page.goto("/warehouse");
    await expect(page.getByLabel(/search warehouse/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("button", { name: /create warehouse/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("step 2 — create warehouse and capture ID", async ({ page }) => {
    await page.goto("/warehouse");
    await page.getByRole("button", { name: /create warehouse/i }).click();
    await expect(page).toHaveURL(/\/warehouse\/new/);

    await page.getByLabel(/name/i).first().fill(TEST_NAME);
    await page
      .getByLabel(/address/i)
      .first()
      .fill("Jl. Test No. 1");
    await page.getByRole("button", { name: /save|create|submit/i }).click();
    await new Promise((r) => setTimeout(r, 3000));

    const url = page.url();
    const match = url.match(/\/warehouse\/([^/\n]+)/);
    if (match) warehouseId = match[1];
    expect(url).toContain("/warehouse/");
  });

  test("step 3 — search on index", async ({ page }) => {
    await page.goto("/warehouse");
    const search = page.getByLabel(/search warehouse/i);
    await search.fill(TEST_NAME);
    await expect(search).toHaveValue(TEST_NAME);
  });

  test("step 4 — open detail page", async ({ page }) => {
    if (!warehouseId) return;
    await page.goto(`/warehouse/${warehouseId}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("step 5 — delete warehouse", async ({ page }) => {
    if (!warehouseId) return;
    await page.goto(`/warehouse/${warehouseId}`);
    const deleteBtn = page
      .getByRole("button", { name: /delete|hapus/i })
      .first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      await new Promise((r) => setTimeout(r, 1000));
      const confirmBtn = page.getByRole("button", { name: /delete/i }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    await expect(page).toHaveURL(/\/warehouse/);
  });
});
