# Router Template

File: `apps/server/src/routers/{domain}.ts`

Replace `{Domain}` / `{domain}` with the actual domain name. Adjust `prisma.{model}` to match the Prisma model name.

```ts
import { TRPCError } from '@trpc/server';
import { logActivity } from '../lib/activity-log.js';
import { buildCreateLogDetail, buildUpdateLogDetail, buildDeleteLogDetail } from '../lib/log-detail.js';
import { buildPaginationMeta, buildPaginationParams, buildTextSearchWhere, createListInputSchema } from '../lib/list-query.js';
import { prisma } from '../lib/prisma.js';
import { hasPermission, protectedProcedure, router } from '../trpc.js';
import { create{Domain}Schema, update{Domain}Schema, {domain}IdSchema } from '@repo/schemas/{domain}';

export const {domain}Router = router({
  list: protectedProcedure
    .use(hasPermission('{domain}@read'))
    .input(createListInputSchema())
    .query(async ({ input }) => {
      const { page, limit, skip } = buildPaginationParams(input);
      const where = buildTextSearchWhere(input?.search, ['id', 'name'] as const);

      const [data, total] = await Promise.all([
        prisma.{model}.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.{model}.count({ where }),
      ]);

      return { data, meta: buildPaginationMeta({ page, limit, total }) };
    }),

  detail: protectedProcedure
    .use(hasPermission('{domain}@read'))
    .input({domain}IdSchema)
    .query(async ({ input }) => {
      const record = await prisma.{model}.findUnique({ where: { id: input.id } });
      if (!record) throw new TRPCError({ code: 'NOT_FOUND', message: '{Domain} not found.' });
      return record;
    }),

  create: protectedProcedure
    .use(hasPermission('{domain}@create'))
    .input(create{Domain}Schema)
    .mutation(async ({ input, ctx }) => {
      const existing = await prisma.{model}.findUnique({ where: { id: input.id } });
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'ID already exists.' });

      const created = await prisma.{model}.create({ data: input });

      await logActivity(prisma, {
        action: 'CREATE',
        userId: ctx.user.userId,
        resource: '{domain}',
        resourceId: created.id,
        message: `Created {domain} ${created.name}`,
        detail: buildCreateLogDetail(created),
      });

      return created;
    }),

  update: protectedProcedure
    .use(hasPermission('{domain}@update'))
    .input(update{Domain}Schema)
    .mutation(async ({ input, ctx }) => {
      const existing = await prisma.{model}.findUnique({ where: { id: input.currentId } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: '{Domain} not found.' });

      const updated = await prisma.{model}.update({
        where: { id: input.currentId },
        data: {
          id: input.id,
          name: input.name,
          // map other fields
        },
      });

      await logActivity(prisma, {
        action: 'UPDATE',
        userId: ctx.user.userId,
        resource: '{domain}',
        resourceId: updated.id,
        message: `Updated {domain} ${updated.name}`,
        detail: buildUpdateLogDetail(existing, updated),
      });

      return updated;
    }),

  delete: protectedProcedure
    .use(hasPermission('{domain}@delete'))
    .input({domain}IdSchema)
    .mutation(async ({ input, ctx }) => {
      const existing = await prisma.{model}.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: '{Domain} not found.' });

      await prisma.{model}.delete({ where: { id: input.id } });

      await logActivity(prisma, {
        action: 'DELETE',
        userId: ctx.user.userId,
        resource: '{domain}',
        resourceId: existing.id,
        message: `Deleted {domain} ${existing.name}`,
        detail: buildDeleteLogDetail(existing),
      });

      return { success: true };
    }),
});
```

## Notes

- `buildTextSearchWhere(search, fields)` — add all searchable text fields to the array
- For relations (e.g. `include: { ... }`), add them to `findMany` in `list` and `detail`
- `transactionalProtectedProcedure` is available for mutations that need an atomic transaction
