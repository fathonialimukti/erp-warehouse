# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> smoke — receiving form fields >> fills receiving form with faker data
- Location: src/tests/e2e/smoke.spec.ts:71:3

# Error details

```
TimeoutError: locator.fill: Timeout 10000ms exceeded.
Call log:
  - waiting for getByPlaceholder(/Delivery note/i).first()

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
        - generic [ref=e101]:
          - heading "New Receiving Transaction" [level=1] [ref=e102]
          - group [ref=e104]:
            - button "Back" [ref=e105] [cursor=pointer]:
              - img
              - generic [ref=e106]: Back
        - generic [ref=e107]:
          - generic [ref=e108]:
            - generic [ref=e109]:
              - group "General Information" [ref=e110]:
                - generic [ref=e112]:
                  - img [ref=e113]
                  - text: General Information
                - generic [ref=e117]:
                  - generic [ref=e118]:
                    - generic [ref=e120]:
                      - text: Document Number
                      - button [ref=e121]:
                        - img [ref=e122]
                    - textbox "Document Number" [ref=e125]:
                      - /placeholder: Auto-generated if blank
                  - generic [ref=e126]:
                    - generic [ref=e127]: Date
                    - group "Date Date" [ref=e128]:
                      - spinbutton "month, Date, Date Date" [ref=e129]: "7"
                      - generic [ref=e130]: /
                      - spinbutton "day, Date, Date Date" [ref=e131]: "15"
                      - generic [ref=e132]: /
                      - spinbutton "year, Date, Date Date" [ref=e133]: "2026"
                      - button "Calendar Date Date" [ref=e135] [cursor=pointer]:
                        - img [ref=e137]
                  - textbox [ref=e140]: 2026-07-15
                  - generic [ref=e141]:
                    - generic [ref=e142]: Supplier
                    - button "Select supplier Supplier Supplier" [ref=e143] [cursor=pointer]:
                      - generic [ref=e144]: Select supplier
                      - img [ref=e145]
                    - combobox [ref=e149]
                  - generic [ref=e150]:
                    - generic [ref=e151]: Warehouse
                    - button "Select warehouse Warehouse Warehouse" [ref=e152] [cursor=pointer]:
                      - generic [ref=e153]: Select warehouse
                      - img [ref=e154]
                    - combobox [ref=e158]
                  - generic [ref=e159]:
                    - generic [ref=e161]:
                      - text: Purchase Order Ref
                      - button [ref=e162]:
                        - img [ref=e163]
                    - textbox "Purchase Order Ref" [active] [ref=e166]:
                      - /placeholder: PO reference
                      - text: PO-20260715-STWSS4
                  - generic [ref=e167]:
                    - generic [ref=e169]:
                      - text: Delivery Note Ref
                      - button [ref=e170]:
                        - img [ref=e171]
                    - textbox "Delivery Note Ref" [ref=e174]:
                      - /placeholder: DN reference
              - group "Shipment & Driver" [ref=e175]:
                - generic [ref=e177]:
                  - img [ref=e178]
                  - text: Shipment & Driver
                - generic [ref=e184]:
                  - generic [ref=e185]:
                    - generic [ref=e186]: Carrier
                    - textbox "Carrier" [ref=e187]:
                      - /placeholder: Carrier name
                  - generic [ref=e188]:
                    - generic [ref=e189]: Tracking Number
                    - textbox "Tracking Number" [ref=e190]:
                      - /placeholder: Tracking number
                  - generic [ref=e191]:
                    - generic [ref=e192]: Driver Name
                    - textbox "Driver Name" [ref=e193]:
                      - /placeholder: Driver full name
                  - generic [ref=e194]:
                    - generic [ref=e195]: Driver Contact
                    - textbox "Driver Contact" [ref=e196]:
                      - /placeholder: Phone or email
                  - generic [ref=e197]:
                    - generic [ref=e198]: Vehicle Plate
                    - textbox "Vehicle Plate" [ref=e199]:
                      - /placeholder: Plate number
            - generic [ref=e200]:
              - generic [ref=e201]:
                - generic [ref=e202]:
                  - generic [ref=e203]:
                    - img [ref=e204]
                    - heading "Summary" [level=3] [ref=e207]
                  - paragraph [ref=e208]: Review your transaction before saving.
                - generic [ref=e210]:
                  - generic [ref=e211]:
                    - term [ref=e212]: Document Number
                    - definition [ref=e213]: Auto
                  - generic [ref=e214]:
                    - term [ref=e215]: Supplier
                    - definition [ref=e216]: —
                  - generic [ref=e217]:
                    - term [ref=e218]: Warehouse
                    - definition [ref=e219]: —
                  - separator [ref=e220]
                  - generic [ref=e221]:
                    - term [ref=e222]:
                      - img [ref=e223]
                      - text: Total Items
                    - definition [ref=e227]: "1"
                  - generic [ref=e228]:
                    - term [ref=e229]:
                      - img [ref=e230]
                      - text: Total Quantity
                    - definition [ref=e233]: "1"
                  - separator [ref=e234]
                  - generic [ref=e235]:
                    - term [ref=e236]: Ready to save
                    - definition [ref=e237]:
                      - generic [ref=e239]: …
              - group "Notes & Attachments" [ref=e240]:
                - generic [ref=e242]:
                  - img [ref=e243]
                  - text: Notes & Attachments
                - generic [ref=e246]:
                  - generic [ref=e247]:
                    - generic [ref=e248]: Notes
                    - textbox "Notes" [ref=e249]:
                      - /placeholder: Add notes or remarks
                  - generic [ref=e250]:
                    - text: Attachments
                    - button "Add Attachment" [ref=e251] [cursor=pointer]:
                      - img
                      - text: Add Attachment
          - generic [ref=e252]:
            - generic [ref=e254]:
              - generic [ref=e255]:
                - img [ref=e256]
                - generic [ref=e259]:
                  - paragraph [ref=e260]: Items
                  - paragraph [ref=e261]: Add items for this receiving transaction.
              - button "Add Item" [ref=e262] [cursor=pointer]:
                - img
                - text: Add Item
            - grid "Transaction items" [ref=e266]:
              - rowgroup [ref=e267]:
                - row "# SKU Details Qty" [ref=e268]:
                  - columnheader "#" [ref=e269]
                  - columnheader "SKU" [ref=e270]
                  - columnheader "Details" [ref=e271]
                  - columnheader "Qty" [ref=e272]
                  - columnheader [ref=e273]
              - rowgroup [ref=e274]:
                - row "1" [ref=e275]:
                  - rowheader "1" [ref=e276]
                  - gridcell "Select SKU SKU" [ref=e277]:
                    - generic [ref=e278]:
                      - button "Select SKU SKU" [ref=e279] [cursor=pointer]:
                        - generic [ref=e280]: Select SKU
                        - img [ref=e281]
                      - combobox [ref=e285]
                  - gridcell [ref=e286]:
                    - textbox "Details" [ref=e288]:
                      - /placeholder: Item notes
                  - gridcell [ref=e289]:
                    - group [ref=e291]:
                      - button "Decrease Qty" [disabled]:
                        - img
                      - textbox "Qty" [ref=e292]: "1"
                      - button "Increase Qty" [ref=e293] [cursor=pointer]:
                        - img [ref=e294]
                  - gridcell "Move up Move down Remove" [ref=e296]:
                    - generic [ref=e297]:
                      - button "Move up" [disabled]:
                        - img
                      - button "Move down" [disabled]:
                        - img
                      - button "Remove" [ref=e298] [cursor=pointer]:
                        - img
          - generic [ref=e299]:
            - generic [ref=e300]:
              - generic [ref=e301]:
                - img [ref=e302]
                - generic [ref=e306]: "1"
                - text: Total Items
              - generic [ref=e307]:
                - img [ref=e308]
                - generic [ref=e311]: "1"
                - text: Total Quantity
              - generic [ref=e312]: Supplier, warehouse & items required
            - generic [ref=e313]:
              - button "Save Draft" [disabled]:
                - img
                - text: Save Draft
              - button "Propose" [disabled]:
                - img
                - text: Propose
  - button [ref=e316] [cursor=pointer]:
    - img
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { faker } from '@faker-js/faker';
  3   | import { loginAsAdmin } from './helpers/auth';
  4   | import {
  5   |   createTestPrefix,
  6   |   randomDocNumber,
  7   |   randomCompanyName,
  8   |   randomPersonName,
  9   |   randomNotes,
  10  |   randomAddress,
  11  |   randomPhone,
  12  |   randomEmail,
  13  | } from './helpers/faker';
  14  | 
  15  | /**
  16  |  * Smoke test — all read-only pages + basic write flows using @faker-js/faker.
  17  |  * Each run generates fresh unique data so you can repeat the test infinite times.
  18  |  *
  19  |  * Run: bun run test -- --grep "smoke"
  20  |  * Repeat: bun run test -- --grep "smoke" --repeat-each=3
  21  |  */
  22  | 
  23  | const SUITE = createTestPrefix('SMOKE');
  24  | 
  25  | // ─── Pages to verify ────────────────────────────────────────────────────────
  26  | 
  27  | const READONLY_PAGES = [
  28  |   { name: 'dashboard', path: '/dashboard' },
  29  |   { name: 'products index', path: '/products' },
  30  |   { name: 'users index', path: '/users' },
  31  |   { name: 'roles index', path: '/access-control/roles' },
  32  |   { name: 'activity logs', path: '/activity-logs' },
  33  |   { name: 'notifications', path: '/notifications' },
  34  |   { name: 'stock movement', path: '/stock-movement' },
  35  |   { name: 'pallets index', path: '/pallets' },
  36  |   { name: 'monthly stock movement', path: '/reports/monthly-stock-movement' },
  37  |   { name: 'inventory balance', path: '/reports/inventory-balance' },
  38  |   { name: 'inventory aging', path: '/inventory-aging' },
  39  |   { name: 'analytics charts', path: '/reports/charts' },
  40  |   { name: 'warehouse index', path: '/warehouse' },
  41  |   { name: 'SKU index', path: '/skus' },
  42  |   { name: 'supplier index', path: '/suppliers' },
  43  |   { name: 'inbound hub', path: '/inbound-transaction' },
  44  |   { name: 'outbound hub', path: '/outbound-transaction' },
  45  |   { name: 'subinventory transfer', path: '/subinventory-transfer' },
  46  | ];
  47  | 
  48  | // ─── All read-only page checks ──────────────────────────────────────────────
  49  | 
  50  | test.describe('smoke — read-only pages', () => {
  51  |   test.beforeEach(async ({ page }) => {
  52  |     await loginAsAdmin(page);
  53  |   });
  54  | 
  55  |   for (const p of READONLY_PAGES) {
  56  |     test(`opens ${p.name} page`, async ({ page }) => {
  57  |       await page.goto(p.path);
  58  |       await page.waitForTimeout(1500);
  59  |       await expect(page.locator('main')).toBeAttached({ timeout: 8000 });
  60  |     });
  61  |   }
  62  | });
  63  | 
  64  | // ─── Inbound transaction form smoke ─────────────────────────────────────────
  65  | 
  66  | test.describe('smoke — receiving form fields', () => {
  67  |   test.beforeEach(async ({ page }) => {
  68  |     await loginAsAdmin(page);
  69  |   });
  70  | 
  71  |   test('fills receiving form with faker data', async ({ page }) => {
  72  |     await page.goto('/inbound-transaction/receiving/new');
  73  |     await page.waitForLoadState('domcontentloaded');
  74  |     await page.getByRole('button', { name: /select warehouse/i }).waitFor({ state: 'visible', timeout: 15000 });
  75  | 
  76  |     const poRef = randomDocNumber('PO');
  77  |     const dnRef = randomDocNumber('DN');
  78  |     const notes = randomNotes();
  79  |     const carrier = faker.company.name();
  80  |     const tracking = `TRK-${faker.string.alphanumeric(8).toUpperCase()}`;
  81  |     const driver = randomPersonName();
  82  | 
  83  |     await page.getByPlaceholder(/PO reference/i).first().fill(poRef);
> 84  |     await page.getByPlaceholder(/Delivery note/i).first().fill(dnRef);
      |                                                           ^ TimeoutError: locator.fill: Timeout 10000ms exceeded.
  85  |     await page.getByPlaceholder(/Carrier name/i).first().fill(carrier);
  86  |     await page.getByPlaceholder(/Tracking number/i).first().fill(tracking);
  87  |     await page.getByPlaceholder(/Driver name/i).first().fill(driver);
  88  |     await page.getByPlaceholder(/Add notes/i).first().fill(notes);
  89  | 
  90  |     await expect(page.getByPlaceholder(/PO reference/i).first()).toHaveValue(poRef);
  91  |     await expect(page.locator('main')).toBeAttached();
  92  |   });
  93  | });
  94  | 
  95  | // ─── Outbound shipment form smoke ───────────────────────────────────────────
  96  | 
  97  | test.describe('smoke — shipment form fields', () => {
  98  |   test.beforeEach(async ({ page }) => {
  99  |     await loginAsAdmin(page);
  100 |   });
  101 | 
  102 |   test('fills shipment form with faker data', async ({ page }) => {
  103 |     await page.goto('/outbound-transaction/shipment/new');
  104 |     await page.waitForLoadState('domcontentloaded');
  105 |     await page.getByRole('button', { name: /select warehouse/i }).waitFor({ state: 'visible', timeout: 15000 });
  106 | 
  107 |     const shipNum = randomDocNumber('SHIP');
  108 |     const soRef = randomDocNumber('SO');
  109 |     const recipient = randomCompanyName();
  110 |     const carrier = faker.company.name();
  111 |     const tracking = `TRK-${faker.string.alphanumeric(8).toUpperCase()}`;
  112 |     const ref = randomDocNumber('REF');
  113 |     const notes = randomNotes();
  114 | 
  115 |     await page.getByPlaceholder(/Shipment number/i).first().fill(shipNum);
  116 |     await page.getByPlaceholder(/SO reference/i).first().fill(soRef);
  117 |     await page.getByPlaceholder(/Recipient name/i).first().fill(recipient);
  118 |     await page.getByPlaceholder(/Carrier name/i).first().fill(carrier);
  119 |     await page.getByPlaceholder(/Tracking number/i).first().fill(tracking);
  120 |     await page.getByPlaceholder(/Reference number/i).first().fill(ref);
  121 |     await page.getByPlaceholder(/Add notes/i).first().fill(notes);
  122 | 
  123 |     await expect(page.getByPlaceholder(/Shipment number/i).first()).toHaveValue(shipNum);
  124 |     await expect(page.locator('main')).toBeAttached();
  125 |   });
  126 | });
  127 | 
  128 | // ─── Supplier form smoke ────────────────────────────────────────────────────
  129 | 
  130 | test.describe('smoke — supplier form fields', () => {
  131 |   test.beforeEach(async ({ page }) => {
  132 |     await loginAsAdmin(page);
  133 |   });
  134 | 
  135 |   test('fills supplier form with faker data', async ({ page }) => {
  136 |     await page.goto('/suppliers/new');
  137 |     await page.waitForLoadState('domcontentloaded');
  138 |     await page.getByPlaceholder(/Supplier code/i).first().waitFor({ state: 'visible', timeout: 10000 });
  139 | 
  140 |     const code = `SUP-${faker.string.alphanumeric(6).toUpperCase()}`;
  141 |     const name = randomCompanyName();
  142 |     const email = randomEmail();
  143 |     const phone = randomPhone();
  144 |     const address = randomAddress();
  145 |     const notes = randomNotes();
  146 | 
  147 |     await page.getByPlaceholder(/Supplier code/i).first().fill(code);
  148 |     await page.getByPlaceholder(/Supplier name/i).first().fill(name);
  149 |     await page.getByPlaceholder(/Email/i).first().fill(email);
  150 |     await page.getByPlaceholder(/Phone/i).first().fill(phone);
  151 |     await page.getByPlaceholder(/Address/i).first().fill(address);
  152 |     await page.getByPlaceholder(/Notes/i).first().fill(notes);
  153 | 
  154 |     await expect(page.getByPlaceholder(/Supplier code/i).first()).toHaveValue(code);
  155 |     await expect(page.locator('main')).toBeAttached();
  156 |   });
  157 | });
  158 | 
  159 | // ─── Landing page + login ───────────────────────────────────────────────────
  160 | 
  161 | test.describe('smoke — auth', () => {
  162 |   test('landing page renders', async ({ page }) => {
  163 |     await page.goto('/');
  164 |     await expect(page.getByRole('button', { name: /try the demo/i }).first()).toBeVisible({ timeout: 10000 });
  165 |   });
  166 | 
  167 |   test('invalid login shows error', async ({ page }) => {
  168 |     await page.goto('/login');
  169 |     const badEmail = randomEmail();
  170 |     await page.getByLabel('Email').fill(badEmail);
  171 |     await page.getByLabel('Password').fill(faker.internet.password());
  172 |     await page.getByRole('button', { name: /sign in/i }).click();
  173 |     await expect(page).toHaveURL(/\/login/);
  174 |   });
  175 | 
  176 |   test('admin login success', async ({ page }) => {
  177 |     await loginAsAdmin(page);
  178 |     await expect(page.locator('main')).toBeAttached({ timeout: 10000 });
  179 |   });
  180 | });
  181 | 
  182 | // ─── Detail + edit page checks ──────────────────────────────────────────────
  183 | 
  184 | test.describe('smoke — detail pages', () => {
```