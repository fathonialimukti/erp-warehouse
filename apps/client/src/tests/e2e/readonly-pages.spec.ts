import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

const READONLY_PAGES = [
  { name: "products index", path: "/products" },
  { name: "users index", path: "/users" },
  { name: "roles index", path: "/access-control/roles" },
  { name: "activity logs", path: "/activity-logs" },
  { name: "notifications", path: "/notifications" },
  { name: "stock movement", path: "/stock-movement" },
  { name: "pallets index", path: "/pallets" },
  { name: "monthly stock movement", path: "/reports/monthly-stock-movement" },
  { name: "inventory balance", path: "/reports/inventory-balance" },
];

test.describe("read-only pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const p of READONLY_PAGES) {
    test(`opens ${p.name} page`, async ({ page }) => {
      await page.goto(p.path);
      await page.waitForTimeout(2000);
      await expect(page.locator("main")).toBeAttached({ timeout: 5000 });
    });
  }
});
