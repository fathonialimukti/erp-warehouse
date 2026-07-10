import { test, expect } from '@playwright/test';

const READONLY_PAGES = [
  { name: 'products index', path: '/products' },
  { name: 'users index', path: '/users' },
  { name: 'roles index', path: '/access-control/roles' },
  { name: 'activity logs', path: '/activity-logs' },
  { name: 'notifications', path: '/notifications' },
  { name: 'stock movement', path: '/stock-movement' },
  { name: 'pallets index', path: '/pallets' },
  { name: 'monthly stock movement', path: '/reports/monthly-stock-movement' },
  { name: 'inventory balance', path: '/reports/inventory-balance' },
];

test.describe('read-only pages', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@mail.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  for (const p of READONLY_PAGES) {
    test(`opens ${p.name} page`, async ({ page }) => {
      await page.goto(p.path);
      await page.waitForTimeout(2000);
      await expect(page.locator('main')).toBeAttached({ timeout: 5000 });
    });
  }
});