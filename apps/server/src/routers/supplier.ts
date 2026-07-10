import { TRPCError } from "@trpc/server";
import { logActivity } from "../lib/activity-log.js";
import { buildCreateLogDetail, buildDeleteLogDetail, buildUpdateLogDetail } from "../lib/log-detail.js";
import { getMessage } from "../lib/locale.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";
import { removePhotoValue } from "../lib/photo-lifecycle.js";
import { buildCreateSkuData, buildUpdateSkuData, getSkuOrThrow } from "../lib/sku-mutation-service.js";
import { hasPermission, protectedProcedure, router, transactional } from "../trpc.js";
import {
    supplierListInputSchema,
    supplierIdSchema,
    createSupplierSchema,
    updateSupplierSchema,
    createMaterialSchema,
    updateMaterialSchema,
    removeMaterialSchema,
} from "@repo/schemas/supplier";

/** Include shape for supplier detail — expands linked material SKUs with pivot pricing. */
const includeSupplierDetail = {
    skus: {
        include: {
            sku: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                    type: true,
                    baseUnit: true,
                    packageName: true,
                    packagesPerPallet: true,
                    quantityPerPackage: true,
                    packageUnit: true,
                },
            },
        },
    },
} as const;

/**
 * Router for supplier master data and supplier-linked material SKU management.
 *
 * Suppliers own raw and packaging material SKUs. Material SKU CRUD is exposed as nested
 * procedures (`addMaterial`, `updateMaterial`, `removeMaterial`) so the Supplier detail
 * page can manage the full material catalogue in one place.
 *
 * Permissions:
 * - Supplier CRUD: `supplier@read/create/update/delete`
 * - Material management: `sku@create/update/delete`
 */
export const supplierRouter = router({

    /**
     * Paginated supplier list with optional text search.
     * Searches across name, code, email, and phone.
     *
     * @permission supplier@read
     */
    list: protectedProcedure.use(hasPermission('supplier@read'))
        .input(supplierListInputSchema)
        .query(async ({ ctx, input }) => {
            const { page, limit, skip } = buildPaginationParams(input);
            const search = input?.search?.trim();

            const where = search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { code: { contains: search, mode: 'insensitive' as const } },
                    { email: { contains: search, mode: 'insensitive' as const } },
                    { phone: { contains: search, mode: 'insensitive' as const } },
                ],
            } : {};

            const [rows, total] = await Promise.all([
                ctx.db.supplier.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
                ctx.db.supplier.count({ where }),
            ]);

            return { data: rows, meta: buildPaginationMeta({ page, limit, total }) };
        }),

    /**
     * Single supplier detail including all linked material SKUs and their pivot pricing.
     *
     * @permission supplier@read
     */
    detail: protectedProcedure.use(hasPermission('supplier@read'))
        .input(supplierIdSchema)
        .query(async ({ ctx, input }) => {
            const row = await ctx.db.supplier.findUnique({
                where: { id: input.id },
                include: includeSupplierDetail,
            });
            if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'supplier.notFound') });
            return row;
        }),

    /**
     * Create a new supplier.
     * Supplier code must be unique when provided.
     *
     * @permission supplier@create
     */
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
                message: `Created supplier ${created.name}`,
                detail: buildCreateLogDetail(created),
            });

            return created;
        }),

    /**
     * Update supplier master fields.
     * Code uniqueness is re-checked only when the code value changes.
     *
     * @permission supplier@update
     */
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
                message: `Updated supplier ${updated.name}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    /**
     * Delete a supplier.
     * Cascades via DB to the SupplierSku pivot, but will not automatically delete the SKU records
     * themselves — those are managed by `removeMaterial`.
     *
     * @permission supplier@delete
     */
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
                message: `Deleted supplier ${existing.name}`,
                detail: buildDeleteLogDetail(existing),
            });

            return { success: true };
        }),

    // =============================================
    // MATERIAL SKU MANAGEMENT
    // =============================================

    /**
     * Create a raw or packaging material SKU and link it to this supplier.
     * Atomically creates both the Sku record and the SupplierSku pivot with pricing data.
     * SKU code must be unique across all SKUs.
     *
     * @permission sku@create
     */
    addMaterial: protectedProcedure.use(hasPermission('sku@create')).use(transactional)
        .input(createMaterialSchema)
        .mutation(async ({ ctx, input }) => {
            const supplier = await ctx.db.supplier.findUnique({ where: { id: input.supplierId } });
            if (!supplier) throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'supplier.notFound') });

            if (input.code) {
                const existing = await ctx.db.sku.findUnique({ where: { code: input.code } });
                if (existing) throw new TRPCError({ code: 'CONFLICT', message: getMessage(ctx.locale, 'sku.codeTaken') });
            }

            const { supplierId, supplierItemCode, unitPrice, leadTimeDays, minimumOrderQty, isPreferred, ...skuInput } = input;

            const skuData = await buildCreateSkuData({
                input: skuInput,
                type: input.type,
                req: ctx.req,
                locale: ctx.locale,
            });

            const sku = await ctx.db.sku.create({ data: skuData });

            await ctx.db.supplierSku.create({
                data: {
                    supplierId,
                    skuId: sku.id,
                    supplierItemCode: supplierItemCode ?? null,
                    unitPrice: unitPrice ?? null,
                    leadTimeDays: leadTimeDays ?? null,
                    minimumOrderQty: minimumOrderQty ?? null,
                    isPreferred,
                },
            });

            await logActivity(ctx.db, {
                action: 'CREATE',
                userId: ctx.user!.userId,
                resource: 'sku',
                resourceId: sku.id,
                message: `Added material ${sku.name} to supplier ${supplier.name}`,
                detail: buildCreateLogDetail(sku),
            });

            return sku;
        }),

    /**
     * Update a material SKU's fields and/or its SupplierSku pivot pricing.
     * Both the Sku record and the SupplierSku pivot are updated atomically.
     * Code uniqueness is re-checked only when the code value changes.
     *
     * @permission sku@update
     */
    updateMaterial: protectedProcedure.use(hasPermission('sku@update')).use(transactional)
        .input(updateMaterialSchema)
        .mutation(async ({ ctx, input }) => {
            const existing = await getSkuOrThrow({ db: ctx.db, id: input.skuId, locale: ctx.locale });

            if (input.code !== existing.code) {
                const taken = await ctx.db.sku.findUnique({ where: { code: input.code } });
                if (taken) throw new TRPCError({ code: 'CONFLICT', message: getMessage(ctx.locale, 'sku.codeTaken') });
            }

            const { supplierId, skuId, supplierItemCode, unitPrice, leadTimeDays, minimumOrderQty, isPreferred, ...skuInput } = input;

            const skuData = await buildUpdateSkuData({
                input: { ...skuInput, code: input.code },
                existingPhoto: existing.photo,
                req: ctx.req,
                locale: ctx.locale,
            });

            const updated = await ctx.db.sku.update({ where: { id: skuId }, data: skuData });

            await ctx.db.supplierSku.update({
                where: { supplierId_skuId: { supplierId, skuId } },
                data: {
                    supplierItemCode: supplierItemCode ?? null,
                    unitPrice: unitPrice ?? null,
                    leadTimeDays: leadTimeDays ?? null,
                    minimumOrderQty: minimumOrderQty ?? null,
                    isPreferred,
                },
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'sku',
                resourceId: updated.id,
                message: `Updated material ${updated.name}`,
                detail: buildUpdateLogDetail(existing, updated),
            });

            return updated;
        }),

    /**
     * Remove a material SKU from a supplier and delete the SKU record entirely.
     * Blocked if the SKU has any stock (AVAILABLE pallets). If the SKU is linked to other
     * suppliers those links are also deleted (Prisma cascade via SupplierSku).
     *
     * @permission sku@delete
     */
    removeMaterial: protectedProcedure.use(hasPermission('sku@delete')).use(transactional)
        .input(removeMaterialSchema)
        .mutation(async ({ ctx, input }) => {
            const sku = await ctx.db.sku.findUnique({
                where: { id: input.skuId },
                include: { pallets: { where: { status: 'AVAILABLE' }, select: { id: true } } },
            });
            if (!sku) throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'sku.notFound') });

            if (sku.pallets.length > 0) {
                throw new TRPCError({ code: 'PRECONDITION_FAILED', message: getMessage(ctx.locale, 'sku.hasStock') });
            }

            await ctx.db.sku.delete({ where: { id: input.skuId } });

            await logActivity(ctx.db, {
                action: 'DELETE',
                userId: ctx.user!.userId,
                resource: 'sku',
                resourceId: sku.id,
                message: `Removed material ${sku.name} from supplier`,
                detail: buildDeleteLogDetail(sku),
            });

            await removePhotoValue(sku.photo ?? null);

            return { success: true };
        }),
});
