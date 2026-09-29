import { Page, expect } from "@playwright/test";

/**
 * Shared auth helper for Playwright E2E tests.
 * Logs in as admin and waits for the main layout to render.
 *
 * The credential is the one the seeder creates
 * (`apps/server/src/prisma/seed/catalog/users.ts`): admin@aetherglo.com with
 * the shared DEMO_PASSWORD. CI seeds the E2E database with that same seeder
 * (`.github/workflows/e2e.yml`), so this user always exists.
 *
 * Two login-page details the specs previously tripped over:
 *  - the credential form sits behind a collapsed Disclosure ("Or continue with
 *    email & password"). The input is in the DOM from the start but hidden, so
 *    the open state has to be tested with `isVisible()`, not `count()`.
 *  - the `Label` wraps the whole `InputGroup`, so `getByLabel("Email")` resolves
 *    to two elements and throws in strict mode. Select the inputs by type.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await goToLogin(page);
  await openCredentialsForm(page);
  await page.locator('input[type="email"]').first().fill("admin@aetherglo.com");
  await page.locator('input[type="password"]').first().fill("password");
  await page
    .getByRole("button", { name: /sign in/i })
    .first()
    .click();
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await expect(page.locator("main")).toBeAttached({ timeout: 15000 });
}

/**
 * Specs call this from `beforeEach` on a fresh page and from tests that already
 * navigated. Send the page to /login unless a session is already active.
 */
async function goToLogin(page: Page): Promise<void> {
  if (page.url().includes("/login")) return;
  const inApp = await page
    .locator("main")
    .isVisible()
    .catch(() => false);
  if (!inApp) await page.goto("/login");
}

/** Expand the collapsed credentials form. A no-op once expanded. */
export async function openCredentialsForm(page: Page): Promise<void> {
  if (page.url() === "about:blank") await page.goto("/login");
  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible()) return;
  await page
    .getByRole("button", { name: /continue with email/i })
    .first()
    .click({ timeout: 15000 });
  await expect(emailInput).toBeVisible({ timeout: 15000 });
}

/** Same flow, arbitrary credentials (auth.spec.ts / smoke failure cases). */
export async function loginWith(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  if (page.url() === "about:blank") await page.goto("/login");
  await openCredentialsForm(page);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page
    .getByRole("button", { name: /sign in/i })
    .first()
    .click();
}
