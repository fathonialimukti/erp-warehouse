# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: system-pages.spec.ts >> System Settings >> log viewer lists entries and supports level filter
- Location: src/tests/e2e/system-pages.spec.ts:24:2

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /System Logs/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "to.be.visible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /System Logs/i })

```

```yaml
- button "Toggle sidebar"
- paragraph: Warehouse ERP
- button "EN Language": EN
- button "Notifications"
- text: 9+
- button "Theme"
- button "User menu":
  - text: A
  - paragraph: Admin
  - paragraph: System Admin
- complementary:
  - text: Menu
  - navigation:
    - button "Dashboard":
      - img
      - text: Dashboard
    - heading "Access Control" [level=3]:
      - button "Access Control":
        - img
        - text: Access Control
    - button "Warehouses":
      - img
      - text: Warehouses
    - button "SKUs":
      - img
      - text: SKUs
    - button "Suppliers":
      - img
      - text: Suppliers
    - button "Products":
      - img
      - text: Products
    - button "Activity Logs":
      - img
      - text: Activity Logs
    - button "Notifications":
      - img: "3"
      - text: Notifications
    - button "Inbound Transactions":
      - img
      - text: Inbound Transactions
    - button "Outbound Transactions":
      - img
      - text: Outbound Transactions
    - button "Subinventory Transfer":
      - img
      - text: Subinventory Transfer
    - button "Pallets":
      - img
      - text: Pallets
    - button "Stock Movements":
      - img
      - text: Stock Movements
    - heading "Reports" [level=3]:
      - button "Reports":
        - img
        - text: Reports
    - button "Inventory Aging":
      - img
      - text: Inventory Aging
    - button "Knowledge Base":
      - img
      - text: Knowledge Base
    - button "AI System Admin":
      - img
      - text: AI System Admin
    - button "AI Analytics":
      - img
      - text: AI Analytics
- main:
  - paragraph: "404"
  - heading "Page Not Found" [level=3]
  - paragraph: The page you are trying to access does not exist or has been moved.
  - button "Go Back"
  - button "Go to Dashboard"
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  | import { loginAsAdmin } from './helpers/auth';
  3  | 
  4  | test.describe('System Settings', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await loginAsAdmin(page);
  7  |   });
  8  | 
  9  |   test('admin can open settings and see rate limiting group', async ({ page }) => {
  10 |     await page.goto('/settings');
  11 |     await expect(page.getByRole('heading', { name: /System Settings/i })).toBeVisible();
  12 |     await expect(page.getByRole('heading', { name: 'Rate Limiting' })).toBeVisible();
  13 |     await expect(page.getByRole('heading', { name: 'Logging' })).toBeVisible();
  14 |     await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();
  15 |   });
  16 | 
  17 |   test('settings save button is disabled when nothing changed', async ({ page }) => {
  18 |     await page.goto('/settings');
  19 |     await expect(page.getByRole('heading', { name: /System Settings/i })).toBeVisible();
  20 |     const saveButton = page.getByRole('button', { name: /Save Changes/i });
  21 |     await expect(saveButton).toBeDisabled();
  22 |   });
  23 | 
  24 |   test('log viewer lists entries and supports level filter', async ({ page }) => {
  25 |     await page.goto('/logs');
> 26 |     await expect(page.getByRole('heading', { name: /System Logs/i })).toBeVisible();
     |                                                                      ^ Error: expect(locator).toBeVisible() failed
  27 |     await expect(page.getByText(/^Total:/).or(page.getByText('No log entries found.'))).toBeVisible();
  28 |   });
  29 | 
  30 |   test('reorder page renders', async ({ page }) => {
  31 |     await page.goto('/reorder');
  32 |     await expect(page.getByRole('heading', { name: /Reorder Points/i })).toBeVisible();
  33 |   });
  34 | 
  35 |   test('stock count index renders', async ({ page }) => {
  36 |     await page.goto('/stock-count');
  37 |     await expect(page.getByRole('heading', { name: /Cycle Count/i })).toBeVisible();
  38 |   });
  39 | 
  40 |   test('purchase order index renders', async ({ page }) => {
  41 |     await page.goto('/purchase-order');
  42 |     await expect(page.getByRole('heading', { name: /Purchase Orders/i })).toBeVisible();
  43 |   });
  44 | });
  45 | 
```