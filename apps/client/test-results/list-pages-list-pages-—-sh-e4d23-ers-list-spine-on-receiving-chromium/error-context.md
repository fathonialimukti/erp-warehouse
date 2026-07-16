# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: list-pages.spec.ts >> list pages — shared spine >> renders list spine on receiving
- Location: src/tests/e2e/list-pages.spec.ts:57:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e7]:
    - generic [ref=e8]:
      - button "Toggle sidebar" [ref=e9] [cursor=pointer]:
        - img
      - paragraph [ref=e10]: Warehouse ERP
    - generic [ref=e11]:
      - generic [ref=e12]:
        - button "EN Language" [ref=e13] [cursor=pointer]:
          - generic [ref=e14]: EN
          - img [ref=e15]
        - combobox [ref=e19]
      - button "Notifications" [ref=e21] [cursor=pointer]:
        - img
      - button "Theme" [ref=e22] [cursor=pointer]:
        - img
      - button "User menu" [ref=e23] [cursor=pointer]:
        - generic "User menu" [ref=e24]:
          - generic [ref=e26]: A
          - generic [ref=e27]:
            - paragraph [ref=e28]: Admin
            - paragraph [ref=e29]: System Admin
  - generic [ref=e30]:
    - complementary [ref=e31]:
      - generic [ref=e33]:
        - generic [ref=e35]: Menu
        - navigation [ref=e37]:
          - button "Dashboard" [ref=e38] [cursor=pointer]:
            - generic [ref=e39]:
              - img
            - text: Dashboard
          - heading "Access Control" [level=3] [ref=e42]:
            - button "Access Control" [ref=e43] [cursor=pointer]:
              - img [ref=e45]
              - text: Access Control
              - img [ref=e53]
          - button "Warehouses" [ref=e55] [cursor=pointer]:
            - generic [ref=e56]:
              - img
            - text: Warehouses
          - button "SKUs" [ref=e57] [cursor=pointer]:
            - generic [ref=e58]:
              - img
            - text: SKUs
          - button "Suppliers" [ref=e59] [cursor=pointer]:
            - generic [ref=e60]:
              - img
            - text: Suppliers
          - button "Products" [ref=e61] [cursor=pointer]:
            - generic [ref=e62]:
              - img
            - text: Products
          - button "Activity Logs" [ref=e63] [cursor=pointer]:
            - generic [ref=e64]:
              - img
            - text: Activity Logs
          - button "Notifications" [ref=e65] [cursor=pointer]:
            - generic [ref=e66]:
              - img:
                - generic: "3"
            - text: Notifications
          - button "Inbound Transactions" [ref=e67] [cursor=pointer]:
            - generic [ref=e68]:
              - img
            - text: Inbound Transactions
          - button "Outbound Transactions" [ref=e69] [cursor=pointer]:
            - generic [ref=e70]:
              - img
            - text: Outbound Transactions
          - button "Subinventory Transfer" [ref=e71] [cursor=pointer]:
            - generic [ref=e72]:
              - img
            - text: Subinventory Transfer
          - button "Pallets" [ref=e73] [cursor=pointer]:
            - generic [ref=e74]:
              - img
            - text: Pallets
          - button "Stock Movements" [ref=e75] [cursor=pointer]:
            - generic [ref=e76]:
              - img
            - text: Stock Movements
          - heading "Reports" [level=3] [ref=e79]:
            - button "Reports" [ref=e80] [cursor=pointer]:
              - img [ref=e82]
              - text: Reports
              - img [ref=e93]
          - button "Inventory Aging" [ref=e95] [cursor=pointer]:
            - generic [ref=e96]:
              - img
            - text: Inventory Aging
          - button "AI System Admin" [ref=e97] [cursor=pointer]:
            - generic [ref=e98]:
              - img
            - text: AI System Admin
    - main [ref=e99]:
      - generic [ref=e100]:
        - generic [ref=e102]:
          - paragraph [ref=e103]: "404"
          - heading "Page Not Found" [level=3] [ref=e104]
          - paragraph [ref=e105]: The page you are trying to access does not exist or has been moved.
        - generic [ref=e107]:
          - button "Go Back" [ref=e108] [cursor=pointer]
          - button "Go to Dashboard" [ref=e109] [cursor=pointer]
  - button [ref=e112] [cursor=pointer]:
    - img
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import { loginAsAdmin } from './helpers/auth';
  3   | 
  4   | /**
  5   |  * Shared-spine regression coverage for the `useListPage` + `<DataTable>`
  6   |  * consolidation. Every migrated index/sub-table page renders through the same
  7   |  * spine, so a single data-independent pass proves the spine still works per-page:
  8   |  * the table mounts, rows render (or the empty state shows), and the pagination
  9   |  * footer is present.
  10  |  *
  11  |  * Run: bun run test -- --grep "list pages"
  12  |  */
  13  | 
  14  | const LIST_ROUTES = [
  15  |   // Index pages
  16  |   { name: 'suppliers', path: '/suppliers' },
  17  |   { name: 'warehouses', path: '/warehouses' },
  18  |   { name: 'skus', path: '/skus' },
  19  |   { name: 'products', path: '/products' },
  20  |   { name: 'users', path: '/users' },
  21  |   { name: 'pallets', path: '/pallets' },
  22  |   { name: 'stock movement', path: '/stock-movement' },
  23  |   // Transaction sub-tables
  24  |   { name: 'receiving', path: '/inbound-transaction/receiving' },
  25  |   { name: 'wip completion', path: '/inbound-transaction/wip-completion' },
  26  |   { name: 'rma receipt', path: '/inbound-transaction/rma-receipt' },
  27  |   { name: 'found', path: '/inbound-transaction/found' },
  28  |   { name: 'shipment', path: '/outbound-transaction/shipment' },
  29  |   { name: 'disposal', path: '/outbound-transaction/disposal' },
  30  |   { name: 'loss', path: '/outbound-transaction/loss' },
  31  |   { name: 'return to supplier', path: '/outbound-transaction/return-to-supplier' },
  32  |   { name: 'wip issue', path: '/outbound-transaction/wip-issue' },
  33  |   { name: 'subinventory transfer', path: '/subinventory-transfer' },
  34  | ];
  35  | 
  36  | async function assertListSpine(page: Page): Promise<void> {
  37  |   // Table region mounts.
  38  |   await expect(page.getByRole('table')).toBeAttached({ timeout: 15000 });
  39  | 
  40  |   // Either rows rendered or the empty state is shown — data-independent.
  41  |   const rowCount = await page.getByRole('row').count();
  42  |   if (rowCount <= 1) {
  43  |     // 1 row = header only → empty state must be visible.
  44  |     await expect(page.getByText(/no .*found|empty/i).first()).toBeVisible({ timeout: 10000 });
  45  |   }
  46  | 
  47  |   // Pagination footer present.
  48  |   await expect(page.getByText(/of \d+ results/).first()).toBeAttached({ timeout: 10000 });
  49  | }
  50  | 
  51  | test.describe('list pages — shared spine', () => {
  52  |   test.beforeEach(async ({ page }) => {
  53  |     await loginAsAdmin(page);
  54  |   });
  55  | 
  56  |   for (const route of LIST_ROUTES) {
  57  |     test(`renders list spine on ${route.name}`, async ({ page }) => {
  58  |       await page.goto(route.path);
> 59  |       await page.waitForLoadState('networkidle');
      |                  ^ Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
  60  |       await assertListSpine(page);
  61  |     });
  62  |   }
  63  | });
  64  | 
  65  | test.describe('list pages — pagination regression', () => {
  66  |   test.beforeEach(async ({ page }) => {
  67  |     await loginAsAdmin(page);
  68  |   });
  69  | 
  70  |   test('stock movement advances to page 2 without resetting', async ({ page }) => {
  71  |     await page.goto('/stock-movement');
  72  |     await page.waitForLoadState('networkidle');
  73  |     await expect(page.getByRole('table')).toBeAttached({ timeout: 15000 });
  74  | 
  75  |     const summary = page.getByText(/of \d+ results/).first();
  76  |     await expect(summary).toBeAttached({ timeout: 10000 });
  77  | 
  78  |     // Capture the starting "X to Y" range.
  79  |     const before = (await summary.innerText()).trim();
  80  | 
  81  |     // Click the "Next" pagination link (guarded: only if enabled).
  82  |     const next = page.getByRole('link', { name: /next/i }).first();
  83  |     if (!(await next.isDisabled().catch(() => true))) {
  84  |       await next.click();
  85  |       await page.waitForLoadState('networkidle');
  86  |       const after = (await summary.innerText()).trim();
  87  |       // Range must change (page advanced) and not collapse back to page 1 start.
  88  |       expect(after).not.toEqual(before);
  89  |     }
  90  |   });
  91  | });
  92  | 
  93  | test.describe('list pages — search filter', () => {
  94  |   test.beforeEach(async ({ page }) => {
  95  |     await loginAsAdmin(page);
  96  |   });
  97  | 
  98  |   test('suppliers search updates results after debounce', async ({ page }) => {
  99  |     await page.goto('/suppliers');
  100 |     await page.waitForLoadState('networkidle');
  101 |     await expect(page.getByRole('table')).toBeAttached({ timeout: 15000 });
  102 | 
  103 |     const search = page.getByPlaceholder(/search/i).first();
  104 |     await expect(search).toBeVisible({ timeout: 5000 });
  105 | 
  106 |     // Nonsense query → empty state (guards debounced search path).
  107 |     await search.fill('zzzzzz-no-such-record-zzzzzz');
  108 |     await page.waitForTimeout(800); // debounce (300ms) + query settle
  109 |     await page.waitForLoadState('networkidle');
  110 |     await expect(page.getByText(/no .*found|empty/i).first()).toBeVisible({ timeout: 10000 });
  111 |   });
  112 | });
  113 | 
```