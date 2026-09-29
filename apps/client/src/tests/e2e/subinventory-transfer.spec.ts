import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("subinventory transfer", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("opens subinventory transfer index", async ({ page }) => {
    await page.goto("/subinventory-transfer");
    await expect(page.locator("main")).toBeAttached({ timeout: 5000 });
  });

  test("opens subinventory transfer create form", async ({ page }) => {
    await page.goto("/subinventory-transfer/new");
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    await expect(page.locator("main")).toBeAttached({ timeout: 15000 });
  });
});
