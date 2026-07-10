import { TRPCError } from '@trpc/server';
import type { DbClient } from './prisma.js';

/**
 * Pallet number format: YYMMDDXXXX
 *   YY    — 2-digit year (UTC)
 *   MM    — 2-digit month (UTC)
 *   DD    — 2-digit day (UTC)
 *   XXXX  — 4-digit zero-padded daily counter (global, across all warehouses)
 *
 * The counter is global per day — at most 9999 pallets can be created in a
 * single UTC day. If exceeded, a CONFLICT error is thrown.
 */

const DAILY_PALLET_LIMIT = 9999;

const formatPalletNumber = (date: Date, index: number): string => {
    const yy = String(date.getUTCFullYear()).slice(-2).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const paddedIndex = String(index).padStart(4, '0');
    return `${yy}${mm}${dd}${paddedIndex}`;
};

const parsePalletNumberIndex = (palletNumber: string): number => {
    // Last 4 characters are the index
    const suffix = palletNumber.slice(-4);
    const index = Number(suffix);
    return Number.isFinite(index) && index >= 0 ? index : 0;
};

const buildDailyPrefix = (date: Date): string => {
    const yy = String(date.getUTCFullYear()).slice(-2).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
};

/**
 * Returns the next pallet number for the given date.
 * The counter is global — one sequence per UTC day across all warehouses.
 *
 * Looks up the highest existing palletNumber with the same YYMMDD prefix and
 * increments. Must be called inside the transaction that creates the pallet
 * to avoid races (the unique index is the final guard).
 */
export const getNextPalletNumber = async (
    db: DbClient,
    date: Date,
): Promise<string> => {
    const prefix = buildDailyPrefix(date);

    const last = await db.pallet.findFirst({
        where: { palletNumber: { startsWith: prefix } },
        orderBy: { palletNumber: 'desc' },
        select: { palletNumber: true },
    });

    const lastIndex = last?.palletNumber ? parsePalletNumberIndex(last.palletNumber) : 0;
    const nextIndex = lastIndex + 1;

    if (nextIndex > DAILY_PALLET_LIMIT) {
        throw new TRPCError({
            code: 'CONFLICT',
            message: `Pallet daily limit reached (${DAILY_PALLET_LIMIT} pallets for ${prefix}). Cannot generate more pallet numbers today.`,
        });
    }

    return formatPalletNumber(date, nextIndex);
};
