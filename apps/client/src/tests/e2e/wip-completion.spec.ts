import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("wip completion", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("opens wip completion create form", async ({ page }) => {
    await page.goto("/inbound-transaction/wip-completion/new");
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    await expect(page.locator("main")).toBeAttached({ timeout: 15000 });
  });
});
