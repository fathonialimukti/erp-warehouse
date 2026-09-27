# @repo/schemas — Shared Zod Validation

Shared Zod schemas consumed by both the tRPC routers (`apps/server`) and the
React client (`apps/client`). End-to-end type safety starts here.

## Layout

```
src/
├── common.ts              # shared primitives (sortOrder, pagination, list input)
├── warehouse.ts           # warehouse CRUD schemas
├── storage-location.ts    # storage location schemas
├── sku.ts                 # SKU schemas
├── product.ts             # product schemas
├── supplier.ts            # supplier schemas
├── user.ts                # user schemas
├── role.ts                # role + permission schemas
├── permission.ts          # permission string schemas
├── pallet.ts              # pallet schemas
├── receiving.ts           # receiving transaction schemas
├── shipment.ts            # shipment transaction schemas
├── putaway.ts             # putaway schemas
├── pick.ts                # picking schemas
├── wip-completion.ts      # WIP completion schemas
├── wip-issue.ts           # WIP issue schemas
├── return-to-supplier.ts  # RTS schemas
├── rma-receipt.ts         # RMA receipt schemas
├── disposal.ts            # disposal schemas
├── loss.ts                # loss schemas
├── found.ts               # found schemas
├── subinventory-transfer.ts  # transfer schemas
├── purchase-order.ts      # purchase order schemas
├── transaction-common.ts  # shared transaction primitives
├── knowledge.ts           # knowledge base / RAG schemas
├── settings.ts            # system settings schemas
├── notification.ts        # notification schemas
├── backup.ts              # backup schemas
├── activity-log.ts        # activity log schemas
├── inventory-aging.ts     # inventory aging report schemas
├── stock-movement.ts      # stock movement report schemas
└── ...
```

## Usage

```ts
// Server (router)
import { createReceivingInputSchema } from '@repo/schemas/receiving.js';

// Client (form)
import { useCreateReceivingForm } from '@/lib/hooks/useReceiving.js';
// Schema imported from @repo/schemas/receiving.js
```

## Conventions

- Every schema file exports `create*InputSchema`, `update*InputSchema`,
  `*OutputSchema`, and `list*InputSchema` where applicable
- Shared primitives (`sortOrderSchema`, `basePaginationInputSchema`) live
  in `common.ts` and are re-exported per domain file
- Permission strings are always `resource@action` — validated by
  `permission.ts`

## Adding a new domain

1. Create `src/<domain>.ts` with Zod schemas
2. No barrel export — consumers import directly: `@repo/schemas/<domain>.js`
3. Add `@repo/schemas/<domain>.js` to the consuming router and form
4. Run `bun run check-types` to verify
