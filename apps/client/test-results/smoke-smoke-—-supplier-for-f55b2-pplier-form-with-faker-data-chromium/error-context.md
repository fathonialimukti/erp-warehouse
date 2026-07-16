# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> smoke — supplier form fields >> fills supplier form with faker data
- Location: src/tests/e2e/smoke.spec.ts:135:3

# Error details

```
TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
Call log:
  - waiting for getByPlaceholder(/Supplier code/i).first() to be visible

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
          - heading "Add Supplier" [level=1] [ref=e102]
          - group [ref=e104]:
            - button "Back" [ref=e105] [cursor=pointer]:
              - img
              - generic [ref=e106]: Back
        - generic [ref=e108]:
          - generic [ref=e110]:
            - heading "Supplier Information" [level=3] [ref=e111]
            - paragraph [ref=e112]: Enter details for a new supplier.
          - generic [ref=e114]:
            - generic [ref=e115]:
              - generic [ref=e116]:
                - generic [ref=e117]: Code
                - textbox "Code" [ref=e118]:
                  - /placeholder: e.g. SUP-001
              - generic [ref=e119]:
                - generic [ref=e120]: Name*
                - textbox "Name*" [ref=e121]:
                  - /placeholder: Supplier name
              - generic [ref=e122]:
                - generic [ref=e123]: Email
                - textbox "Email" [ref=e124]:
                  - /placeholder: email@example.com
              - generic [ref=e125]:
                - generic [ref=e126]: Phone
                - textbox "Phone" [ref=e127]:
                  - /placeholder: +62 xxx xxxx xxxx
              - generic [ref=e128]:
                - generic [ref=e129]: Address
                - textbox "Address" [ref=e130]:
                  - /placeholder: Supplier address
            - generic [ref=e131]:
              - generic [ref=e132]: Notes
              - textbox "Notes" [ref=e133]:
                - /placeholder: Additional notes about this supplier
          - generic [ref=e135]:
            - button "Back" [ref=e136] [cursor=pointer]
            - button "Create Supplier" [ref=e137] [cursor=pointer]:
              - img
              - text: Create Supplier
  - button [ref=e140] [cursor=pointer]:
    - img
```

# Test source

```ts
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
> 138 |     await page.getByPlaceholder(/Supplier code/i).first().waitFor({ state: 'visible', timeout: 10000 });
      |                                                           ^ TimeoutError: locator.waitFor: Timeout 10000ms exceeded.
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
  185 |   test.beforeEach(async ({ page }) => {
  186 |     await loginAsAdmin(page);
  187 |   });
  188 | 
  189 |   test('opens warehouse detail from index', async ({ page }) => {
  190 |     await page.goto('/warehouse');
  191 | 
  192 |     // Click first detail button
  193 |     const detailBtn = page.locator('button[aria-label="View details"]').first();
  194 |     if (await detailBtn.isVisible({ timeout: 3000 })) {
  195 |       await detailBtn.click();
  196 |       await page.waitForTimeout(1500);
  197 |       await expect(page.locator('main')).toBeAttached();
  198 |     }
  199 |   });
  200 | 
  201 |   test('opens SKU detail from index', async ({ page }) => {
  202 |     await page.goto('/skus');
  203 | 
  204 |     const detailBtn = page.locator('button[aria-label="View details"]').first();
  205 |     if (await detailBtn.isVisible({ timeout: 3000 })) {
  206 |       await detailBtn.click();
  207 |       await page.waitForTimeout(1500);
  208 |       await expect(page.locator('main')).toBeAttached();
  209 |     }
  210 |   });
  211 | 
  212 |   test('opens product detail from index', async ({ page }) => {
  213 |     await page.goto('/products');
  214 | 
  215 |     const detailBtn = page.locator('button[aria-label="View details"]').first();
  216 |     if (await detailBtn.isVisible({ timeout: 3000 })) {
  217 |       await detailBtn.click();
  218 |       await page.waitForTimeout(1500);
  219 |       await expect(page.locator('main')).toBeAttached();
  220 |     }
  221 |   });
  222 | 
  223 |   test('opens pallet detail from index', async ({ page }) => {
  224 |     await page.goto('/pallets');
  225 | 
  226 |     const rows = page.locator('table tbody tr');
  227 |     if (await rows.first().isVisible({ timeout: 3000 })) {
  228 |       await rows.first().click();
  229 |       await page.waitForTimeout(1500);
  230 |       await expect(page.locator('main')).toBeAttached();
  231 |     }
  232 |   });
  233 | });
```