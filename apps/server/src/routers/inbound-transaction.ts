import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { z } from "zod";
import { getMessage } from "../lib/locale.js";
import { logActivity } from "../lib/activity-log.js";
import { buildCreateLogDetail, buildUpdateLogDetail, buildDeleteLogDetail } from "../lib/log-detail.js";
import type { Prisma } from "../prisma/generated/client";
import { deleteManagedUpload, persistUploadedAttachment, type StoredAttachment, type UploadedAttachmentInput } from "../lib/upload-file.js";
import { hasPermission, protectedProcedure, router, transactional } from "../trpc.js";
import {
    buildApprovalActionData,
    buildTransactionBaseWhere,
    ensureActionableApprovalStatus,
    ensureDraftOnly,
    ensureNoDuplicateTransactionItems,
    ensureTransactionPalletTypesMatchSku,
    normalizeText,
    approvalStatusValues,
    summarizeItemTransaction,
} from "./transaction-common";
import {
    approvalHistorySchema,
    transactionApprovalStatusSchema,
    transactionListInputSchema,
} from "./transaction-schemas.js";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";

const inboundTransactionItemSchema = z.object({
    skuId: z.string().min(1, "SKU wajib diisi"),
    palletTypeId: z.string().min(1, "Jenis palet wajib diisi"),
    quantity: z.coerce.number().int().min(1, "Jumlah minimal 1"),
    sortOrder: z.number().int().optional(),
});

const inboundTransactionFileSchema = z.object({
    name: z.string().min(1, "Nama file wajib diisi"),
    type: z.string().optional(),
    size: z.coerce.number().min(0),
    dataUrl: z.string().optional(),
    url: z.string().optional(),
    storedName: z.string().optional(),
});

const inboundTransactionInputSchema = z.object({
    id: z.string().optional(),
    date: z.coerce.date().optional(),
    sender: z.string().optional(),
    reference: z.string().optional(),
    asnNumber: z.string().optional(),
    carrier: z.string().optional(),
    trackingNumber: z.string().optional(),
    bolNumber: z.string().optional(),
    driverName: z.string().optional(),
    driverContact: z.string().optional(),
    vehiclePlate: z.string().optional(),
    files: z.array(inboundTransactionFileSchema).optional(),
    notes: z.string().optional(),
    approvalStatus: transactionApprovalStatusSchema.optional(),
    items: z.array(inboundTransactionItemSchema).min(1, "Minimal satu item"),
    approvalHistory: approvalHistorySchema,
});

const inboundTransactionEditableStatusSchema = z.enum(["DRAFT", "PROPOSED"] as const);

const INBOUND_ATTACHMENTS_FOLDER = 'inbound-transactions';

const persistInboundTransactionFiles = async ({
    files,
    transactionId,
    req,
}: {
    files: UploadedAttachmentInput[] | undefined;
    transactionId: string;
    req: Request;
}) => {
    if (!files?.length) {
        return { files: [] as StoredAttachment[], createdUrls: [] as string[] };
    }

    const persistedFiles: StoredAttachment[] = [];
    const createdUrls: string[] = [];

    for (const file of files) {
        const persistedFile = await persistUploadedAttachment({
            attachment: file,
            folder: INBOUND_ATTACHMENTS_FOLDER,
            req,
            fileNamePrefix: transactionId,
        });

        persistedFiles.push(persistedFile);
        if (file.dataUrl) {
            createdUrls.push(persistedFile.url);
        }
    }

    return { files: persistedFiles, createdUrls };
};

const deleteManagedUploads = async (files: Array<{ url?: string | null }> | null | undefined) => {
    await Promise.all(files?.map((file) => deleteManagedUpload(file.url ?? null)) ?? []);
};

const includeInboundTransaction = {
    createdBy: true,
    approvedBy: true,
    items: {
        include: {
            sku: true,
            palletType: true,
            pallets: {
                select: {
                    id: true,
                },
            },
        },
    },
} as const;

export const inboundTransactionRouter = router({
    list: protectedProcedure.use(hasPermission('warehouse_transaction_read')).input(transactionListInputSchema).query(async ({ ctx, input }) => {
        const { page, limit, skip } = buildPaginationParams(input);
        const search = input?.search?.trim();

        const where: Record<string, unknown> = {
            ...buildTransactionBaseWhere(input),
            ...(search
                ? {
                      OR: [
                          { id: { contains: search, mode: "insensitive" as const } },
                          { notes: { contains: search, mode: "insensitive" as const } },
                          { sender: { contains: search, mode: "insensitive" as const } },
                          { reference: { contains: search, mode: "insensitive" as const } },
                          { asnNumber: { contains: search, mode: "insensitive" as const } },
                          { carrier: { contains: search, mode: "insensitive" as const } },
                          { trackingNumber: { contains: search, mode: "insensitive" as const } },
                          { bolNumber: { contains: search, mode: "insensitive" as const } },
                          { driverName: { contains: search, mode: "insensitive" as const } },
                          { driverContact: { contains: search, mode: "insensitive" as const } },
                          { vehiclePlate: { contains: search, mode: "insensitive" as const } },
                          { createdBy: { name: { contains: search, mode: "insensitive" as const } } },
                          { createdBy: { email: { contains: search, mode: "insensitive" as const } } },
                      ],
                  }
                : {}),
        };

        const [rows, total] = await Promise.all([
            ctx.db.inboundTransaction.findMany({
                where,
                skip,
                take: limit,
                orderBy: { date: "desc" },
                include: includeInboundTransaction,
            }),
            ctx.db.inboundTransaction.count({ where }),
        ]);

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('warehouse_transaction_read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
        const row = await ctx.db.inboundTransaction.findUnique({
            where: { id: input.id },
            include: {
                items: {
                    include: {
                        sku: true,
                        palletType: true,
                        pallets: true,
                    },
                },
            },
        });

        if (!row) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: getMessage(ctx.locale, 'inboundTransaction.notFound'),
            });
        }

        return row;
    }),

    create: protectedProcedure.use(hasPermission('warehouse_transaction_create')).use(transactional).input(inboundTransactionInputSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, "inboundTransaction.duplicateItem");
        await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
            palletTypeNotFound: "inboundTransaction.palletTypeNotFound",
            palletTypeMismatch: "inboundTransaction.palletTypeMismatch",
        });

        let createdAttachmentUrls: string[] = [];

        try {
            const created = await ctx.db.inboundTransaction.create({
                data: {
                    id: input.id || undefined,
                    date: input.date ?? new Date(),
                    sender: normalizeText(input.sender),
                    reference: normalizeText(input.reference),
                    asnNumber: normalizeText(input.asnNumber),
                    carrier: normalizeText(input.carrier),
                    trackingNumber: normalizeText(input.trackingNumber),
                    bolNumber: normalizeText(input.bolNumber),
                    driverName: normalizeText(input.driverName),
                    driverContact: normalizeText(input.driverContact),
                    vehiclePlate: normalizeText(input.vehiclePlate),
                    notes: normalizeText(input.notes),
                    createdById: ctx.user!.userId,
                    approvalHistory: input.approvalHistory ?? [],
                    approvalStatus: input.approvalStatus ?? "DRAFT",
                    items: {
                        create: input.items.map((item) => ({
                            skuId: item.skuId,
                            palletTypeId: item.palletTypeId,
                            quantity: item.quantity,
                            sortOrder: item.sortOrder,
                        })),
                    },
                },
                include: includeInboundTransaction,
            });

            const { files, createdUrls } = await persistInboundTransactionFiles({
                files: input.files,
                transactionId: created.id,
                req: ctx.req,
            });
            createdAttachmentUrls = createdUrls;

            const finalized = files.length
                ? await ctx.db.inboundTransaction.update({
                    where: { id: created.id },
                    data: { files: files as unknown as Prisma.InputJsonValue },
                    include: includeInboundTransaction,
                })
                : created;

            await logActivity(ctx.db, {
                action: 'CREATE',
                userId: ctx.user!.userId,
                resource: 'inbound_transaction',
                resourceId: finalized.id,
                message: `Membuat transaksi masuk ${finalized.id}`,
                detail: buildCreateLogDetail(finalized),
            });

            return finalized;
        } catch (error) {
            await Promise.all(createdAttachmentUrls.map((url) => deleteManagedUpload(url)));
            throw error;
        }
    }),

    update: protectedProcedure.use(hasPermission('warehouse_transaction_update')).use(transactional)
        .input(inboundTransactionInputSchema.extend({ currentId: z.string(), approvalStatus: inboundTransactionEditableStatusSchema }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.currentId },
                select: {
                    id: true,
                    date: true,
                    sender: true,
                    reference: true,
                    asnNumber: true,
                    carrier: true,
                    trackingNumber: true,
                    bolNumber: true,
                    driverName: true,
                    driverContact: true,
                    vehiclePlate: true,
                    notes: true,
                    files: true,
                    approvalStatus: true,
                    approvalHistory: true,
                    createdAt: true,
                    updatedAt: true,
                    createdById: true,
                    approvedById: true,
                    approvedAt: true,
                    items: {
                        select: {
                            id: true,
                            skuId: true,
                            palletTypeId: true,
                            quantity: true,
                            sortOrder: true,
                            createdAt: true,
                            updatedAt: true,
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureDraftOnly(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'inboundTransaction.notFound')); 

            ensureNoDuplicateTransactionItems(input.items, ctx.locale, "inboundTransaction.duplicateItem");

            const nextTransactionId = input.id || input.currentId;
            const existingFiles = Array.isArray(existing?.files) ? (existing.files as unknown as UploadedAttachmentInput[]) : [];
            const retainedFileUrls = new Set((input.files ?? []).map((file) => file.url).filter(Boolean));
            let createdAttachmentUrls: string[] = [];

            try {
                const { files, createdUrls } = await persistInboundTransactionFiles({
                    files: input.files,
                    transactionId: nextTransactionId,
                    req: ctx.req,
                });
                createdAttachmentUrls = createdUrls;

                const updated = await ctx.db.inboundTransaction.update({
                    where: { id: input.currentId },
                    data: {
                        id: input.id || undefined,
                        date: input.date ?? new Date(),
                        sender: normalizeText(input.sender),
                        reference: normalizeText(input.reference),
                        asnNumber: normalizeText(input.asnNumber),
                        carrier: normalizeText(input.carrier),
                        trackingNumber: normalizeText(input.trackingNumber),
                        bolNumber: normalizeText(input.bolNumber),
                        driverName: normalizeText(input.driverName),
                        driverContact: normalizeText(input.driverContact),
                        vehiclePlate: normalizeText(input.vehiclePlate),
                        files: input.files !== undefined
                            ? (files.length > 0 ? (files as unknown as Prisma.InputJsonValue) : ([] as unknown as Prisma.InputJsonValue))
                            : undefined,
                        notes: normalizeText(input.notes),
                        approvalHistory: input.approvalHistory ?? [],
                        approvalStatus: input.approvalStatus,
                        items: {
                            deleteMany: {},
                            create: input.items.map((item) => ({
                                skuId: item.skuId,
                                palletTypeId: item.palletTypeId,
                                quantity: item.quantity,
                                sortOrder: item.sortOrder,
                            })),
                        },
                    },
                    include: includeInboundTransaction,
                });

                if (input.files !== undefined) {
                    await deleteManagedUploads(existingFiles.filter((file) => file.url && !retainedFileUrls.has(file.url)));
                }

                await logActivity(ctx.db, {
                    action: "UPDATE",
                    userId: ctx.user!.userId,
                    resource: "inbound_transaction",
                    resourceId: updated.id,
                    message: `Memperbarui transaksi masuk ${updated.id}`,
                    detail: buildUpdateLogDetail(existing, updated),
                });

                return updated;
            } catch (error) {
                await Promise.all(createdAttachmentUrls.map((url) => deleteManagedUpload(url)));
                throw error;
            }
        }),

    delete: protectedProcedure.use(hasPermission('warehouse_transaction_delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.inboundTransaction.findUnique({
            where: { id: input.id },
            include: {
                items: {
                    include: {
                        pallets: { select: { id: true } },
                    },
                },
            },
        });
        if (!before) {
            throw new TRPCError({ code: "NOT_FOUND", message: getMessage(ctx.locale, 'inboundTransaction.notFound') });
        }

        ensureDraftOnly(before.approvalStatus, getMessage(ctx.locale, 'inboundTransaction.notFound'));

        const generatedPalletCount = before.items.reduce((sum, item) => sum + item.pallets.length, 0);
        if (generatedPalletCount > 0) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: getMessage(ctx.locale, 'inboundTransaction.cannotDeleteGeneratedPallets'),
            });
        }

        await ctx.db.inboundTransaction.delete({ where: { id: input.id } });
        await deleteManagedUploads(Array.isArray(before.files) ? (before.files as Array<{ url?: string | null }>) : []);

        await logActivity(ctx.db, {
            action: "DELETE",
            userId: ctx.user!.userId,
            resource: "inbound_transaction",
            resourceId: before.id,
            message: `Menghapus transaksi masuk ${before.id}`,
            detail: buildDeleteLogDetail(before),
        });

        return { success: true };
    }),

    approve: protectedProcedure.use(hasPermission('approval_approve')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.id },
                include: {
                    items: {
                        include: {
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureActionableApprovalStatus(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'inboundTransaction.notFound'));

            if (!existing || existing.items.length === 0) {
                throw new TRPCError({ code: "BAD_REQUEST", message: getMessage(ctx.locale, 'inboundTransaction.emptyItems') });
            }

            const generatedPalletCount = existing.items.reduce((sum, item) => sum + item.pallets.length, 0);
            if (generatedPalletCount > 0) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: getMessage(ctx.locale, 'inboundTransaction.alreadyGenerated'),
                });
            }

            await ctx.db.pallet.createMany({
                data: existing.items.flatMap((item) =>
                    Array.from({ length: item.quantity }, () => ({
                        palletTypeId: item.palletTypeId,
                        status: "RECEIVED" as const,
                        receivedAt: existing.date,
                        inboundTransactionId: existing.id,
                        inboundTransactionItemId: item.id,
                    })),
                ),
            });

            const approved = await ctx.db.inboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, "APPROVED", input.message),
                include: includeInboundTransaction,
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "inbound_transaction",
                resourceId: approved.id,
                message: `Menyetujui transaksi masuk ${approved.id}`,
                detail: {
                    before: {
                        approvalStatus: existing.approvalStatus,
                        approvalHistory: existing.approvalHistory,
                    },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    propose: protectedProcedure.use(hasPermission('warehouse_transaction_update'))
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.id },
                select: { id: true, approvalStatus: true, approvalHistory: true },
            });

            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'inboundTransaction.notFound') });
            }

            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'inboundTransaction.notFound'));

            const proposed = await ctx.db.inboundTransaction.update({
                where: { id: input.id },
                data: { approvalStatus: 'PROPOSED' },
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'inbound_transaction',
                resourceId: proposed.id,
                message: `Mengajukan transaksi masuk ${proposed.id} untuk persetujuan`,
                detail: { before: { approvalStatus: existing.approvalStatus }, after: { approvalStatus: proposed.approvalStatus } },
            });

            return proposed;
        }),

    reject: protectedProcedure.use(hasPermission('approval_reject')).use(transactional)
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.id },
                select: {
                    approvalStatus: true,
                    approvalHistory: true,
                    items: {
                        select: {
                            id: true,
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });

            if (!existing || (existing.approvalStatus !== 'PROPOSED' && existing.approvalStatus !== 'APPROVED')) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'inboundTransaction.notFound') });
            }

            const itemIdsWithPallets = existing.items.filter((item) => item.pallets.length > 0).map((item) => item.id);
            if (itemIdsWithPallets.length > 0) {
                await ctx.db.pallet.deleteMany({
                    where: { inboundTransactionItemId: { in: itemIdsWithPallets } },
                });
            }

            const rejected = await ctx.db.inboundTransaction.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing.approvalHistory, ctx.user!, 'REJECTED', input.message),
            });

            await logActivity(ctx.db, {
                action: 'REJECT',
                userId: ctx.user!.userId,
                resource: 'inbound_transaction',
                resourceId: rejected.id,
                message: `Menolak transaksi masuk ${rejected.id}`,
            });

            return rejected;
        }),
});
