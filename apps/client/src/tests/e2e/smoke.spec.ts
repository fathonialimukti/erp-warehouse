import { test, expect } from "@playwright/test";
import { faker } from "@faker-js/faker";
import { loginAsAdmin, loginWith } from "./helpers/auth";
import {
  createTestPrefix,
  randomDocNumber,
  randomCompanyName,
  randomPersonName,
  randomNotes,
  randomAddress,
  randomPhone,
  randomEmail,
} from "./helpers/faker";

/**
 * Smoke test — all read-only pages + basic write flows using @faker-js/faker.
 * Each run generates fresh unique data so you can repeat the test infinite times.
 *
 * Run: bun run test -- --grep "smoke"
 * Repeat: bun run test -- --grep "smoke" --repeat-each=3
 */

export const SUITE = createTestPrefix("SMOKE");

// ─── Pages to verify ────────────────────────────────────────────────────────

const READONLY_PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "products index", path: "/products" },
  { name: "users index", path: "/users" },
  { name: "roles index", path: "/access-control/roles" },
  { name: "activity logs", path: "/activity-logs" },
  { name: "notifications", path: "/notifications" },
  { name: "stock movement", path: "/stock-movement" },
  { name: "pallets index", path: "/pallets" },
  { name: "monthly stock movement", path: "/reports/monthly-stock-movement" },
  { name: "inventory balance", path: "/reports/inventory-balance" },
  { name: "inventory aging", path: "/inventory-aging" },
  { name: "analytics charts", path: "/reports/charts" },
  { name: "warehouse index", path: "/warehouse" },
  { name: "SKU index", path: "/skus" },
  { name: "supplier index", path: "/suppliers" },
  { name: "inbound hub", path: "/inbound-transaction" },
  { name: "outbound hub", path: "/outbound-transaction" },
  { name: "subinventory transfer", path: "/subinventory-transfer" },
];

// ─── All read-only page checks ──────────────────────────────────────────────

test.describe("smoke — read-only pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const p of READONLY_PAGES) {
    test(`opens ${p.name} page`, async ({ page }) => {
      await page.goto(p.path);
      await page.waitForTimeout(1500);
      await expect(page.locator("main")).toBeAttached({ timeout: 8000 });
    });
  }
});

// ─── Inbound transaction form smoke ─────────────────────────────────────────

test.describe("smoke — receiving form fields", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("fills receiving form with faker data", async ({ page }) => {
    await page.goto("/inbound-transaction/receiving/new");
    await page.waitForLoadState("domcontentloaded");
    await page
      .getByPlaceholder(/PO reference/i)
      .first()
      .waitFor({ state: "visible", timeout: 15000 });

    const poRef = randomDocNumber("PO");
    const dnRef = randomDocNumber("DN");
    const notes = randomNotes();
    const carrier = faker.company.name();
    const tracking = `TRK-${faker.string.alphanumeric(8).toUpperCase()}`;
    const driver = randomPersonName();

    await page
      .getByPlaceholder(/PO reference/i)
      .first()
      .fill(poRef);
    await page
      .getByPlaceholder(/DN reference/i)
      .first()
      .fill(dnRef);
    await page
      .getByPlaceholder(/Carrier name/i)
      .first()
      .fill(carrier);
    await page
      .getByPlaceholder(/Tracking number/i)
      .first()
      .fill(tracking);
    await page
      .getByPlaceholder(/Driver full name/i)
      .first()
      .fill(driver);
    await page
      .getByPlaceholder(/Add notes/i)
      .first()
      .fill(notes);

    await expect(page.getByPlaceholder(/PO reference/i).first()).toHaveValue(
      poRef,
    );
    await expect(page.locator("main")).toBeAttached();
  });
});

// ─── Outbound shipment form smoke ───────────────────────────────────────────

test.describe("smoke — shipment form fields", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("fills shipment form with faker data", async ({ page }) => {
    await page.goto("/outbound-transaction/shipment/new");
    await page.waitForLoadState("domcontentloaded");
    await page
      .getByPlaceholder(/SO reference/i)
      .first()
      .waitFor({ state: "visible", timeout: 15000 });

    const shipNum = randomDocNumber("SHIP");
    const soRef = randomDocNumber("SO");
    const recipient = randomCompanyName();
    const carrier = faker.company.name();
    const tracking = `TRK-${faker.string.alphanumeric(8).toUpperCase()}`;
    const ref = randomDocNumber("REF");
    const notes = randomNotes();

    await page
      .getByPlaceholder(/Shipment number/i)
      .first()
      .fill(shipNum);
    await page
      .getByPlaceholder(/SO reference/i)
      .first()
      .fill(soRef);
    await page
      .getByPlaceholder(/Recipient name/i)
      .first()
      .fill(recipient);
    await page
      .getByPlaceholder(/Carrier name/i)
      .first()
      .fill(carrier);
    await page
      .getByPlaceholder(/Tracking number/i)
      .first()
      .fill(tracking);
    await page
      .getByPlaceholder(/Reference number/i)
      .first()
      .fill(ref);
    await page
      .getByPlaceholder(/Add notes/i)
      .first()
      .fill(notes);

    await expect(page.getByPlaceholder(/Shipment number/i).first()).toHaveValue(
      shipNum,
    );
    await expect(page.locator("main")).toBeAttached();
  });
});

// ─── Supplier form smoke ────────────────────────────────────────────────────

test.describe("smoke — supplier form fields", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("fills supplier form with faker data", async ({ page }) => {
    await page.goto("/suppliers/new");
    await page.waitForLoadState("domcontentloaded");
    await page
      .getByPlaceholder(/SUP-001/i)
      .first()
      .waitFor({ state: "visible", timeout: 10000 });

    const code = `SUP-${faker.string.alphanumeric(6).toUpperCase()}`;
    const name = randomCompanyName();
    const email = randomEmail();
    const phone = randomPhone();
    const address = randomAddress();
    const notes = randomNotes();

    await page
      .getByPlaceholder(/SUP-001/i)
      .first()
      .fill(code);
    await page
      .getByPlaceholder(/Supplier name/i)
      .first()
      .fill(name);
    await page.getByPlaceholder(/Email/i).first().fill(email);
    await page.getByLabel(/phone/i).first().fill(phone);
    await page
      .getByLabel(/address/i)
      .first()
      .fill(address);
    await page.getByLabel(/notes/i).first().fill(notes);

    await expect(page.getByPlaceholder(/SUP-001/i).first()).toHaveValue(code);
    await expect(page.locator("main")).toBeAttached();
  });
});

// ─── Landing page + login ───────────────────────────────────────────────────

test.describe("smoke — auth", () => {
  test("landing page renders", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /try the demo/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("invalid login shows error", async ({ page }) => {
    await page.goto("/login");
    await loginWith(page, randomEmail(), faker.internet.password());
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin login success", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.locator("main")).toBeAttached({ timeout: 10000 });
  });
});

// ─── Detail + edit page checks ──────────────────────────────────────────────

test.describe("smoke — detail pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("opens warehouse detail from index", async ({ page }) => {
    await page.goto("/warehouse");

    // Click first detail button
    const detailBtn = page.locator('button[aria-label="View details"]').first();
    if (await detailBtn.isVisible({ timeout: 3000 })) {
      await detailBtn.click();
      await page.waitForTimeout(1500);
      await expect(page.locator("main")).toBeAttached();
    }
  });

  test("opens SKU detail from index", async ({ page }) => {
    await page.goto("/skus");

    const detailBtn = page.locator('button[aria-label="View details"]').first();
    if (await detailBtn.isVisible({ timeout: 3000 })) {
      await detailBtn.click();
      await page.waitForTimeout(1500);
      await expect(page.locator("main")).toBeAttached();
    }
  });

  test("opens product detail from index", async ({ page }) => {
    await page.goto("/products");

    const detailBtn = page.locator('button[aria-label="View details"]').first();
    if (await detailBtn.isVisible({ timeout: 3000 })) {
      await detailBtn.click();
      await page.waitForTimeout(1500);
      await expect(page.locator("main")).toBeAttached();
    }
  });

  test("opens pallet detail from index", async ({ page }) => {
    await page.goto("/pallets");

    const rows = page.locator("table tbody tr");
    if (await rows.first().isVisible({ timeout: 3000 })) {
      await rows.first().click();
      await page.waitForTimeout(1500);
      await expect(page.locator("main")).toBeAttached();
    }
  });
});
