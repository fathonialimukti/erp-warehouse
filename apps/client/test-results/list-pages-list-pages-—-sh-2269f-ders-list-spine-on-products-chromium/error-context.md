# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: list-pages.spec.ts >> list pages — shared spine >> renders list spine on products
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
      - generic [ref=e101]:
        - generic [ref=e103]:
          - generic [ref=e104]:
            - heading "Products" [level=1] [ref=e105]
            - paragraph [ref=e106]: Manage finished goods products.
          - generic [ref=e107]:
            - group [ref=e110]:
              - img
              - searchbox "Search product name, code, description" [ref=e111]
              - button "Close":
                - img
            - button "Add Product" [ref=e112] [cursor=pointer]:
              - img
              - text: Add Product
        - generic [ref=e114]:
          - grid "Product table" [ref=e116]:
            - rowgroup [ref=e117]:
              - row "Code Name Base Unit Packaging Created" [ref=e118]:
                - columnheader "Code" [ref=e119]:
                  - generic [ref=e120]: Code
                - columnheader "Name" [ref=e121]:
                  - generic [ref=e122]: Name
                - columnheader "Base Unit" [ref=e123]:
                  - generic [ref=e124]: Base Unit
                - columnheader "Packaging" [ref=e125]:
                  - generic [ref=e126]: Packaging
                - columnheader "Created" [ref=e127]:
                  - generic [ref=e128]: Created
                - columnheader [ref=e129]
            - rowgroup [ref=e130]:
              - row "FG-RICE-5KG" [ref=e131] [cursor=pointer]:
                - rowheader "FG-RICE-5KG" [ref=e132]
                - gridcell "Premium White Rice 5kg" [ref=e133]:
                  - paragraph [ref=e135]: Premium White Rice 5kg
                - gridcell "kg" [ref=e136]
                - gridcell "160 sack × 5 kg" [ref=e137]:
                  - generic [ref=e138]: 160 sack × 5 kg
                - gridcell "14/7/2026" [ref=e139]
                - gridcell "Actions" [ref=e140]:
                  - button "Actions" [ref=e141]:
                    - button "Actions" [ref=e142]:
                      - img
              - row "FG-RICE-10KG" [ref=e143] [cursor=pointer]:
                - rowheader "FG-RICE-10KG" [ref=e144]
                - gridcell "Premium White Rice 10kg" [ref=e145]:
                  - paragraph [ref=e147]: Premium White Rice 10kg
                - gridcell "kg" [ref=e148]
                - gridcell "80 sack × 10 kg" [ref=e149]:
                  - generic [ref=e150]: 80 sack × 10 kg
                - gridcell "14/7/2026" [ref=e151]
                - gridcell "Actions" [ref=e152]:
                  - button "Actions" [ref=e153]:
                    - button "Actions" [ref=e154]:
                      - img
              - row "FG-OIL-1L" [ref=e155] [cursor=pointer]:
                - rowheader "FG-OIL-1L" [ref=e156]
                - gridcell "Refined Cooking Oil 1L" [ref=e157]:
                  - paragraph [ref=e159]: Refined Cooking Oil 1L
                - gridcell "liter" [ref=e160]
                - gridcell "60 carton × 12 liter" [ref=e161]:
                  - generic [ref=e162]: 60 carton × 12 liter
                - gridcell "14/7/2026" [ref=e163]
                - gridcell "Actions" [ref=e164]:
                  - button "Actions" [ref=e165]:
                    - button "Actions" [ref=e166]:
                      - img
              - row "FG-OIL-2L" [ref=e167] [cursor=pointer]:
                - rowheader "FG-OIL-2L" [ref=e168]
                - gridcell "Refined Cooking Oil 2L" [ref=e169]:
                  - paragraph [ref=e171]: Refined Cooking Oil 2L
                - gridcell "liter" [ref=e172]
                - gridcell "48 carton × 12 liter" [ref=e173]:
                  - generic [ref=e174]: 48 carton × 12 liter
                - gridcell "14/7/2026" [ref=e175]
                - gridcell "Actions" [ref=e176]:
                  - button "Actions" [ref=e177]:
                    - button "Actions" [ref=e178]:
                      - img
              - row "FG-SUGAR-1KG" [ref=e179] [cursor=pointer]:
                - rowheader "FG-SUGAR-1KG" [ref=e180]
                - gridcell "Refined White Sugar 1kg" [ref=e181]:
                  - paragraph [ref=e183]: Refined White Sugar 1kg
                - gridcell "kg" [ref=e184]
                - gridcell "50 carton × 20 kg" [ref=e185]:
                  - generic [ref=e186]: 50 carton × 20 kg
                - gridcell "14/7/2026" [ref=e187]
                - gridcell "Actions" [ref=e188]:
                  - button "Actions" [ref=e189]:
                    - button "Actions" [ref=e190]:
                      - img
              - row "FG-COOK-01" [ref=e191] [cursor=pointer]:
                - rowheader "FG-COOK-01" [ref=e192]
                - gridcell "Premium Cooking Pack" [ref=e193]:
                  - paragraph [ref=e195]: Premium Cooking Pack
                - gridcell "pcs" [ref=e196]
                - gridcell "48 carton × 1 pcs" [ref=e197]:
                  - generic [ref=e198]: 48 carton × 1 pcs
                - gridcell "14/7/2026" [ref=e199]
                - gridcell "Actions" [ref=e200]:
                  - button "Actions" [ref=e201]:
                    - button "Actions" [ref=e202]:
                      - img
          - navigation "pagination" [ref=e204]:
            - generic [ref=e205]: 1 to 6 of 6 results
            - list [ref=e206]:
              - listitem [ref=e207]:
                - button "Prev" [disabled]:
                  - generic:
                    - img
                  - text: Prev
              - listitem [ref=e208]:
                - button "1" [ref=e209] [cursor=pointer]
              - listitem [ref=e210]:
                - button "Next" [disabled]:
                  - text: Next
                  - generic:
                    - img
  - button [ref=e213] [cursor=pointer]:
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