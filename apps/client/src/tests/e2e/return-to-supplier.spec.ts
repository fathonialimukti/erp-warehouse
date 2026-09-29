import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("return to supplier", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("opens return to supplier create form", async ({ page }) => {
    await page.goto("/outbound-transaction/return-to-supplier/new");
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    await expect(page.locator("main")).toBeAttached({ timeout: 15000 });
  });
});
