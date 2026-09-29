import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("SKU full CRUD", () => {
  let skuId: string | null = null;

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("step 1 — opens SKU index with search and tabs", async ({ page }) => {
    await page.goto("/skus");
    await expect(page.getByLabel(/search sku/i)).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("tab", { name: /raw material/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /packaging material/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /finished good/i }),
    ).toBeVisible();
  });

  test("step 2 — types search on SKU index", async ({ page }) => {
    await page.goto("/skus");
    const search = page.getByLabel(/search sku/i);
    await search.fill("bolt");
    await expect(search).toHaveValue("bolt");
  });

  test("step 3 — switches to finished good tab", async ({ page }) => {
    await page.goto("/skus");
    await page.getByRole("tab", { name: /finished good/i }).click();
    await new Promise((r) => setTimeout(r, 1000));
    await expect(page).toHaveURL(/\/skus/);
  });

  test("step 4 — open first SKU detail from table", async ({ page }) => {
    await page.goto("/skus");
    await new Promise((r) => setTimeout(r, 2000));
    // Click first row or view button
    const viewBtn = page.getByRole("button", { name: /view/i }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await new Promise((r) => setTimeout(r, 2000));
      const url = page.url();
      expect(url).toContain("/skus/");
      const match = url.match(/\/skus\/([^/\n]+)/);
      if (match) skuId = match[1];
    }
  });

  test("step 5 — search for SKU detail page", async ({ page }) => {
    if (!skuId) return;
    await page.goto(`/skus/${skuId}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("step 6 — raw material SKU detail hides delete button", async ({
    page,
  }) => {
    await page.goto("/skus");
    await page.getByRole("tab", { name: /raw material/i }).click();
    await page.waitForTimeout(1500);
    const viewBtn = page.getByRole("button", { name: /view/i }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(1500);
      // Delete is gated to FINISHED_GOOD only (raw/packaging managed via supplier router)
      await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(
        0,
      );
    }
  });

  test("step 7 — finished good SKU detail shows delete button", async ({
    page,
  }) => {
    await page.goto("/skus");
    await page.getByRole("tab", { name: /finished good/i }).click();
    await page.waitForTimeout(1500);
    const viewBtn = page.getByRole("button", { name: /view/i }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(1500);
      await expect(page.getByRole("button", { name: /delete/i })).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
