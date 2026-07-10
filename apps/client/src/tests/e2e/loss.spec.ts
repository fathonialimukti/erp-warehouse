import { test, expect } from '@playwright/test';

test.describe('loss', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@mail.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('main')).toBeAttached({ timeout: 10000 });
  });

  test('opens loss create form', async ({ page }) => {
    await page.goto('/outbound-transaction/loss/new');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toBeAttached({ timeout: 15000 });
  });
});