import { test, expect } from '@playwright/test';

test.describe('wip completion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@mail.com');
    await page.getByRole('textbox', { name: /password/i }).fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('main')).toBeAttached({ timeout: 10000 });
  });

  test('opens wip completion create form', async ({ page }) => {
    await page.goto('/inbound-transaction/wip-completion/new');
    await page.waitForLoadState('load');
    await page.waitForTimeout(800);
    await expect(page.locator('main')).toBeAttached({ timeout: 15000 });
  });
});