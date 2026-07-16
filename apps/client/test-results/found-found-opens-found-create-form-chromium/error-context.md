# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: found.spec.ts >> found >> opens found create form
- Location: src/tests/e2e/found.spec.ts:9:3

# Error details

```
Error: expect(locator).toBeAttached() failed

Locator: locator('main')
Expected: attached
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeAttached" with timeout 15000ms
  - waiting for locator('main')

```

```yaml
- heading "Unexpected Application Error!" [level=2]
- heading "cannot be rendered outside a collection." [level=3]
- text: "Error: cannot be rendered outside a collection. at http://localhost:10011/node_modules/.vite/deps/@heroui_react.js?v=805f04e7:11779:34 at Object.react_stack_bottom_frame (http://localhost:10011/node_modules/.vite/deps/react-dom_client.js?v=805f04e7:12621:12) at renderWithHooks (http://localhost:10011/node_modules/.vite/deps/react-dom_client.js?v=805f04e7:3966:19) at updateForwardRef (http://localhost:10011/node_modules/.vite/deps/react-dom_client.js?v=805f04e7:5149:16) at beginWork (http://localhost:10011/node_modules/.vite/deps/react-dom_client.js?v=805f04e7:5957:21) at runWithFiberInDEV (http://localhost:10011/node_modules/.vite/deps/react-dom_client.js?v=805f04e7:604:66) at performUnitOfWork (http://localhost:10011/node_modules/.vite/deps/react-dom_client.js?v=805f04e7:8182:92) at workLoopSync (http://localhost:10011/node_modules/.vite/deps/react-dom_client.js?v=805f04e7:8078:37) at renderRootSync (http://localhost:10011/node_modules/.vite/deps/react-dom_client.js?v=805f04e7:8062:6) at performWorkOnRoot (http://localhost:10011/node_modules/.vite/deps/react-dom_client.js?v=805f04e7:7747:27)"
- paragraph: 💿 Hey developer 👋
- paragraph:
  - text: You can provide a way better UX than this when your app throws errors by providing your own
  - code: ErrorBoundary
  - text: or
  - code: errorElement
  - text: prop on your route.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { loginAsAdmin } from './helpers/auth';
  3  | 
  4  | test.describe('found', () => {
  5  |   test.beforeEach(async ({ page }) => {
  6  |     await loginAsAdmin(page);
  7  |   });
  8  | 
  9  |   test('opens found create form', async ({ page }) => {
  10 |     await page.goto('/inbound-transaction/found/new');
  11 |     await page.waitForLoadState('networkidle');
> 12 |     await expect(page.locator('main')).toBeAttached({ timeout: 15000 });
     |                                        ^ Error: expect(locator).toBeAttached() failed
  13 |   });
  14 | });
```