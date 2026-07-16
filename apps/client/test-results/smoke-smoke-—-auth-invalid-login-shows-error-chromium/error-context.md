# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> smoke — auth >> invalid login shows error
- Location: src/tests/e2e/smoke.spec.ts:167:3

# Error details

```
Error: locator.fill: Error: strict mode violation: getByLabel('Password') resolved to 2 elements:
    1) <input value="" title="" required="" data-rac="" tabindex="0" type="password" class="input-group__input" data-slot="input-group-input" autocomplete="current-password" id="react-aria4870834558-_r_6_" placeholder="Enter your password" aria-labelledby="react-aria4870834558-_r_7_"/> aka getByRole('textbox', { name: 'Password*' })
    2) <button data-rac="" tabindex="0" type="button" data-slot="button" aria-label="Show password" id="react-aria4870834558-_r_b_" data-react-aria-pressable="true" class="button button--icon-only button--sm button--ghost">…</button> aka getByRole('button', { name: 'Show password' })

Call log:
  - waiting for getByLabel('Password')

```

# Page snapshot

```yaml
- main [ref=e4]:
  - generic [ref=e5]:
    - complementary [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e8]:
          - img [ref=e9]
          - text: Warehouse Control Center
        - generic [ref=e13]:
          - heading "Operational control, one sign-in away." [level=1] [ref=e14]
          - paragraph [ref=e15]: Sign in with your company credentials to access the ERP workspace.
      - generic [ref=e16]:
        - generic [ref=e18]:
          - img [ref=e20]
          - generic [ref=e25]:
            - paragraph [ref=e26]: Full audit trail
            - paragraph [ref=e27]: Every inbound, outbound, and transfer action is traceable to the actor, pallet, and timestamp.
        - generic [ref=e29]:
          - img [ref=e31]
          - generic [ref=e36]:
            - paragraph [ref=e37]: Role-based access
            - paragraph [ref=e38]: Operators, approvers, and admins each see only the modules and actions they are permitted to use.
        - generic [ref=e40]:
          - img [ref=e42]
          - generic [ref=e46]:
            - paragraph [ref=e47]: Live warehouse state
            - paragraph [ref=e48]: Pallets, storage locations, and inventory balances stay in sync across every transaction in real time.
      - generic [ref=e49]:
        - generic [ref=e53]: System status
        - generic [ref=e54]: All services operational
    - generic [ref=e55]:
      - generic [ref=e56]:
        - paragraph [ref=e57]: Warehouse Operations
        - heading "Welcome back" [level=2] [ref=e58]
        - paragraph [ref=e59]: Enter your credentials to continue.
      - generic [ref=e60]:
        - generic [ref=e61]:
          - generic [ref=e62]:
            - generic [ref=e63]:
              - generic [ref=e64]: Email*
              - img [ref=e66]
              - textbox "Email*" [active] [ref=e70]:
                - /placeholder: you@company.com
                - text: angela.dickens23@yahoo.com
            - generic [ref=e71]:
              - generic [ref=e72]: Password*
              - img [ref=e74]
              - textbox "Password*" [ref=e78]:
                - /placeholder: Enter your password
              - button "Show password" [ref=e80] [cursor=pointer]:
                - img
          - generic [ref=e82] [cursor=pointer]:
            - img [ref=e85]
            - generic [ref=e87]:
              - checkbox "Keep me signed in" [checked] [ref=e89]
              - generic [ref=e90]: Keep me signed in
        - button "Sign in to dashboard" [ref=e92] [cursor=pointer]:
          - img
          - text: Sign in to dashboard
      - generic [ref=e93]:
        - img [ref=e94]
        - text: Session is protected and permission-aware.
```

# Test source

```ts
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
> 171 |     await page.getByLabel('Password').fill(faker.internet.password());
      |                                       ^ Error: locator.fill: Error: strict mode violation: getByLabel('Password') resolved to 2 elements:
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