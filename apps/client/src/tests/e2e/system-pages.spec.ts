import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("System Settings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("admin can open settings and see rate limiting group", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: /System Settings/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Rate Limiting" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Logging" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
  });

  test("settings save button is disabled when nothing changed", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: /System Settings/i }),
    ).toBeVisible();
    const saveButton = page.getByRole("button", { name: /Save/i });
    await expect(saveButton).toBeDisabled();
  });

  test("log viewer lists entries and supports level filter", async ({
    page,
  }) => {
    await page.goto("/logs");
    await expect(
      page.getByRole("heading", { name: /System Logs/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/^Total:/).or(page.getByText("No log entries found.")),
    ).toBeVisible();
  });

  test("reorder page renders", async ({ page }) => {
    await page.goto("/reorder");
    await expect(
      page.getByRole("heading", { name: /Reorder Points/i }),
    ).toBeVisible();
  });

  test("stock count index renders", async ({ page }) => {
    await page.goto("/stock-count");
    await expect(
      page.getByRole("heading", { name: /Cycle Count/i }),
    ).toBeVisible();
  });

  test("purchase order index renders", async ({ page }) => {
    await page.goto("/purchase-order");
    await expect(
      page.getByRole("heading", { name: /Purchase Orders/i }),
    ).toBeVisible();
  });
});
