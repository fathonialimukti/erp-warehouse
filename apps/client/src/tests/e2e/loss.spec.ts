import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("loss", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("opens loss create form", async ({ page }) => {
    await page.goto("/outbound-transaction/loss/new");
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    await expect(page.locator("main")).toBeAttached({ timeout: 15000 });
  });
});
