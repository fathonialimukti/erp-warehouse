# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: receiving.spec.ts >> receiving — full flow >> Step 3 — adds SKU item and sets quantity
- Location: src/tests/e2e/receiving.spec.ts:59:3

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
                    - textbox "Purchase Order Ref" [ref=e166]:
                      - /placeholder: PO reference
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
  7   |   randomNotes,
  8   | } from './helpers/faker';
  9   | import { selectSearchOption } from './helpers/select-search';
  10  | 
  11  | /**
  12  |  * Receiving transaction — full Create (Draft) → Detail with faker.
  13  |  * Each run generates fresh unique data so you can repeat infinite times.
  14  |  *
  15  |  * Run: bun run test -- --grep "receiving — full flow" --repeat-each=3
  16  |  */
  17  | 
  18  | const SUITE = createTestPrefix('RCV');
  19  | let createdTxId: string | null = null;
  20  | 
  21  | test.describe('receiving — full flow', () => {
  22  |   test.beforeEach(async ({ page }) => {
  23  |     await loginAsAdmin(page);
  24  |   });
  25  | 
  26  |   test('Step 1 — fills general fields with faker', async ({ page }) => {
  27  |     await page.goto('/inbound-transaction/receiving/new');
  28  |     await page.waitForLoadState('networkidle');
  29  | 
  30  |     const poRef = randomDocNumber('PO');
  31  |     const dnRef = randomDocNumber('DN');
  32  |     const carrier = faker.company.name();
  33  |     const tracking = `TRK-${faker.string.alphanumeric(8).toUpperCase()}`;
  34  |     const driver = faker.person.fullName();
  35  |     const contact = faker.phone.number().slice(0, 15);
  36  |     const plate = `B ${faker.number.int({ min: 1000, max: 9999 })} ${faker.string.alpha(2).toUpperCase()}`;
  37  |     const notes = randomNotes();
  38  | 
  39  |     await page.getByPlaceholder(/PO reference/i).first().fill(poRef);
  40  |     await page.getByPlaceholder(/Delivery note reference/i).first().fill(dnRef);
  41  |     await page.getByPlaceholder(/Carrier name/i).first().fill(carrier);
  42  |     await page.getByPlaceholder(/Tracking number/i).first().fill(tracking);
  43  |     await page.getByPlaceholder(/Driver name/i).first().fill(driver);
  44  |     await page.getByPlaceholder(/Driver contact/i).first().fill(contact);
  45  |     await page.getByPlaceholder(/Vehicle plate/i).first().fill(plate);
  46  |     await page.getByPlaceholder(/Additional notes/i).first().fill(notes);
  47  | 
  48  |     await expect(page.getByPlaceholder(/PO reference/i).first()).toHaveValue(poRef);
  49  |     await expect(page.getByPlaceholder(/Carrier name/i).first()).toHaveValue(carrier);
  50  |   });
  51  | 
  52  |   test('Step 2 — selects supplier and warehouse via SelectSearch', async ({ page }) => {
  53  |     await page.goto('/inbound-transaction/receiving/new');
  54  |     await page.waitForLoadState('networkidle');
  55  |     await selectSearchOption(page, /supplier/i, '');
  56  |     await selectSearchOption(page, /warehouse/i, '');
  57  |   });
  58  | 
  59  |   test('Step 3 — adds SKU item and sets quantity', async ({ page }) => {
  60  |     await page.goto('/inbound-transaction/receiving/new');
> 61  |     await page.waitForLoadState('networkidle');
      |                ^ Error: page.waitForLoadState: Test timeout of 30000ms exceeded.
  62  | 
  63  |     await page.getByRole('button', { name: /add item/i }).click();
  64  |     await page.waitForTimeout(500);
  65  |     await selectSearchOption(page, /sku/i, '');
  66  | 
  67  |     const qty = faker.number.int({ min: 1, max: 100 }).toString();
  68  |     const qtyInput = page.getByLabel(/qty|quantity/i).first();
  69  |     await qtyInput.fill(qty);
  70  |     await expect(qtyInput).toHaveValue(qty);
  71  |   });
  72  | 
  73  |   test('Step 4 — saves as draft and captures ID', async ({ page }) => {
  74  |     await page.goto('/inbound-transaction/receiving/new');
  75  |     await page.waitForLoadState('networkidle');
  76  | 
  77  |     await selectSearchOption(page, /supplier/i, '');
  78  |     await selectSearchOption(page, /warehouse/i, '');
  79  | 
  80  |     await page.getByRole('button', { name: /add item/i }).click();
  81  |     await page.waitForTimeout(500);
  82  |     await selectSearchOption(page, /sku/i, '');
  83  |     await page.getByLabel(/qty|quantity/i).first().fill(faker.number.int({ min: 1, max: 10 }).toString());
  84  | 
  85  |     await page.getByRole('button', { name: /save draft/i }).click();
  86  |     await page.waitForTimeout(500);
  87  |     await page.getByRole('button', { name: /confirm|yes/i }).click();
  88  |     await page.waitForTimeout(3000);
  89  | 
  90  |     const url = page.url();
  91  |     const match = url.match(/\/inbound-transaction\/receiving\/([^/\n]+)/);
  92  |     if (match) createdTxId = match[1];
  93  |     expect(url).toContain('/inbound-transaction/receiving/');
  94  |   });
  95  | 
  96  |   test('Step 5 — verifies detail page', async ({ page }) => {
  97  |     if (!createdTxId) return;
  98  |     await page.goto(`/inbound-transaction/receiving/${createdTxId}`);
  99  |     await page.waitForLoadState('networkidle');
  100 |     await expect(page.locator('main')).toBeAttached({ timeout: 10000 });
  101 |   });
  102 | });
```