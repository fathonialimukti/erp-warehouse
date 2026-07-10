/**
 * One-time backfill script: assigns YYMMDDXXXX pallet numbers to existing
 * pallets that have a NULL palletNumber.
 *
 * The YYMMDD prefix is derived from each pallet's `createdAt` (UTC). The XXXX
 * index is a per-day counter maintained in-memory, ordered by createdAt ASC
 * so the earliest pallet of a given day gets 0001.
 *
 * Usage: bun src/scripts/backfill-pallet-numbers.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

const DAILY_PALLET_LIMIT = 9999;

const formatPalletNumber = (date: Date, index: number): string => {
    const yy = String(date.getUTCFullYear()).slice(-2).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const paddedIndex = String(index).padStart(4, '0');
    return `${yy}${mm}${dd}${paddedIndex}`;
};

const buildDailyPrefix = (date: Date): string => {
    const yy = String(date.getUTCFullYear()).slice(-2).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
};

async function main() {
    const pallets = await prisma.pallet.findMany({
        where: { palletNumber: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true },
    });

    if (pallets.length === 0) {
        console.log('No pallets without palletNumber found. Nothing to backfill.');
        return;
    }

    console.log(`Backfilling ${pallets.length} pallets with YYMMDDXXXX numbers...`);

    // Per-day counter map: YYMMDD -> next index
    const dailyCounters = new Map<string, number>();
    let updated = 0;
    const perDayCounts = new Map<string, number>();

    for (const pallet of pallets) {
        const prefix = buildDailyPrefix(pallet.createdAt);
        const nextIndex = (dailyCounters.get(prefix) ?? 0) + 1;

        if (nextIndex > DAILY_PALLET_LIMIT) {
            throw new Error(
                `Daily pallet limit (${DAILY_PALLET_LIMIT}) exceeded for ${prefix}. ` +
                    `Cannot backfill pallet ${pallet.id}.`,
            );
        }

        dailyCounters.set(prefix, nextIndex);
        const palletNumber = formatPalletNumber(pallet.createdAt, nextIndex);

        await prisma.pallet.update({
            where: { id: pallet.id },
            data: { palletNumber },
        });

        updated++;
        perDayCounts.set(prefix, (perDayCounts.get(prefix) ?? 0) + 1);

        if (updated % 100 === 0) {
            console.log(`  ...${updated}/${pallets.length} done`);
        }
    }

    console.log(`\nBackfill complete. ${updated} pallets updated.`);
    console.log('\nPallets per day:');
    for (const [day, count] of Array.from(perDayCounts.entries()).sort()) {
        console.log(`  ${day}: ${count}`);
    }

    // Sanity check: no duplicates
    const duplicates = await prisma.pallet.groupBy({
        by: ['palletNumber'],
        where: { palletNumber: { not: null } },
        _count: { palletNumber: true },
        having: { palletNumber: { _count: { gt: 1 } } },
    });
    if (duplicates.length > 0) {
        console.error(`\nERROR: ${duplicates.length} duplicate pallet numbers detected!`);
        for (const dup of duplicates) {
            console.error(`  ${dup.palletNumber}: ${dup._count.palletNumber} rows`);
        }
        process.exit(1);
    } else {
        console.log('\nNo duplicate pallet numbers detected. ✓');
    }
}

main()
    .catch((err) => {
        console.error('Backfill failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
