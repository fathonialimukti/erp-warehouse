# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> smoke — read-only pages >> opens notifications page
- Location: src/tests/e2e/smoke.spec.ts:56:5

# Error details

```
Error: expect(locator).toBeAttached() failed

Locator: locator('main')
Expected: attached
Timeout: 8000ms
Error: element(s) not found

Call log:
  - Expect "toBeAttached" with timeout 8000ms
  - waiting for locator('main')

```

```yaml
- text: Cannot GET /notifications
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
> 59  |       await expect(page.locator('main')).toBeAttached({ timeout: 8000 });
      |                                          ^ Error: expect(locator).toBeAttached() failed
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
  84  |     await page.getByPlaceholder(/Delivery note/i).first().fill(dnRef);
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
```