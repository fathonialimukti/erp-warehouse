import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('wip issue', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('opens wip issue create form', async ({ page }) => {
    await page.goto('/outbound-transaction/wip-issue/new');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main')).toBeAttached({ timeout: 15000 });
  });
});