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
    ensureDraftOrRejected,
    ensureNoDuplicateTransactionItems,
    ensureTransactionPalletTypesMatchSku,
    normalizeText,
    summarizeItemTransaction,
} from "../lib/transaction.js";
import {
    inboundTransactionListInputSchema,
    createInboundTransactionSchema,
    putawayPreviewInputSchema,
    putawayAssignInputSchema,
} from "@repo/schemas/transaction-inbound";
import { buildPaginationMeta, buildPaginationParams } from "../lib/list-query.js";
import { notify } from "../lib/notification-service.js";
import { getUserIdsWithPermission } from "../lib/permission-query.js";

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
    list: protectedProcedure.use(hasPermission('inbound_transaction@read')).input(inboundTransactionListInputSchema).query(async ({ ctx, input }) => {
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

        const rows = await ctx.db.inboundTransaction.findMany({
            where,
            skip,
            take: limit,
            orderBy: { date: "desc" },
            include: includeInboundTransaction,
        });
        const total = await ctx.db.inboundTransaction.count({ where });

        return { data: rows.map(summarizeItemTransaction), meta: buildPaginationMeta({ page, limit, total }) };
    }),

    detail: protectedProcedure.use(hasPermission('inbound_transaction@read')).input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
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
                createdBy: true,
                approvedBy: true,
            },
        });

        if (!row) {
            throw new TRPCError({
                code: 'NOT_FOUND',
                message: getMessage(ctx.locale, 'inboundTransaction.notFound'),
            });
        }

        // Resolve users for approval history
        let approvalHistoryWithUsers = row.approvalHistory;
        if (Array.isArray(row.approvalHistory) && row.approvalHistory.length > 0) {
            const userIds = row.approvalHistory.map((h: any) => h.userId).filter(Boolean);
            const users = await ctx.db.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, name: true, email: true },
            });
            const userMap = new Map(users.map(u => [u.id, u]));
            approvalHistoryWithUsers = row.approvalHistory.map((h: any) => ({
                ...h,
                user: userMap.get(h.userId) || null,
            }));
        }

        return {
            ...row,
            approvalHistory: approvalHistoryWithUsers,
        };
    }),

    create: protectedProcedure.use(hasPermission('inbound_transaction@create')).use(transactional).input(createInboundTransactionSchema).mutation(async ({ ctx, input }) => {
        ensureNoDuplicateTransactionItems(input.items, ctx.locale, "inboundTransaction.duplicateItem");
        await ensureTransactionPalletTypesMatchSku(ctx.db, input.items, ctx.locale, {
            palletTypeNotFound: "inboundTransaction.palletTypeNotFound",
            palletTypeMismatch: "inboundTransaction.palletTypeMismatch",
        });

        let createdAttachmentUrls: string[] = [];

        try {
            const initialApprovalHistory = input.approvalHistory ?? [];
            const approvalHistory = input.approvalStatus === "PROPOSED"
                ? buildApprovalActionData(initialApprovalHistory, ctx.user!, "PROPOSED", input.message).approvalHistory
                : initialApprovalHistory;

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
                    warehouseId: input.warehouseId,
                    createdById: ctx.user!.userId,
                    approvalHistory,
                    approvalStatus: input.approvalStatus ?? "DRAFT",
                    items: {
                        create: input.items.map((item) => ({
                            skuId: item.skuId,
                            palletTypeId: item.palletTypeId,
                            quantity: item.quantity,
                            details: normalizeText(item.details),
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

            if (input.approvalStatus === 'PROPOSED') {
                const approverIds = await getUserIdsWithPermission(ctx.db, 'inbound_transaction@approve');
                const recipients = approverIds.filter((id) => id !== ctx.user!.userId);
                if (recipients.length > 0) {
                    await notify(ctx.db, {
                        users: recipients,
                        title: 'Inbound Transaction Proposed',
                        message: `Transaction ${finalized.id} has been proposed and awaits your approval.`,
                        link: `/transactions/inbound/${finalized.id}`,
                        causer: ctx.user!.userId,
                        type: 'INFO',
                        targetType: 'INBOUND',
                        targetId: finalized.id,
                    });
                }
            }

            return finalized;
        } catch (error) {
            await Promise.all(createdAttachmentUrls.map((url) => deleteManagedUpload(url)));
            throw error;
        }
    }),

    update: protectedProcedure.use(hasPermission('inbound_transaction@update')).use(transactional)
        .input(createInboundTransactionSchema.extend({ currentId: z.string(), approvalStatus: inboundTransactionEditableStatusSchema }))
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
                            pallets: { select: { id: true } },
                        },
                    },
                },
            });
            ensureDraftOrRejected(existing?.approvalStatus ?? null, getMessage(ctx.locale, 'inboundTransaction.notFound')); 

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

                const updatedApprovalHistory = input.approvalHistory ?? existing?.approvalHistory ?? [];
                const approvalHistory = input.approvalStatus === "PROPOSED"
                    ? buildApprovalActionData(updatedApprovalHistory, ctx.user!, "PROPOSED", input.message).approvalHistory
                    : updatedApprovalHistory;

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
                        warehouseId: input.warehouseId,
                        approvalHistory,
                        approvalStatus: input.approvalStatus,
                        items: {
                            deleteMany: {},
                            create: input.items.map((item) => ({
                                skuId: item.skuId,
                                palletTypeId: item.palletTypeId,
                                quantity: item.quantity,
                                details: normalizeText(item.details),
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

    delete: protectedProcedure.use(hasPermission('inbound_transaction@delete')).use(transactional).input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
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

        ensureDraftOrRejected(before.approvalStatus, getMessage(ctx.locale, 'inboundTransaction.notFound'));

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

    approve: protectedProcedure.use(hasPermission('inbound_transaction@approve')).use(transactional)
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
                        status: "AVAILABLE" as const,
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

            if (existing.createdById && existing.createdById !== ctx.user!.userId) {
                await notify(ctx.db, {
                    users: [existing.createdById],
                    title: 'Inbound Transaction Approved',
                    message: `Your inbound transaction ${approved.id} has been approved.`,
                    link: `/transactions/inbound/${approved.id}`,
                    causer: ctx.user!.userId,
                    type: 'SUCCESS',
                    targetType: 'INBOUND',
                    targetId: approved.id,
                });
            }

            return approved;
        }),
        
    propose: protectedProcedure.use(hasPermission('inbound_transaction@update'))
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.id },
                select: { id: true, approvalStatus: true, approvalHistory: true },
            });

            if (!existing) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'inboundTransaction.notFound') });
            }

            ensureDraftOnly(existing.approvalStatus, getMessage(ctx.locale, 'inboundTransaction.notFound'));

            const proposedApproval = buildApprovalActionData(existing.approvalHistory, ctx.user!, 'PROPOSED', input.message);
            const proposed = await ctx.db.inboundTransaction.update({
                where: { id: input.id },
                data: {
                    approvalStatus: 'PROPOSED',
                    approvalHistory: proposedApproval.approvalHistory,
                },
            });

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'inbound_transaction',
                resourceId: proposed.id,
                message: `Mengajukan transaksi masuk ${proposed.id} untuk persetujuan`,
                detail: { before: { approvalStatus: existing.approvalStatus }, after: { approvalStatus: proposed.approvalStatus } },
            });

            const approverIds = await getUserIdsWithPermission(ctx.db, 'inbound_transaction@approve');
            const recipients = approverIds.filter((id) => id !== ctx.user!.userId);
            if (recipients.length > 0) {
                await notify(ctx.db, {
                    users: recipients,
                    title: 'Inbound Transaction Proposed',
                    message: `Transaction ${proposed.id} has been proposed and awaits your approval.`,
                    link: `/transactions/inbound/${proposed.id}`,
                    causer: ctx.user!.userId,
                    type: 'INFO',
                    targetType: 'INBOUND',
                    targetId: proposed.id,
                });
            }

            return proposed;
        }),

    reject: protectedProcedure.use(hasPermission('inbound_transaction@approve')).use(transactional)
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

            const rejectedFull = await ctx.db.inboundTransaction.findUnique({
                where: { id: rejected.id },
                select: { createdById: true },
            });
            if (rejectedFull?.createdById && rejectedFull.createdById !== ctx.user!.userId) {
                await notify(ctx.db, {
                    users: [rejectedFull.createdById],
                    title: 'Inbound Transaction Rejected',
                    message: `Your inbound transaction ${rejected.id} has been rejected.${input.message ? ` Reason: ${input.message}` : ''}`,
                    link: `/transactions/inbound/${rejected.id}`,
                    causer: ctx.user!.userId,
                    type: 'ERROR',
                    targetType: 'INBOUND',
                    targetId: rejected.id,
                });
            }

            return rejected;
        }),

    getAssignmentData: protectedProcedure
        .use(hasPermission(['inbound_transaction@read', 'inbound_transaction@putaway']))
        .input(putawayPreviewInputSchema)
        .query(async ({ ctx, input }) => {
            const inbound = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.inboundTransactionId },
                include: {
                    items: {
                        include: {
                            pallets: {
                                where: {
                                    status: 'AVAILABLE',
                                },
                                include: {
                                    palletType: {
                                        include: {
                                            sku: {
                                                select: { id: true, name: true },
                                            },
                                        },
                                    },
                                    inboundTransactionItem: {
                                        select: { id: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (!inbound) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'inboundTransaction.notFound') });
            }

            if (inbound.approvalStatus !== 'APPROVED') {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'putaway.transactionMustBeApproved') });
            }

            const allPallets = inbound.items
                .flatMap((item) => item.pallets);

            const availableLocations = await ctx.db.storageLocation.findMany({
                where: {
                    warehouseId: inbound.warehouseId,
                    status: 'ACTIVE',
                },
                orderBy: { id: 'asc' },
                select: { id: true },
            });

            const unassignedPallets = allPallets.filter((pallet) => pallet.storageLocationId === null);

            const assignmentCount = Math.min(unassignedPallets.length, availableLocations.length);
            const suggestedAssignments = unassignedPallets
                .slice(0, assignmentCount)
                .map((pallet, index) => {
                    const location = availableLocations[index];
                    if (!location) return null;
                    return {
                        palletId: pallet.id,
                        palletTypeId: pallet.palletTypeId,
                        palletTypeName: pallet.palletType.name,
                        skuId: pallet.palletType.sku.id,
                        skuName: pallet.palletType.sku.name,
                        storageLocationId: location.id,
                    };
                })
                .filter((item): item is NonNullable<typeof item> => item !== null);

            const putawayStatus = unassignedPallets.length === 0
                ? 'COMPLETED'
                : unassignedPallets.length === allPallets.length
                    ? 'PENDING'
                    : 'PARTIAL';

            return {
                inboundTransactionId: input.inboundTransactionId,
                warehouseId: inbound.warehouseId,
                pendingPalletCount: unassignedPallets.length,
                availableLocationCount: availableLocations.length,
                hasInsufficientLocations: unassignedPallets.length > availableLocations.length,
                putawayStatus,
                allPallets: allPallets.map((pallet) => ({
                    palletId: pallet.id,
                    palletTypeId: pallet.palletTypeId,
                    palletTypeName: pallet.palletType.name,
                    skuId: pallet.palletType.sku.id,
                    skuName: pallet.palletType.sku.name,
                    inboundTransactionItemId: pallet.inboundTransactionItemId,
                    storageLocationId: pallet.storageLocationId,
                })),
                availableLocations: availableLocations.map((location) => ({ id: location.id })),
                suggestedAssignments,
            };
        }),

    SubmitPalletAssignment: protectedProcedure
        .use(hasPermission('inbound_transaction@putaway'))
        .use(transactional)
        .input(putawayAssignInputSchema)
        .mutation(async ({ ctx, input }) => {
            const inbound = await ctx.db.inboundTransaction.findUnique({
                where: { id: input.inboundTransactionId },
                select: {
                    id: true,
                    warehouseId: true,
                    approvalStatus: true,
                    approvalHistory: true,
                },
            });

            if (!inbound) {
                throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'inboundTransaction.notFound') });
            }

            if (inbound.approvalStatus !== 'APPROVED') {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'putaway.transactionMustBeApproved') });
            }

            const uniquePalletIds = new Set<string>();
            const uniqueLocationIds = new Set<string>();

            if (input.assignments.length === 0) {
                // Reverse assignment: unassign all pallets
                await ctx.db.pallet.updateMany({
                    where: {
                        status: 'AVAILABLE',
                        inboundTransactionItem: {
                            inboundTransactionId: input.inboundTransactionId,
                        },
                    },
                    data: { storageLocationId: null },
                });

                await logActivity(ctx.db, {
                    action: 'UPDATE',
                    userId: ctx.user!.userId,
                    resource: 'inbound_transaction',
                    resourceId: input.inboundTransactionId,
                    message: `Reversed pallet assignments for ${input.inboundTransactionId}`,
                    detail: {
                        before: 'assigned',
                        after: 'unassigned',
                        reversalMessage: input.message ?? null,
                    },
                });

                await ctx.db.inboundTransaction.update({
                    where: { id: input.inboundTransactionId },
                    data: {
                        approvalHistory: [
                            ...(inbound.approvalHistory as any[]),
                            {
                                process: 'UNASSIGNED',
                                userName: ctx.user!.name,
                                timeframe: new Date().toISOString(),
                                message: input.message || null,
                            },
                        ],
                        putawayStatus: 'PENDING',
                    },
                });

                return {
                    success: true,
                    inboundTransactionId: input.inboundTransactionId,
                    assignedCount: 0,
                    assignments: [],
                };
            }

            // Assign logic
            for (const assignment of input.assignments) {
                if (uniquePalletIds.has(assignment.palletId)) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: getMessage(ctx.locale, 'putaway.duplicatePalletAssignment'),
                    });
                }
                if (uniqueLocationIds.has(assignment.storageLocationId)) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: getMessage(ctx.locale, 'putaway.duplicateLocationAssignment'),
                    });
                }

                uniquePalletIds.add(assignment.palletId);
                uniqueLocationIds.add(assignment.storageLocationId);
            }

            const pendingPallets = await ctx.db.pallet.findMany({
                where: {
                    status: 'AVAILABLE',
                    inboundTransactionItem: {
                        inboundTransactionId: input.inboundTransactionId,
                    },
                },
                select: { id: true },
            });

            if (pendingPallets.length === 0) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: getMessage(ctx.locale, 'putaway.noPalletsAvailable'),
                });
            }

            const pendingPalletIdSet = new Set(pendingPallets.map((pallet) => pallet.id));
            for (const assignment of input.assignments) {
                if (!pendingPalletIdSet.has(assignment.palletId)) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: getMessage(ctx.locale, 'putaway.palletNotAssignable'),
                    });
                }
            }

            const locations = await ctx.db.storageLocation.findMany({
                where: {
                    id: { in: Array.from(uniqueLocationIds) },
                },
                include: {
                    pallet: { select: { id: true } },
                },
            });

            if (locations.length !== uniqueLocationIds.size) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: getMessage(ctx.locale, 'putaway.locationNotAssignable'),
                });
            }

            for (const location of locations) {
                if (location.warehouseId !== inbound.warehouseId || location.status !== 'ACTIVE') {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: getMessage(ctx.locale, 'putaway.locationNotAssignable'),
                    });
                }
                if (location.pallet && !uniquePalletIds.has(location.pallet.id)) {
                    throw new TRPCError({
                        code: 'BAD_REQUEST',
                        message: getMessage(ctx.locale, 'putaway.locationOccupied'),
                    });
                }
            }

            // Unassign pallets not in the new assignments
            const palletsToUnassign = await ctx.db.pallet.findMany({
                where: {
                    status: 'AVAILABLE',
                    inboundTransactionItem: {
                        inboundTransactionId: input.inboundTransactionId,
                    },
                    storageLocationId: { not: null },
                    id: { notIn: Array.from(uniquePalletIds) },
                },
                select: { id: true, storageLocationId: true },
            });

            if (palletsToUnassign.length > 0) {
                await ctx.db.pallet.updateMany({
                    where: {
                        id: { in: palletsToUnassign.map(p => p.id) },
                    },
                    data: { storageLocationId: null },
                });
            }

            const before = [
                ...input.assignments.map((assignment) => ({
                    palletId: assignment.palletId,
                    storageLocationId: null,
                })),
                ...palletsToUnassign.map((pallet) => ({
                    palletId: pallet.id,
                    storageLocationId: pallet.storageLocationId,
                })),
            ];

            await Promise.all(
                input.assignments.map((assignment) =>
                    ctx.db.pallet.update({
                        where: { id: assignment.palletId },
                        data: { storageLocationId: assignment.storageLocationId },
                    }),
                ),
            );

            const after = [
                ...input.assignments.map((assignment) => ({
                    palletId: assignment.palletId,
                    storageLocationId: assignment.storageLocationId,
                })),
                ...palletsToUnassign.map((pallet) => ({
                    palletId: pallet.id,
                    storageLocationId: null,
                })),
            ];

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user!.userId,
                resource: 'inbound_transaction',
                resourceId: input.inboundTransactionId,
                message: `Reassigning ${input.assignments.length} inbound pallets and unassigning ${palletsToUnassign.length} for ${input.inboundTransactionId}`,
                detail: {
                    before,
                    after,
                    assignmentMessage: input.message ?? null,
                },
            });

            const putawayStatus = input.assignments.length === 0
                ? 'PENDING'
                : input.assignments.length === pendingPallets.length
                    ? 'COMPLETED'
                    : 'PARTIAL';

            await ctx.db.inboundTransaction.update({
                where: { id: input.inboundTransactionId },
                data: {
                    approvalHistory: [
                        ...(inbound.approvalHistory as any[]),
                        {
                            action: 'ASSIGNED',
                            userId: ctx.user!.userId,
                            timestamp: new Date(),
                            message: input.message || null,
                        },
                    ],
                    putawayStatus,
                },
            });

            return {
                success: true,
                inboundTransactionId: input.inboundTransactionId,
                assignedCount: input.assignments.length,
                unassignedCount: palletsToUnassign.length,
                assignments: after,
            };
        }),
});
