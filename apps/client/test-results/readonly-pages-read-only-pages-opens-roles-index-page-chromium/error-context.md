# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: readonly-pages.spec.ts >> read-only pages >> opens roles index page
- Location: src/tests/e2e/readonly-pages.spec.ts:25:5

# Error details

```
Error: locator.fill: Error: strict mode violation: getByLabel('Password') resolved to 2 elements:
    1) <input value="" title="" required="" data-rac="" tabindex="0" type="password" class="input-group__input" data-slot="input-group-input" id="react-aria613710273-_r_6_" autocomplete="current-password" placeholder="Enter your password" aria-labelledby="react-aria613710273-_r_7_"/> aka getByRole('textbox', { name: 'Password*' })
    2) <button data-rac="" tabindex="0" type="button" data-slot="button" aria-label="Show password" id="react-aria613710273-_r_b_" data-react-aria-pressable="true" class="button button--icon-only button--sm button--ghost">…</button> aka getByRole('button', { name: 'Show password' })

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
                - text: admin@mail.com
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
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const READONLY_PAGES = [
  4  |   { name: 'products index', path: '/products' },
  5  |   { name: 'users index', path: '/users' },
  6  |   { name: 'roles index', path: '/access-control/roles' },
  7  |   { name: 'activity logs', path: '/activity-logs' },
  8  |   { name: 'notifications', path: '/notifications' },
  9  |   { name: 'stock movement', path: '/stock-movement' },
  10 |   { name: 'pallets index', path: '/pallets' },
  11 |   { name: 'monthly stock movement', path: '/reports/monthly-stock-movement' },
  12 |   { name: 'inventory balance', path: '/reports/inventory-balance' },
  13 | ];
  14 | 
  15 | test.describe('read-only pages', () => {
  16 |   test.beforeEach(async ({ page }) => {
  17 |     await page.goto('/login');
  18 |     await page.getByLabel('Email').fill('admin@mail.com');
> 19 |     await page.getByLabel('Password').fill('password');
     |                                       ^ Error: locator.fill: Error: strict mode violation: getByLabel('Password') resolved to 2 elements:
  20 |     await page.getByRole('button', { name: /sign in/i }).click();
  21 |     await page.waitForURL(/\/dashboard/);
  22 |   });
  23 | 
  24 |   for (const p of READONLY_PAGES) {
  25 |     test(`opens ${p.name} page`, async ({ page }) => {
  26 |       await page.goto(p.path);
  27 |       await page.waitForTimeout(2000);
  28 |       await expect(page.locator('main')).toBeAttached({ timeout: 5000 });
  29 |     });
  30 |   }
  31 | });
```