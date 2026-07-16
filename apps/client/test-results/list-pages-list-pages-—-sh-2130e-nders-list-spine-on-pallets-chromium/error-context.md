# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: list-pages.spec.ts >> list pages — shared spine >> renders list spine on pallets
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
            - heading "Pallets" [level=1] [ref=e105]
            - paragraph [ref=e106]: View all pallets across warehouses. Pallets are the atomic inventory unit created when inbound transactions are approved.
          - tablist [ref=e108]:
            - tab "All" [selected] [ref=e109] [cursor=pointer]: All
            - tab "Available" [ref=e111] [cursor=pointer]
            - tab "Not Available" [ref=e112] [cursor=pointer]
          - group [ref=e116]:
            - img
            - searchbox "Search pallet number" [ref=e117]
            - button "Close":
              - img
        - generic [ref=e119]:
          - grid "Pallets table" [ref=e121]:
            - rowgroup [ref=e122]:
              - row "Pallet No. SKU Status Location Created" [ref=e123]:
                - columnheader "Pallet No." [ref=e124]:
                  - generic [ref=e125]: Pallet No.
                - columnheader "SKU" [ref=e126]:
                  - generic [ref=e127]: SKU
                - columnheader "Status" [ref=e128]:
                  - generic [ref=e129]: Status
                - columnheader "Location" [ref=e130]:
                  - generic [ref=e131]: Location
                - columnheader "Created" [ref=e132]:
                  - generic [ref=e133]: Created
            - rowgroup [ref=e134]:
              - row "2607210001 Premium Cooking Pack Premium Cooking Pack FG-COOK-01 AVAILABLE WH03/RACK/0060 Finished Goods Distribution Center 14/7/2026" [ref=e135] [cursor=pointer]:
                - gridcell "2607210001" [ref=e136]
                - gridcell "Premium Cooking Pack Premium Cooking Pack FG-COOK-01" [ref=e137]:
                  - generic [ref=e138]:
                    - generic "Premium Cooking Pack" [ref=e139]:
                      - img [ref=e140]
                    - generic [ref=e144]:
                      - paragraph [ref=e145]: Premium Cooking Pack
                      - paragraph [ref=e146]: FG-COOK-01
                - gridcell "AVAILABLE" [ref=e147]:
                  - generic [ref=e149]: AVAILABLE
                - gridcell "WH03/RACK/0060 Finished Goods Distribution Center" [ref=e150]:
                  - generic [ref=e151]:
                    - paragraph [ref=e152]: WH03/RACK/0060
                    - paragraph [ref=e153]: Finished Goods Distribution Center
                - gridcell "14/7/2026" [ref=e154]
              - row "2607040002 Retail Carton Box (6-pack) Retail Carton Box (6-pack) PM-CARTON-01 NOT_AVAILABLE - 14/7/2026" [ref=e155] [cursor=pointer]:
                - gridcell "2607040002" [ref=e156]
                - gridcell "Retail Carton Box (6-pack) Retail Carton Box (6-pack) PM-CARTON-01" [ref=e157]:
                  - generic [ref=e158]:
                    - generic "Retail Carton Box (6-pack)" [ref=e159]:
                      - img [ref=e160]
                    - generic [ref=e164]:
                      - paragraph [ref=e165]: Retail Carton Box (6-pack)
                      - paragraph [ref=e166]: PM-CARTON-01
                - gridcell "NOT_AVAILABLE" [ref=e167]:
                  - generic [ref=e169]: NOT_AVAILABLE
                - gridcell "-" [ref=e170]:
                  - paragraph [ref=e172]: "-"
                - gridcell "14/7/2026" [ref=e173]
              - row "2607040001 Retail Carton Box (6-pack) Retail Carton Box (6-pack) PM-CARTON-01 NOT_AVAILABLE - 14/7/2026" [ref=e174] [cursor=pointer]:
                - gridcell "2607040001" [ref=e175]
                - gridcell "Retail Carton Box (6-pack) Retail Carton Box (6-pack) PM-CARTON-01" [ref=e176]:
                  - generic [ref=e177]:
                    - generic "Retail Carton Box (6-pack)" [ref=e178]:
                      - img [ref=e179]
                    - generic [ref=e183]:
                      - paragraph [ref=e184]: Retail Carton Box (6-pack)
                      - paragraph [ref=e185]: PM-CARTON-01
                - gridcell "NOT_AVAILABLE" [ref=e186]:
                  - generic [ref=e188]: NOT_AVAILABLE
                - gridcell "-" [ref=e189]:
                  - paragraph [ref=e191]: "-"
                - gridcell "14/7/2026" [ref=e192]
              - row "2607060011 Premium Cooking Pack Premium Cooking Pack FG-COOK-01 AVAILABLE WH03/RACK/0056 Finished Goods Distribution Center 14/7/2026" [ref=e193] [cursor=pointer]:
                - gridcell "2607060011" [ref=e194]
                - gridcell "Premium Cooking Pack Premium Cooking Pack FG-COOK-01" [ref=e195]:
                  - generic [ref=e196]:
                    - generic "Premium Cooking Pack" [ref=e197]:
                      - img [ref=e198]
                    - generic [ref=e202]:
                      - paragraph [ref=e203]: Premium Cooking Pack
                      - paragraph [ref=e204]: FG-COOK-01
                - gridcell "AVAILABLE" [ref=e205]:
                  - generic [ref=e207]: AVAILABLE
                - gridcell "WH03/RACK/0056 Finished Goods Distribution Center" [ref=e208]:
                  - generic [ref=e209]:
                    - paragraph [ref=e210]: WH03/RACK/0056
                    - paragraph [ref=e211]: Finished Goods Distribution Center
                - gridcell "14/7/2026" [ref=e212]
              - row "2607060010 Premium Cooking Pack Premium Cooking Pack FG-COOK-01 NOT_AVAILABLE - 14/7/2026" [ref=e213] [cursor=pointer]:
                - gridcell "2607060010" [ref=e214]
                - gridcell "Premium Cooking Pack Premium Cooking Pack FG-COOK-01" [ref=e215]:
                  - generic [ref=e216]:
                    - generic "Premium Cooking Pack" [ref=e217]:
                      - img [ref=e218]
                    - generic [ref=e222]:
                      - paragraph [ref=e223]: Premium Cooking Pack
                      - paragraph [ref=e224]: FG-COOK-01
                - gridcell "NOT_AVAILABLE" [ref=e225]:
                  - generic [ref=e227]: NOT_AVAILABLE
                - gridcell "-" [ref=e228]:
                  - paragraph [ref=e230]: "-"
                - gridcell "14/7/2026" [ref=e231]
              - row "2607060009 Premium Cooking Pack Premium Cooking Pack FG-COOK-01 AVAILABLE WH03/RACK/0059 Finished Goods Distribution Center 14/7/2026" [ref=e232] [cursor=pointer]:
                - gridcell "2607060009" [ref=e233]
                - gridcell "Premium Cooking Pack Premium Cooking Pack FG-COOK-01" [ref=e234]:
                  - generic [ref=e235]:
                    - generic "Premium Cooking Pack" [ref=e236]:
                      - img [ref=e237]
                    - generic [ref=e241]:
                      - paragraph [ref=e242]: Premium Cooking Pack
                      - paragraph [ref=e243]: FG-COOK-01
                - gridcell "AVAILABLE" [ref=e244]:
                  - generic [ref=e246]: AVAILABLE
                - gridcell "WH03/RACK/0059 Finished Goods Distribution Center" [ref=e247]:
                  - generic [ref=e248]:
                    - paragraph [ref=e249]: WH03/RACK/0059
                    - paragraph [ref=e250]: Finished Goods Distribution Center
                - gridcell "14/7/2026" [ref=e251]
              - row "2607110009 Crude Palm Oil IBC 200L Crude Palm Oil IBC 200L RM-OIL-200 AVAILABLE WH03/RACK/0053 Finished Goods Distribution Center 14/7/2026" [ref=e252] [cursor=pointer]:
                - gridcell "2607110009" [ref=e253]
                - gridcell "Crude Palm Oil IBC 200L Crude Palm Oil IBC 200L RM-OIL-200" [ref=e254]:
                  - generic [ref=e255]:
                    - generic "Crude Palm Oil IBC 200L" [ref=e256]:
                      - img [ref=e257]
                    - generic [ref=e261]:
                      - paragraph [ref=e262]: Crude Palm Oil IBC 200L
                      - paragraph [ref=e263]: RM-OIL-200
                - gridcell "AVAILABLE" [ref=e264]:
                  - generic [ref=e266]: AVAILABLE
                - gridcell "WH03/RACK/0053 Finished Goods Distribution Center" [ref=e267]:
                  - generic [ref=e268]:
                    - paragraph [ref=e269]: WH03/RACK/0053
                    - paragraph [ref=e270]: Finished Goods Distribution Center
                - gridcell "14/7/2026" [ref=e271]
              - row "2607110008 Crude Palm Oil IBC 200L Crude Palm Oil IBC 200L RM-OIL-200 NOT_AVAILABLE - 14/7/2026" [ref=e272] [cursor=pointer]:
                - gridcell "2607110008" [ref=e273]
                - gridcell "Crude Palm Oil IBC 200L Crude Palm Oil IBC 200L RM-OIL-200" [ref=e274]:
                  - generic [ref=e275]:
                    - generic "Crude Palm Oil IBC 200L" [ref=e276]:
                      - img [ref=e277]
                    - generic [ref=e281]:
                      - paragraph [ref=e282]: Crude Palm Oil IBC 200L
                      - paragraph [ref=e283]: RM-OIL-200
                - gridcell "NOT_AVAILABLE" [ref=e284]:
                  - generic [ref=e286]: NOT_AVAILABLE
                - gridcell "-" [ref=e287]:
                  - paragraph [ref=e289]: "-"
                - gridcell "14/7/2026" [ref=e290]
              - row "2607110007 Crude Palm Oil IBC 200L Crude Palm Oil IBC 200L RM-OIL-200 NOT_AVAILABLE - 14/7/2026" [ref=e291] [cursor=pointer]:
                - gridcell "2607110007" [ref=e292]
                - gridcell "Crude Palm Oil IBC 200L Crude Palm Oil IBC 200L RM-OIL-200" [ref=e293]:
                  - generic [ref=e294]:
                    - generic "Crude Palm Oil IBC 200L" [ref=e295]:
                      - img [ref=e296]
                    - generic [ref=e300]:
                      - paragraph [ref=e301]: Crude Palm Oil IBC 200L
                      - paragraph [ref=e302]: RM-OIL-200
                - gridcell "NOT_AVAILABLE" [ref=e303]:
                  - generic [ref=e305]: NOT_AVAILABLE
                - gridcell "-" [ref=e306]:
                  - paragraph [ref=e308]: "-"
                - gridcell "14/7/2026" [ref=e309]
              - row "2607110006 Oil Label Sheet (roll) Oil Label Sheet (roll) PM-LABEL-OIL NOT_AVAILABLE - 14/7/2026" [ref=e310] [cursor=pointer]:
                - gridcell "2607110006" [ref=e311]
                - gridcell "Oil Label Sheet (roll) Oil Label Sheet (roll) PM-LABEL-OIL" [ref=e312]:
                  - generic [ref=e313]:
                    - generic "Oil Label Sheet (roll)" [ref=e314]:
                      - img [ref=e315]
                    - generic [ref=e319]:
                      - paragraph [ref=e320]: Oil Label Sheet (roll)
                      - paragraph [ref=e321]: PM-LABEL-OIL
                - gridcell "NOT_AVAILABLE" [ref=e322]:
                  - generic [ref=e324]: NOT_AVAILABLE
                - gridcell "-" [ref=e325]:
                  - paragraph [ref=e327]: "-"
                - gridcell "14/7/2026" [ref=e328]
          - navigation "pagination" [ref=e330]:
            - generic [ref=e331]: 1 to 10 of 170 results
            - list [ref=e332]:
              - listitem [ref=e333]:
                - button "Prev" [disabled]:
                  - generic:
                    - img
                  - text: Prev
              - listitem [ref=e334]:
                - button "1" [ref=e335] [cursor=pointer]
              - listitem [ref=e336]:
                - button "2" [ref=e337] [cursor=pointer]
              - listitem [ref=e338]:
                - button "3" [ref=e339] [cursor=pointer]
              - listitem [ref=e340]:
                - button "4" [ref=e341] [cursor=pointer]
              - listitem [ref=e342]:
                - button "5" [ref=e343] [cursor=pointer]
              - listitem [ref=e344]:
                - button "6" [ref=e345] [cursor=pointer]
              - listitem [ref=e346]:
                - button "7" [ref=e347] [cursor=pointer]
              - listitem [ref=e348]:
                - button "8" [ref=e349] [cursor=pointer]
              - listitem [ref=e350]:
                - button "9" [ref=e351] [cursor=pointer]
              - listitem [ref=e352]:
                - button "10" [ref=e353] [cursor=pointer]
              - listitem [ref=e354]:
                - button "11" [ref=e355] [cursor=pointer]
              - listitem [ref=e356]:
                - button "12" [ref=e357] [cursor=pointer]
              - listitem [ref=e358]:
                - button "13" [ref=e359] [cursor=pointer]
              - listitem [ref=e360]:
                - button "14" [ref=e361] [cursor=pointer]
              - listitem [ref=e362]:
                - button "15" [ref=e363] [cursor=pointer]
              - listitem [ref=e364]:
                - button "16" [ref=e365] [cursor=pointer]
              - listitem [ref=e366]:
                - button "17" [ref=e367] [cursor=pointer]
              - listitem [ref=e368]:
                - button "Next" [ref=e369] [cursor=pointer]:
                  - text: Next
                  - img [ref=e371]
  - button [ref=e375] [cursor=pointer]:
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