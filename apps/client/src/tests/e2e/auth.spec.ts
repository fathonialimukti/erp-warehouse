import { test, expect } from '@playwright/test';

test.describe('auth', () => {
  test('landing page renders with Try the Demo button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /try the demo/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('navigates to login and fills fields', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /try the demo/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('fails with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('wrong@wrong.com');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('admin logs in and sees main layout', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@mail.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.locator('main')).toBeAttached({ timeout: 15000 });
  });
});