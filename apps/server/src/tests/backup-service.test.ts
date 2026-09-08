import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Prisma } from '../prisma/generated/client';
import type { DbClient } from '../lib/prisma';
import {
    BackupError,
    createBackup,
    deleteBackup,
    listBackups,
    readBackup,
    restoreBackup,
} from '../lib/backup-service';

const require = createRequire(import.meta.url);
const { version: APP_VERSION } = require('../../package.json') as { version: string };

const modelNames = Prisma.dmmf.datamodel.models.map((model) => model.name);
const delegateKey = (modelName: string) => modelName.charAt(0).toLowerCase() + modelName.slice(1);
const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');

// ---------------------------------------------------------------------------
// In-memory mock db: delegate per model, call log + per-model chunk sizes.
// ---------------------------------------------------------------------------

interface MockDb {
    db: DbClient;
    store: Record<string, Record<string, unknown>[]>;
    log: string[];
    createManySizes: Record<string, number[]>;
}

const createMockDb = (seed: Record<string, Record<string, unknown>[]> = {}): MockDb => {
    const store: Record<string, Record<string, unknown>[]> = {};
    for (const modelName of modelNames) {
        store[modelName] = (seed[modelName] ?? []).map((row) => ({ ...row }));
    }

    const log: string[] = [];
    const createManySizes: Record<string, number[]> = {};
    const delegates: Record<string, unknown> = {};

    for (const modelName of modelNames) {
        delegates[delegateKey(modelName)] = {
            findMany: async () => (store[modelName] ?? []).map((row) => ({ ...row })),
            deleteMany: async () => {
                log.push(`delete:${modelName}`);
                const count = store[modelName]?.length ?? 0;
                store[modelName] = [];
                return { count };
            },
            createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
                log.push(`create:${modelName}`);
                (createManySizes[modelName] ??= []).push(data.length);
                (store[modelName] ??= []).push(...data.map((row) => ({ ...row })));
                return { count: data.length };
            },
        };
    }

    return { db: delegates as unknown as DbClient, store, log, createManySizes };
};

// ---------------------------------------------------------------------------
// Direct file helpers (for crafted/corrupt backups).
// ---------------------------------------------------------------------------

const createdFiles: string[] = [];

const writeTestFile = async (fileName: string, content: string) => {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
    await fs.writeFile(path.join(BACKUPS_DIR, fileName), content, 'utf8');
    createdFiles.push(fileName);
};

afterAll(async () => {
    await Promise.all(createdFiles.map((fileName) => fs.rm(path.join(BACKUPS_DIR, fileName), { force: true })));
    await fs.rm(BACKUPS_DIR, { recursive: true, force: true }).catch(() => undefined);
    createdFiles.length = 0;
});

const validMeta = {
    schemaVersion: APP_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    tableCounts: {},
};

describe('backup-service', () => {
    it('createBackup dumps all 47 models with meta + fileName', async () => {
        const { db } = createMockDb({
            User: Array.from({ length: 250 }, (_, i) => ({ id: `u${i}`, email: `u${i}@x.tld` })),
            Role: [{ id: 'r1' }],
        });

        const result = await createBackup(db);
        createdFiles.push(result.fileName);

        expect(result.fileName).toMatch(/^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
        expect(result.schemaVersion).toBe(APP_VERSION);
        expect(result.createdAt).not.toBe('');
        expect(result.tableCounts.User).toBe(250);
        expect(result.tableCounts.Role).toBe(1);
        expect(Object.keys(result.tableCounts)).toEqual(modelNames);

        const parsed = JSON.parse(
            await fs.readFile(path.join(BACKUPS_DIR, result.fileName), 'utf8'),
        ) as { meta: unknown; data: Record<string, unknown[]> };
        expect(Object.keys(parsed.data)).toEqual(modelNames);
        expect(parsed.data.User).toHaveLength(250);
    });

    it('full lifecycle: create -> list -> read -> restore -> delete', async () => {
        const seed: Record<string, Record<string, unknown>[]> = {
            User: Array.from({ length: 250 }, (_, i) => ({ id: `u${i}` })),
            Role: [{ id: 'r1', name: 'admin' }],
        };
        const source = createMockDb(seed);
        const result = await createBackup(source.db);
        createdFiles.push(result.fileName);

        // list
        const list = await listBackups();
        const info = list.find((entry) => entry.fileName === result.fileName);
        expect(info).toBeDefined();
        expect(info?.schemaVersion).toBe(APP_VERSION);
        expect(info?.sizeBytes).toBeGreaterThan(0);
        expect(info?.tableCounts.User).toBe(250);

        // read
        const backup = await readBackup(result.fileName);
        expect(backup.meta.schemaVersion).toBe(APP_VERSION);
        expect(backup.data.User).toHaveLength(250);

        // restore into a fresh (populated, then wiped) db
        const target = createMockDb({ Role: [{ id: 'stale-role' }] });
        await restoreBackup(target.db, result.fileName);

        expect(target.store.User).toEqual(seed.User);
        expect(target.store.Role).toEqual(seed.Role);
        expect(target.store.PurchaseOrderItem).toEqual([]);

        const deletes = target.log.filter((entry) => entry.startsWith('delete:'));
        const creates = target.log.filter((entry) => entry.startsWith('create:'));
        // one deleteMany per model, in REVERSE schema order
        expect(deletes).toEqual([...modelNames].reverse().map((name) => `delete:${name}`));
        // createMany for non-empty models in schema order (one call per chunk)
        expect([...new Set(creates)]).toEqual(
            modelNames.filter((name) => seed[name]?.length).map((name) => `create:${name}`),
        );
        // chunked: 250 User rows -> 200 + 50
        expect(target.createManySizes.User).toEqual([200, 50]);
        expect(target.createManySizes.Role).toEqual([1]);

        // delete
        await deleteBackup(result.fileName);
        await expect(readBackup(result.fileName)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('restore wraps the work in $transaction when the client supports it', async () => {
        const { db } = createMockDb({ User: [{ id: 'u1' }] });
        const result = await createBackup(db);
        createdFiles.push(result.fileName);

        let transactionUsed = false;
        const target = createMockDb();
        const wrappedDb: DbClient = Object.assign(Object.create(target.db), {
            $transaction: async (work: (tx: DbClient) => Promise<void>) => {
                transactionUsed = true;
                await work(target.db);
            },
        });

        await restoreBackup(wrappedDb, result.fileName);
        expect(transactionUsed).toBe(true);
        expect(target.store.User).toEqual([{ id: 'u1' }]);
    });

    it('restore rejects version mismatch unless forced', async () => {
        const fileName = 'backup-version-mismatch.json';
        await writeTestFile(
            fileName,
            JSON.stringify({ meta: { ...validMeta, schemaVersion: '9.9.9' }, data: { User: [{ id: 'u1' }] } }),
        );

        const target = createMockDb({ Role: [{ id: 'stale' }] });
        await expect(restoreBackup(target.db, fileName)).rejects.toMatchObject({ code: 'VERSION_MISMATCH' });
        expect(target.log).toHaveLength(0);

        await restoreBackup(target.db, fileName, { force: true });
        expect(target.store.User).toEqual([{ id: 'u1' }]);
        expect(target.store.Role).toEqual([]);
    });

    it('restore rejects invalid format (unknown table, non-array rows, missing meta)', async () => {
        const unknownTable = 'backup-unknown-table.json';
        await writeTestFile(
            unknownTable,
            JSON.stringify({ meta: validMeta, data: { NotAModel: [] } }),
        );
        await expect(restoreBackup(createMockDb().db, unknownTable)).rejects.toMatchObject({
            code: 'INVALID_FORMAT',
        });

        const nonArrayRows = 'backup-non-array-rows.json';
        await writeTestFile(nonArrayRows, JSON.stringify({ meta: validMeta, data: { User: 'nope' } }));
        await expect(restoreBackup(createMockDb().db, nonArrayRows)).rejects.toMatchObject({
            code: 'INVALID_FORMAT',
        });

        const missingMeta = 'backup-missing-meta.json';
        await writeTestFile(missingMeta, JSON.stringify({ data: {} }));
        await expect(restoreBackup(createMockDb().db, missingMeta)).rejects.toMatchObject({
            code: 'INVALID_FORMAT',
        });
    });

    it('listBackups skips corrupt files gracefully', async () => {
        await writeTestFile('backup-corrupt.json', '{ not valid json');
        const list = await listBackups();
        expect(list.find((entry) => entry.fileName === 'backup-corrupt.json')).toBeUndefined();
    });

    it('listBackups extracts meta from a large file without full-parsing it', async () => {
        const fileName = 'backup-large-data.json';
        const meta = { ...validMeta, tableCounts: { User: 1 } };
        const content = JSON.stringify({ meta, data: { User: [{ blob: 'x'.repeat(2_000_000) }] } });
        await writeTestFile(fileName, content);

        const info = (await listBackups()).find((entry) => entry.fileName === fileName);
        expect(info).toBeDefined();
        expect(info?.schemaVersion).toBe(APP_VERSION);
        expect(info?.tableCounts.User).toBe(1);
        expect(info?.sizeBytes).toBe(Buffer.byteLength(content, 'utf8'));
    });

    it('listBackups lists a truncated file with a valid meta head (proves no full parse)', async () => {
        // The file never closes its data section, so a full JSON.parse would throw —
        // the meta can only come from the bounded head read.
        await writeTestFile(
            'backup-truncated.json',
            `{"meta":${JSON.stringify(validMeta)},"data":{"User":[${'x'.repeat(100_000)}`,
        );

        const info = (await listBackups()).find((entry) => entry.fileName === 'backup-truncated.json');
        expect(info).toBeDefined();
        expect(info?.schemaVersion).toBe(APP_VERSION);
        expect(info?.tableCounts).toEqual({});
        expect(info?.sizeBytes).toBeGreaterThan(0);
    });

    it('restore rejects rows that are not plain objects', async () => {
        const numberRow = 'backup-number-row.json';
        await writeTestFile(numberRow, JSON.stringify({ meta: validMeta, data: { User: [42] } }));
        await expect(restoreBackup(createMockDb().db, numberRow)).rejects.toMatchObject({
            code: 'INVALID_FORMAT',
        });

        const nullRow = 'backup-null-row.json';
        await writeTestFile(nullRow, JSON.stringify({ meta: validMeta, data: { User: [null] } }));
        await expect(restoreBackup(createMockDb().db, nullRow)).rejects.toMatchObject({
            code: 'INVALID_FORMAT',
        });

        const arrayRow = 'backup-array-row.json';
        await writeTestFile(arrayRow, JSON.stringify({ meta: validMeta, data: { User: [['u1']] } }));
        await expect(restoreBackup(createMockDb().db, arrayRow)).rejects.toMatchObject({
            code: 'INVALID_FORMAT',
        });
    });

    it('throws NOT_FOUND for missing and unsafe file names', async () => {
        await expect(readBackup('missing.json')).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(readBackup('../secret.json')).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(readBackup('sub/dir.json')).rejects.toMatchObject({ code: 'NOT_FOUND' });
        await expect(deleteBackup('missing.json')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('readBackup rejects unparsable JSON with INVALID_FORMAT', async () => {
        await writeTestFile('backup-unparsable.json', '{ not valid json');
        await expect(readBackup('backup-unparsable.json')).rejects.toMatchObject({
            code: 'INVALID_FORMAT',
        });
    });

    it('BackupError carries its code', () => {
        expect(new BackupError('NOT_FOUND', 'x').code).toBe('NOT_FOUND');
    });
});
