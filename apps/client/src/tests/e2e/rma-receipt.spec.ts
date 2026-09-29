import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("rma receipt", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("opens rma receipt create form", async ({ page }) => {
    await page.goto("/inbound-transaction/rma-receipt/new");
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    await expect(page.locator("main")).toBeAttached({ timeout: 15000 });
  });
});
