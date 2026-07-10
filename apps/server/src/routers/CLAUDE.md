# Router Conventions

This directory contains all tRPC routers for the ERP warehouse system.

## File Naming
- Domain routers: `{domain}.ts` (e.g., `sku.ts`, `supplier.ts`)
- Transaction routers: `{type}-transaction.ts` (e.g., `receiving-transaction.ts`, `loss-transaction.ts`)
- Nested routers: `{parent-name}.ts` for the parent, sub-routers in separate files (e.g., `warehouse.ts` imports `warehouse-crud.ts`, `storage-location.ts`, `pallet.ts`)

## Procedure Patterns

### List Procedure
```ts
list: protectedProcedure
    .use(hasPermission('resource@read'))
    .input(createListInputSchema({ /* extra filters */ }))
    .query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const where = { ...buildTextSearchWhere(input?.search, ['name', 'id']), ...extraFilters };
        const [data, total] = await Promise.all([
            ctx.db.model.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include }),
            ctx.db.model.count({ where }),
        ]);
        return { data, meta: buildPaginationMeta({ page, limit, total }) };
    }),
```

### Detail Procedure
```ts
detail: protectedProcedure
    .use(hasPermission('resource@read'))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
        const row = await ctx.db.model.findUnique({ where: { id: input.id }, include });
        if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'key') });
        return row;
    }),
```

### Create / Update / Delete
- Use `transactionalProtectedProcedure` or `.use(transactional)` for multi-table writes
- Call `logActivity()` for every mutation
- Check uniqueness before create/update (especially for code/name)
- Use `ensureDraftOnly()` before update/delete

### Approve / Reject
- Use `ensureActionableApprovalStatus()` to guard
- Build approval history with `buildApprovalActionData()`
- For inbound: create pallets + putaway lines on approve
- For outbound: reserve pallets + create pick lines on approve

## Key Files
- `../trpc.ts` — procedure tiers, permission guards, transactional middleware
- `../lib/transaction.ts` — shared helpers: `ensureDraftOnly`, `ensureActionableApprovalStatus`, `buildApprovalActionData`, `buildTransactionBaseWhere`, `normalizeText`
- `../lib/list-query.ts` — `createListInputSchema`, `buildPaginationParams`, `buildPaginationMeta`, `buildTextSearchWhere`
- `../lib/activity-log.ts` — `logActivity()`
- `../lib/log-detail.ts` — `buildCreateLogDetail`, `buildUpdateLogDetail`, `buildDeleteLogDetail`
- `../lib/locale.ts` — `getMessage(locale, key)` for i18n error messages