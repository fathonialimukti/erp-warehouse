import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginWith, openCredentialsForm } from "./helpers/auth";

/**
 * The credential form is collapsed behind a Disclosure on the login page and
 * its Label wraps an InputGroup, so `getByLabel("Email")` resolves to two
 * elements. Select the inputs by type; see helpers/auth.ts.
 */
test.describe("auth", () => {
  test("landing page renders with Try the Demo button", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /try the demo/i }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("navigates to login and fills fields", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /try the demo/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login/);
    await openCredentialsForm(page);
    await expect(page.locator('input[type="email"]')).toBeAttached();
    await expect(page.locator('input[type="password"]')).toBeAttached();
    await expect(
      page.getByRole("button", { name: /sign in/i }).first(),
    ).toBeVisible();
  });

  test("fails with invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await loginWith(page, "wrong@wrong.com", "wrong");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin logs in and sees main layout", async ({ page }) => {
    await page.goto("/login");
    await loginAsAdmin(page);
  });
});
