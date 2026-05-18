import { TRPCError } from "@trpc/server";
import { logActivity } from "../lib/activity-log.js";
import { buildCreateLogDetail, buildDeleteLogDetail, buildUpdateLogDetail } from "../lib/log-detail.js";
import { getMessage } from "../lib/locale.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";
import { hasPermission, protectedProcedure, router, transactional } from "../trpc.js";
import {
    supplierListInputSchema,
    supplierIdSchema,
    createSupplierSchema,
    updateSupplierSchema,
} from "@repo/schemas/supplier";

const includeSupplier = {
    skus: {
        include: {
            sku: { select: { id: true, code: true, name: true } },
        },
    },
} as const;

export const supplierRouter = router({
    list: protectedProcedure.use(hasPermission('supplier@read')).input(supplierListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { code: { contains: search, mode: 'insensitive' as const } },
                    { email: { contains: search, mode: 'insensitive' as const } },
                    { phone: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.supplier.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            ctx.db.supplier.count({ where }),
        ]);

        return { data: rows, meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('supplier@read')).input(supplierIdSchema).query(async ({ ctx, input }) => {
        const row = await ctx.db.supplier.findUnique({ where: { id: input.id }, include: includeSupplier });
        if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'supplier.notFound') });
        return row;
    }),

    create: protectedProcedure.use(hasPermission('supplier@create')).use(transactional)
        .input(createSupplierSchema)
        .mutation(async ({ ctx, input }) => {
            if (input.code) {
                const existing = await ctx.db.supplier.findUnique({ where: { code: input.code } });
                if (existing) throw new TRPCError({ code: 'CONFLICT', message: getMessage(ctx.locale, 'supplier.codeTaken') });
            }

            const created = await ctx.db.supplier.create({ data: input });

            await logActivity(ctx.db, {
                action: 'CREATE',
                userId: ctx.user!.userId,
                resource: 'supplier',
                resourceId: created.id,
                message: `Membuat supplier ${created.name}`,
                detail: buildCreateLogDetail(created),
            });

            return created;
        }),

    update: protectedProcedure.use(hasPermission('supplier@update')).use(transactional)
        .input(updateSupplierSchema)
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.supplier.findUnique({ where: { id: input.id } });
            if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'supplier.notFound') });

            const { id, ...data } = input;

            if (data.code && data.code !== existing.code) {
                const taken = await ctx.db.supplier.findUnique({ where: { code: data.code } });
                if (taken) throw new TRPCError({ code: 'CONFLICT', message: getMessage(ctx.locale, 'supplier.codeTaken') });
            }

            const updated = await ctx.db.supplier.update({ where: { id }, data });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'supplier',
                resourceId: updated.id,
                message: `Memperbarui supplier ${updated.name}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    delete: protectedProcedure.use(hasPermission('supplier@delete')).use(transactional)
        .input(supplierIdSchema)
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.supplier.findUnique({ where: { id: input.id } });
            if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'supplier.notFound') });

            await ctx.db.supplier.delete({ where: { id: input.id } });

            await logActivity(ctx.db, {
                action: 'DELETE',
                userId: ctx.user!.userId,
                resource: 'supplier',
                resourceId: input.id,
                message: `Menghapus supplier ${existing.name}`,
                detail: buildDeleteLogDetail(existing),
            });

            return { success: true };
        }),
});
