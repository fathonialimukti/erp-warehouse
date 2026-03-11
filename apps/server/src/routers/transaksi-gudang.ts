import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { protectedProcedure, router } from "../trpc.js";

const transaksiJenisValues = [
    "PENERIMAAN",
    "PENEMPATAN",
    "PENGELUARAN",
    "TEMUAN",
    "KEHILANGAN",
    "PEMINDAHAN",
] as const;

const statusApprovalValues = [
    "DRAFT",
    "MENUNGGU",
    "DISETUJUI",
    "DITOLAK",
    "BATAL",
] as const;

export const transaksiGudangRouter = router({
    list: protectedProcedure
        .input(
            z
                .object({
                    page: z.number().min(1).default(1),
                    limit: z.number().min(1).max(100).default(10),
                    jenisTransaksi: z.enum(transaksiJenisValues).optional(),
                    statusApproval: z.enum(statusApprovalValues).optional(),
                    paletId: z.string().optional(),
                })
                .optional()
        )
        .query(async ({ input }) => {
            const page = input?.page ?? 1;
            const limit = input?.limit ?? 10;
            const skip = (page - 1) * limit;

            const where = {
                ...(input?.jenisTransaksi ? { jenisTransaksi: input.jenisTransaksi } : {}),
                ...(input?.statusApproval ? { statusApproval: input.statusApproval } : {}),
                ...(input?.paletId ? { paletId: input.paletId } : {}),
            };

            const [data, total] = await Promise.all([
                prisma.transaksiGudang.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { tanggalWaktu: "desc" },
                    include: {
                        palet: true,
                        lokasiAsal: true,
                        lokasiTujuan: true,
                        user: true,
                        approvalRequest: true,
                    },
                }),
                prisma.transaksiGudang.count({ where }),
            ]);

            return {
                data,
                meta: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }),

    detail: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
            const transaksi = await prisma.transaksiGudang.findUnique({
                where: { id: input.id },
                include: {
                    palet: true,
                    lokasiAsal: true,
                    lokasiTujuan: true,
                    user: true,
                    approvalRequest: {
                        include: { steps: true },
                    },
                },
            });

            if (!transaksi) {
                throw new Error("TransaksiGudang not found");
            }

            return transaksi;
        }),

    create: protectedProcedure
        .input(
            z.object({
                paletId: z.string().min(1, "Palet is required"),
                jenisTransaksi: z.enum(transaksiJenisValues),
                lokasiAsalId: z.string().optional(),
                lokasiTujuanId: z.string().optional(),
                tanggalWaktu: z.coerce.date().optional(),
                keterangan: z.string().optional(),
                referensi: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            return prisma.transaksiGudang.create({
                data: {
                    paletId: input.paletId,
                    jenisTransaksi: input.jenisTransaksi,
                    lokasiAsalId: input.lokasiAsalId ?? null,
                    lokasiTujuanId: input.lokasiTujuanId ?? null,
                    tanggalWaktu: input.tanggalWaktu ?? new Date(),
                    userId: ctx.user.userId,
                    keterangan: input.keterangan ?? null,
                    referensi: input.referensi ?? null,
                    statusApproval: "DRAFT",
                },
            });
        }),

    update: protectedProcedure
        .input(
            z.object({
                id: z.string(),
                paletId: z.string().min(1, "Palet is required"),
                jenisTransaksi: z.enum(transaksiJenisValues),
                lokasiAsalId: z.string().optional(),
                lokasiTujuanId: z.string().optional(),
                tanggalWaktu: z.coerce.date().optional(),
                keterangan: z.string().optional(),
                referensi: z.string().optional(),
                statusApproval: z.enum(statusApprovalValues),
            })
        )
        .mutation(async ({ input }) => {
            return prisma.transaksiGudang.update({
                where: { id: input.id },
                data: {
                    paletId: input.paletId,
                    jenisTransaksi: input.jenisTransaksi,
                    lokasiAsalId: input.lokasiAsalId ?? null,
                    lokasiTujuanId: input.lokasiTujuanId ?? null,
                    tanggalWaktu: input.tanggalWaktu ?? new Date(),
                    keterangan: input.keterangan ?? null,
                    referensi: input.referensi ?? null,
                    statusApproval: input.statusApproval,
                },
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            await prisma.transaksiGudang.delete({
                where: { id: input.id },
            });

            return { success: true };
        }),
});
