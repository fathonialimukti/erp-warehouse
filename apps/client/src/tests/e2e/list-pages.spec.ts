import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

/**
 * Shared-spine regression coverage for the `useListPage` + `<DataTable>`
 * consolidation. Every migrated index/sub-table page renders through the same
 * spine, so a single data-independent pass proves the spine still works per-page:
 * the table mounts, rows render (or the empty state shows), and the pagination
 * footer is present.
 *
 * Run: bun run test -- --grep "list pages"
 */

const LIST_ROUTES = [
  // Index pages
  { name: "suppliers", path: "/suppliers" },
  { name: "warehouses", path: "/warehouse" },
  { name: "skus", path: "/skus" },
  { name: "products", path: "/products" },
  { name: "users", path: "/users" },
  { name: "pallets", path: "/pallets" },
  { name: "stock movement", path: "/stock-movement" },
  // Transaction sub-tables live in tabbed index pages (?tab= selects the type)
  { name: "receiving", path: "/inbound-transaction?tab=receiving" },
  { name: "wip completion", path: "/inbound-transaction?tab=wip-completion" },
  { name: "rma receipt", path: "/inbound-transaction?tab=rma-receipt" },
  { name: "found", path: "/inbound-transaction?tab=found" },
  { name: "shipment", path: "/outbound-transaction?tab=shipment" },
  { name: "disposal", path: "/outbound-transaction?tab=disposal" },
  { name: "loss", path: "/outbound-transaction?tab=loss" },
  {
    name: "return to supplier",
    path: "/outbound-transaction?tab=return-to-supplier",
  },
  { name: "wip issue", path: "/outbound-transaction?tab=wip-issue" },
  { name: "subinventory transfer", path: "/subinventory-transfer" },
];

async function assertListSpine(page: Page): Promise<void> {
  // Table region mounts.
  await expect(page.locator('[data-slot="table"]')).toBeAttached({
    timeout: 15000,
  });

  // Either rows rendered or the empty state is shown — data-independent.
  const rowCount = await page.getByRole("row").count();
  if (rowCount <= 1) {
    // 1 row = header only → empty state must be visible.
    await expect(
      page.getByText(/no .*found|no .*available|empty/i).first(),
    ).toBeVisible({ timeout: 10000 });
  }

  // Pagination footer present.
  await expect(page.getByText(/of \d+ results/).first()).toBeAttached({
    timeout: 10000,
  });
}

test.describe("list pages — shared spine", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const route of LIST_ROUTES) {
    test(`renders list spine on ${route.name}`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(800);
      await assertListSpine(page);
    });
  }
});

test.describe("list pages — pagination regression", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("stock movement advances to page 2 without resetting", async ({
    page,
  }) => {
    await page.goto("/stock-movement");
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    await expect(page.locator('[data-slot="table"]')).toBeAttached({
      timeout: 15000,
    });

    const summary = page.getByText(/of \d+ results/).first();
    await expect(summary).toBeAttached({ timeout: 10000 });

    // Capture the starting "X to Y" range.
    const before = (await summary.innerText()).trim();

    // Click the "Next" pagination link (guarded: only if enabled).
    const next = page.getByRole("link", { name: /next/i }).first();
    if (!(await next.isDisabled().catch(() => true))) {
      await next.click();
      await page.waitForLoadState("load");
      await page.waitForTimeout(800);
      const after = (await summary.innerText()).trim();
      // Range must change (page advanced) and not collapse back to page 1 start.
      expect(after).not.toEqual(before);
    }
  });
});

test.describe("list pages — search filter", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("suppliers search updates results after debounce", async ({ page }) => {
    await page.goto("/suppliers");
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    await expect(page.locator('[data-slot="table"]')).toBeAttached({
      timeout: 15000,
    });

    const search = page.getByPlaceholder(/search/i).first();
    await expect(search).toBeVisible({ timeout: 5000 });

    // Nonsense query → empty state (guards debounced search path).
    await search.fill("zzzzzz-no-such-record-zzzzzz");
    await page.waitForTimeout(800); // debounce (300ms) + query settle
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    await expect(
      page.getByText(/no .*found|no .*available|empty/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
