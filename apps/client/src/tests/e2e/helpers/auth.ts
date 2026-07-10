import { Page, expect } from '@playwright/test';

/**
 * Shared auth helper for Playwright E2E tests.
 * Logs in as admin and waits for the main layout to render.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@mail.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await expect(page.locator('main')).toBeAttached({ timeout: 10000 });
}