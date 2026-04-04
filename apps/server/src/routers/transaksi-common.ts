import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const statusApprovalValues = [
    "DRAFT",
    "MENUNGGU",
    "DISETUJUI",
    "DITOLAK",
    "BATAL",
] as const;

export const transaksiBaseInputSchema = z.object({
    paletId: z.string().min(1, "Palet is required"),
    qtyPalet: z.coerce.number().int().min(1, "Qty palet must be greater than 0").default(1),
    lokasiMasukId: z.string().optional(),
    lokasiKeluarId: z.string().optional(),
    tanggal: z.coerce.date().optional(),
    keterangan: z.string().optional(),
    referensi: z.string().optional(),
    jenisTemuan: z.string().optional(),
    alasanKehilangan: z.string().optional(),
    nilaiEstimasi: z.coerce.number().int().nonnegative().optional(),
    alasanPemindahan: z.string().optional(),
    approvalHistory: z
        .array(
            z.object({
                process: z.string(),
                userName: z.string(),
                timeframe: z.string(),
                message: z.string().default(""),
            }),
        )
        .optional(),
});

export type StatusApproval = (typeof statusApprovalValues)[number];

export const transaksiSortFieldValues = [
    "tanggal",
    "statusApproval",
    "lokasiMasuk",
    "lokasiKeluar",
    "createdBy",
    "paletCode",
] as const;

export const transaksiSortDirectionValues = ["asc", "desc"] as const;

export type TransaksiSortField = (typeof transaksiSortFieldValues)[number];
export type TransaksiSortDirection = (typeof transaksiSortDirectionValues)[number];

export type TransaksiPalet = {
    id: string;
    jenisPalet: {
        nama: string;
        namaKemasan: string;
        kemasanPerPalet: number;
        isiPerKemasan: number;
        satuanPerKemasan: string;
    } | null;
};

export type TransaksiLokasi = {
    kode: string;
} | null;

export type TransaksiUser = {
    name: string | null;
    email: string;
};

export type TransaksiRow = {
    id: string;
    paletId: string;
    qtyPalet: number;
    jenisTransaksi: "PENERIMAAN" | "PENGELUARAN" | "TEMUAN" | "KEHILANGAN" | "PEMINDAHAN";
    lokasiMasukId: string | null;
    lokasiKeluarId: string | null;
    tanggal: Date;
    referensi: string | null;
    keterangan: string | null;
    approvalHistory: Array<{
        process: string;
        userName: string;
        timeframe: string;
        message: string;
    }>;
    statusApproval: StatusApproval;
    palet: TransaksiPalet;
    lokasiMasuk: TransaksiLokasi;
    lokasiKeluar: TransaksiLokasi;
    createdBy: TransaksiUser;
    approvedBy: TransaksiUser | null;
    approvedAt: Date | null;
    jenisTemuan: string | null;
    alasanKehilangan: string | null;
    nilaiEstimasi: number | null;
    alasanPemindahan: string | null;
    qtyKemasanTotal: number | null;
    qtySatuanDasarTotal: number | null;
    namaKemasan: string | null;
    satuanPerKemasan: string | null;
    approvalRequest: {
        currentLevel: number;
    } | null;
};

export const listInputSchema = z
    .object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        statusApproval: z.enum(statusApprovalValues).optional(),
        paletId: z.string().optional(),
        paletCode: z.string().optional(),
        createdBy: z.string().optional(),
        search: z.string().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        sortBy: z.enum(transaksiSortFieldValues).optional(),
        sortDirection: z.enum(transaksiSortDirectionValues).optional(),
    })
    .optional();

const normalizeOptionalId = (value?: string) => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
};

const normalizeOptionalText = (value?: string) => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
};

export const extractLokasi = (input: z.infer<typeof transaksiBaseInputSchema>) => ({
    lokasiMasukId: normalizeOptionalId(input.lokasiMasukId),
    lokasiKeluarId: normalizeOptionalId(input.lokasiKeluarId),
});

export const baseCreateData = (
    input: z.infer<typeof transaksiBaseInputSchema>,
    createdById: string,
) => ({
    paletId: input.paletId,
    qtyPalet: input.qtyPalet,
    tanggal: input.tanggal ?? new Date(),
    referensi: normalizeOptionalText(input.referensi),
    keterangan: normalizeOptionalText(input.keterangan),
    approvalHistory: input.approvalHistory ?? [],
    statusApproval: "DRAFT" as const,
    createdById,
});

export const baseUpdateData = (
    input: z.infer<typeof transaksiBaseInputSchema> & { statusApproval: StatusApproval },
) => ({
    paletId: input.paletId,
    qtyPalet: input.qtyPalet,
    tanggal: input.tanggal ?? new Date(),
    referensi: normalizeOptionalText(input.referensi),
    keterangan: normalizeOptionalText(input.keterangan),
    approvalHistory: input.approvalHistory ?? [],
    statusApproval: input.statusApproval,
});

export const extractDomainFields = (input: z.infer<typeof transaksiBaseInputSchema>) => ({
    jenisTemuan: normalizeOptionalText(input.jenisTemuan),
    alasanKehilangan: normalizeOptionalText(input.alasanKehilangan),
    nilaiEstimasi: input.nilaiEstimasi ?? null,
    alasanPemindahan: normalizeOptionalText(input.alasanPemindahan),
});

export const buildListWhere = (
    input?: z.infer<typeof listInputSchema>,
    options?: {
        hasLokasiMasuk?: boolean;
        hasLokasiKeluar?: boolean;
    },
) => {
    const hasLokasiMasuk = options?.hasLokasiMasuk ?? false;
    const hasLokasiKeluar = options?.hasLokasiKeluar ?? false;
    const search = input?.search?.trim();
    const andConditions: Record<string, unknown>[] = [];

    if (input?.statusApproval) {
        andConditions.push({ statusApproval: input.statusApproval });
    }

    if (input?.paletId) {
        andConditions.push({ paletId: input.paletId });
    }

    if (input?.paletCode?.trim()) {
        andConditions.push({
            palet: { id: { contains: input.paletCode.trim(), mode: "insensitive" as const } },
        });
    }

    if (input?.createdBy?.trim()) {
        const createdBySearch = input.createdBy.trim();
        andConditions.push({
            OR: [
                { createdBy: { name: { contains: createdBySearch, mode: "insensitive" as const } } },
                { createdBy: { email: { contains: createdBySearch, mode: "insensitive" as const } } },
            ],
        });
    }

    if (input?.dateFrom || input?.dateTo) {
        const tanggal: Record<string, Date> = {};
        if (input?.dateFrom) {
            tanggal.gte = input.dateFrom;
        }
        if (input?.dateTo) {
            tanggal.lte = input.dateTo;
        }
        andConditions.push({ tanggal });
    }

    if (!search) {
        return andConditions.length ? { AND: andConditions } : {};
    }

    const orConditions: Record<string, unknown>[] = [
        { palet: { id: { contains: search, mode: "insensitive" as const } } },
        { referensi: { contains: search, mode: "insensitive" as const } },
        { keterangan: { contains: search, mode: "insensitive" as const } },
        { createdBy: { name: { contains: search, mode: "insensitive" as const } } },
        { createdBy: { email: { contains: search, mode: "insensitive" as const } } },
    ];

    if (hasLokasiMasuk) {
        orConditions.push({ lokasiMasuk: { kode: { contains: search, mode: "insensitive" as const } } });
    }

    if (hasLokasiKeluar) {
        orConditions.push({ lokasiKeluar: { kode: { contains: search, mode: "insensitive" as const } } });
    }

    andConditions.push({ OR: orConditions });

    return {
        AND: andConditions,
    };
};

export const buildOrderBy = (
    sortBy?: TransaksiSortField,
    sortDirection: TransaksiSortDirection = "desc",
    options?: {
        hasLokasiMasuk?: boolean;
        hasLokasiKeluar?: boolean;
    },
) => {
    switch (sortBy) {
        case "statusApproval":
            return { statusApproval: sortDirection };
        case "createdBy":
            return { createdBy: { name: sortDirection } };
        case "paletCode":
            return { palet: { id: sortDirection } };
        case "lokasiMasuk":
            if (options?.hasLokasiMasuk) {
                return { lokasiMasuk: { kode: sortDirection } };
            }
            break;
        case "lokasiKeluar":
            if (options?.hasLokasiKeluar) {
                return { lokasiKeluar: { kode: sortDirection } };
            }
            break;
        case "tanggal":
        default:
            return { tanggal: sortDirection };
    }

    return { tanggal: "desc" as const };
};

export const ensureDraftOnly = (statusApproval: StatusApproval | null, notFoundMessage: string) => {
    if (statusApproval === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: notFoundMessage });
    }
    if (statusApproval !== "DRAFT") {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Hanya transaksi dengan status DRAFT yang dapat diubah.",
        });
    }
};

export const ensureActionableApprovalStatus = (statusApproval: StatusApproval | null, notFoundMessage: string) => {
    if (statusApproval === null) {
        throw new TRPCError({ code: "NOT_FOUND", message: notFoundMessage });
    }

    if (["DISETUJUI", "DITOLAK", "BATAL"].includes(statusApproval)) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Hanya transaksi DRAFT atau MENUNGGU yang dapat diproses approval.",
        });
    }
};

export const buildApprovalActionData = (
    approvalHistory: unknown,
    user: { userId: string; name: string | null; email: string },
    statusApproval: Extract<StatusApproval, "DISETUJUI" | "DITOLAK">,
    message?: string,
) => {
    const history = Array.isArray(approvalHistory) ? approvalHistory : [];
    const timestamp = new Date();

    return {
        statusApproval,
        approvedById: user.userId,
        approvedAt: timestamp,
        approvalHistory: [
            ...history,
            {
                process: statusApproval === "DISETUJUI" ? "approval" : "rejection",
                userName: user.name ?? user.email,
                timeframe: timestamp.toISOString(),
                message: message?.trim() ?? "",
            },
        ],
    };
};

export const computePackagingTotals = (
    qtyPalet: number,
    config?: {
        kemasanPerPalet?: number | null;
        isiPerKemasan?: number | null;
    } | null,
) => {
    if (!config?.kemasanPerPalet || !config?.isiPerKemasan) {
        return {
            qtyKemasanTotal: null,
            qtySatuanDasarTotal: null,
        };
    }

    const qtyKemasanTotal = qtyPalet * config.kemasanPerPalet;
    const qtySatuanDasarTotal = qtyKemasanTotal * config.isiPerKemasan;

    return {
        qtyKemasanTotal,
        qtySatuanDasarTotal,
    };
};

export const buildQtyBreakdownFromSatuanDasar = (
    qtySatuanDasarTotal: number,
    config?: {
        kemasanPerPalet?: number | null;
        isiPerKemasan?: number | null;
    } | null,
) => {
    if (!config?.kemasanPerPalet || !config?.isiPerKemasan) {
        return {
            qtyPalet: null,
            qtyKemasan: null,
            qtySatuanDasarRemainder: qtySatuanDasarTotal,
        };
    }

    const satuanPerPalet = config.kemasanPerPalet * config.isiPerKemasan;
    const qtyPalet = Math.floor(qtySatuanDasarTotal / satuanPerPalet);
    const sisaSetelahPalet = qtySatuanDasarTotal % satuanPerPalet;
    const qtyKemasan = Math.floor(sisaSetelahPalet / config.isiPerKemasan);
    const qtySatuanDasarRemainder = sisaSetelahPalet % config.isiPerKemasan;

    return {
        qtyPalet,
        qtyKemasan,
        qtySatuanDasarRemainder,
    };
};
