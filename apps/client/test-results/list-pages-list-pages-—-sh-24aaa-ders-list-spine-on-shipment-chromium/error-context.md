# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: list-pages.spec.ts >> list pages — shared spine >> renders list spine on shipment
- Location: src/tests/e2e/list-pages.spec.ts:57:5

# Error details

```
Error: page.goto: Target page, context or browser has been closed
Call log:
  - navigating to "http://localhost:10011/outbound-transaction/shipment", waiting until "load"

```

```
Error: browserContext.close: Target page, context or browser has been closed
```