# Task 3: Integrate AiFillBar into all useAiFillForm pages

## Files
- Modify (add `<AiFillBar />` below `<PageHeader />` in each): all pages that call `useAiFillForm`:
  - `apps/client/src/pages/access-control/RoleFormPage.tsx`
  - `apps/client/src/pages/access-control/RolesIndexPage.tsx`
  - `apps/client/src/pages/activity-logs/ActivityLogsIndexPage.tsx`
  - `apps/client/src/pages/inbound-transaction/found/FoundTransactionFormPage.tsx`
  - `apps/client/src/pages/inbound-transaction/receiving/ReceivingTransactionFormPage.tsx`
  - `apps/client/src/pages/inbound-transaction/rma-receipt/RmaReceiptFormPage.tsx`
  - `apps/client/src/pages/inbound-transaction/wip-completion/WipCompletionFormPage.tsx`
  - `apps/client/src/pages/knowledge/KnowledgeFormPage.tsx`
  - `apps/client/src/pages/knowledge/KnowledgeIndexPage.tsx`
  - `apps/client/src/pages/outbound-transaction/disposal/DisposalFormPage.tsx`
  - `apps/client/src/pages/outbound-transaction/loss/LossTransactionFormPage.tsx`
  - `apps/client/src/pages/outbound-transaction/return-to-supplier/ReturnToSupplierFormPage.tsx`
  - `apps/client/src/pages/outbound-transaction/shipment/ShipmentFormPage.tsx`
  - `apps/client/src/pages/outbound-transaction/wip-issue/WipIssueFormPage.tsx`
  - `apps/client/src/pages/products/ProductFormPage.tsx`
  - `apps/client/src/pages/products/ProductIndexPage.tsx`
  - `apps/client/src/pages/sku/SkuIndexPage.tsx`
  - `apps/client/src/pages/stock-movement/StockMovementPage.tsx`
  - `apps/client/src/pages/subinventory-transfer/SubinventoryTransferFormPage.tsx`
  - `apps/client/src/pages/suppliers/SupplierFormPage.tsx`
  - `apps/client/src/pages/suppliers/SupplierIndexPage.tsx`
  - `apps/client/src/pages/users/UserFormPage.tsx`
  - `apps/client/src/pages/users/UsersIndexPage.tsx`
  - `apps/client/src/pages/warehouse/WarehouseFormPage.tsx`
  - `apps/client/src/pages/warehouse/WarehouseIndexPage.tsx`

## Interfaces
- **Consumes:** `AiFillBar` from `../../components/AiFill/AiFillBar` (or correct relative path per page depth)

## Frozen contract
- Add `import { AiFillBar } from '<relative>/components/AiFill/AiFillBar';`
- Render `<AiFillBar />` **immediately after** the `<PageHeader ... />` closing tag and
  **before** the form/section content, with a small vertical gap (`mt-4` or `space-y`).
- Do NOT change any existing form logic, `useAiFillForm` calls, or layout beyond adding
  the bar.
- The bar must appear on BOTH create and edit modes (it is inside the shared form render).
- For index pages (RolesIndexPage, ActivityLogsIndexPage, KnowledgeIndexPage,
  ProductIndexPage, SkuIndexPage, StockMovementPage, SupplierIndexPage, UsersIndexPage,
  WarehouseIndexPage): place it below the page header too (these pages use `useAiFillForm`
  for filter-fill).

## Steps
- [ ] Step 1: Add import + `<AiFillBar />` to each page
- [ ] Step 2: `bun run check-types` (client) passes
- [ ] Step 3: Self-review (verify no page was missed)
