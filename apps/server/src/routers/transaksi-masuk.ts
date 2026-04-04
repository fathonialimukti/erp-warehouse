import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logActivity } from "../lib/activity-log.js";
import { protectedProcedure, router, transactionalProtectedProcedure } from "../trpc.js";
import {
    baseCreateData,
    baseUpdateData,
    buildApprovalActionData,
    buildListWhere,
    buildOrderBy,
    computePackagingTotals,
    ensureDraftOnly,
    ensureActionableApprovalStatus,
    extractLokasi,
    listInputSchema,
    statusApprovalValues,
    transaksiBaseInputSchema,
    type TransaksiRow,
} from "./transaksi-common.js";

const includeMasuk = {
    palet: {
        include: {
            jenisPalet: true,
            lokasiPenyimpanan: true,
        },
    },
    lokasiMasuk: true,
    createdBy: true,
    approvedBy: true,
} as const;

const mapMasuk = (row: any): TransaksiRow => ({
    ...computePackagingTotals(row.qtyPalet, {
        kemasanPerPalet: row.palet?.jenisPalet?.kemasanPerPalet,
        isiPerKemasan: row.palet?.jenisPalet?.isiPerKemasan,
    }),
    id: row.id,
    paletId: row.paletId,
    qtyPalet: row.qtyPalet,
    jenisTransaksi: "PENERIMAAN",
    lokasiMasukId: row.lokasiMasukId,
    lokasiKeluarId: null,
    tanggal: row.tanggal,
    referensi: row.referensi,
    keterangan: row.keterangan,
    approvalHistory: Array.isArray(row.approvalHistory) ? row.approvalHistory : [],
    statusApproval: row.statusApproval,
    palet: row.palet,
    lokasiMasuk: row.lokasiMasuk,
    lokasiKeluar: null,
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    jenisTemuan: null,
    alasanKehilangan: null,
    nilaiEstimasi: null,
    alasanPemindahan: null,
    namaKemasan: row.palet?.jenisPalet?.namaKemasan ?? null,
    satuanPerKemasan: row.palet?.jenisPalet?.satuanPerKemasan ?? null,
    approvalRequest: null,
});

export const transaksiMasukRouter = router({
    list: protectedProcedure.input(listInputSchema).query(async ({ input }) => {
        const page = input?.page ?? 1;
        const limit = input?.limit ?? 10;
        const skip = (page - 1) * limit;
        const where = buildListWhere(input, { hasLokasiMasuk: true });
        const orderBy = buildOrderBy(input?.sortBy, input?.sortDirection, { hasLokasiMasuk: true });

        const [data, total] = await Promise.all([
            prisma.transaksiMasuk.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: includeMasuk,
            }),
            prisma.transaksiMasuk.count({ where }),
        ]);

        return { data: data.map(mapMasuk), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }),

    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
        const row = await prisma.transaksiMasuk.findUnique({ where: { id: input.id }, include: includeMasuk });
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "TransaksiMasuk not found" });
        return mapMasuk(row);
    }),

    create: transactionalProtectedProcedure.input(transaksiBaseInputSchema).mutation(async ({ ctx, input }) => {
        const { lokasiMasukId, lokasiKeluarId } = extractLokasi(input);
        if (lokasiKeluarId) throw new TRPCError({ code: "BAD_REQUEST", message: "Penerimaan tidak menggunakan lokasi keluar." });

        const created = await ctx.db.transaksiMasuk.create({
            data: {
                ...baseCreateData(input, ctx.user!.userId),
                lokasiMasukId,
            },
        });

        await logActivity(ctx.db, {
            action: "CREATE",
            userId: ctx.user!.userId,
            resource: "transaksi_masuk",
            resourceId: created.id,
            message: `Membuat transaksi masuk ${created.id}`,
            detail: {
                after: created,
            },
        });

        return created;
    }),

    update: transactionalProtectedProcedure
        .input(transaksiBaseInputSchema.extend({ id: z.string(), statusApproval: z.enum(statusApprovalValues) }))
        .mutation(async ({ ctx, input }) => {
            const { lokasiMasukId, lokasiKeluarId } = extractLokasi(input);
            if (lokasiKeluarId) throw new TRPCError({ code: "BAD_REQUEST", message: "Penerimaan tidak menggunakan lokasi keluar." });

            const existing = await ctx.db.transaksiMasuk.findUnique({ where: { id: input.id } });
            ensureDraftOnly(existing?.statusApproval ?? null, "TransaksiMasuk not found");

            const updated = await ctx.db.transaksiMasuk.update({
                where: { id: input.id },
                data: {
                    ...baseUpdateData(input),
                    lokasiMasukId,
                },
            });

            await logActivity(ctx.db, {
                action: "UPDATE",
                userId: ctx.user!.userId,
                resource: "transaksi_masuk",
                resourceId: updated.id,
                message: `Memperbarui transaksi masuk ${updated.id}`,
                detail: {
                    before: existing,
                    after: updated,
                },
            });

            return updated;
        }),

    delete: transactionalProtectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const before = await ctx.db.transaksiMasuk.findUnique({ where: { id: input.id } });
        if (!before) {
            throw new TRPCError({ code: "NOT_FOUND", message: "TransaksiMasuk not found" });
        }

        await ctx.db.transaksiMasuk.delete({ where: { id: input.id } });

        await logActivity(ctx.db, {
            action: "DELETE",
            userId: ctx.user!.userId,
            resource: "transaksi_masuk",
            resourceId: before.id,
            message: `Menghapus transaksi masuk ${before.id}`,
            detail: {
                before,
            },
        });

        return { success: true };
    }),

    approve: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.transaksiMasuk.findUnique({
                where: { id: input.id },
                select: { statusApproval: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.statusApproval ?? null, "TransaksiMasuk not found");

            const approved = await ctx.db.transaksiMasuk.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "DISETUJUI", input.message),
            });

            await logActivity(ctx.db, {
                action: "APPROVE",
                userId: ctx.user!.userId,
                resource: "transaksi_masuk",
                resourceId: approved.id,
                message: `Menyetujui transaksi masuk ${approved.id}`,
                detail: {
                    before: {
                        statusApproval: existing?.statusApproval ?? null,
                        approvalHistory: existing?.approvalHistory ?? null,
                    },
                    after: approved,
                    approvalMessage: input.message ?? null,
                },
            });

            return approved;
        }),

    reject: transactionalProtectedProcedure
        .input(z.object({ id: z.string(), message: z.string().optional() }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.transaksiMasuk.findUnique({
                where: { id: input.id },
                select: { statusApproval: true, approvalHistory: true },
            });
            ensureActionableApprovalStatus(existing?.statusApproval ?? null, "TransaksiMasuk not found");

            const rejected = await ctx.db.transaksiMasuk.update({
                where: { id: input.id },
                data: buildApprovalActionData(existing?.approvalHistory, ctx.user!, "DITOLAK", input.message),
            });

            await logActivity(ctx.db, {
                action: "REJECT",
                userId: ctx.user!.userId,
                resource: "transaksi_masuk",
                resourceId: rejected.id,
                message: `Menolak transaksi masuk ${rejected.id}`,
                detail: {
                    before: {
                        statusApproval: existing?.statusApproval ?? null,
                        approvalHistory: existing?.approvalHistory ?? null,
                    },
                    after: rejected,
                    rejectionMessage: input.message ?? null,
                },
            });

            return rejected;
        }),
});
