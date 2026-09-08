import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
    BackupError,
    appVersion,
    createBackup,
    deleteBackup,
    listBackups,
    readBackupContent,
    restoreBackup,
    saveBackupFromContent,
    type BackupErrorCode,
} from '../lib/backup-service.js';
import { logActivity } from '../lib/activity-log.js';
import { getMessage, type ServerLocale } from '../lib/locale.js';
import { hasPermission, protectedProcedure, router } from '../trpc.js';

const backupErrorMessageKeyByCode: Record<BackupErrorCode, string> = {
    NOT_FOUND: 'backup.notFound',
    INVALID_FORMAT: 'backup.invalidFormat',
    VERSION_MISMATCH: 'backup.versionMismatch',
};

const backupTRPCErrorCodeByCode: Record<BackupErrorCode, 'NOT_FOUND' | 'BAD_REQUEST' | 'CONFLICT'> = {
    NOT_FOUND: 'NOT_FOUND',
    INVALID_FORMAT: 'BAD_REQUEST',
    VERSION_MISMATCH: 'CONFLICT',
};

const backupErrorToTRPC = (error: unknown, locale: ServerLocale): TRPCError => {
    if (error instanceof BackupError) {
        return new TRPCError({
            code: backupTRPCErrorCodeByCode[error.code],
            message: getMessage(locale, backupErrorMessageKeyByCode[error.code]),
        });
    }

    throw error;
};

export const backupRouter = router({
    /** All backup files with meta info, plus the server's appVersion (the
     *  schemaVersion the server enforces — the client package version can drift,
     *  so the client must compare against THIS value, not its own). Requires backup@read. */
    list: protectedProcedure.use(hasPermission('backup@read')).query(async () => {
        return { backups: await listBackups(), appVersion };
    }),

    /** Dump every table to a new timestamped JSON backup. Requires backup@create. */
    create: protectedProcedure.use(hasPermission('backup@create')).mutation(async ({ ctx }) => {
        const info = await createBackup(ctx.db);

        await logActivity(ctx.db, {
            action: 'CREATE',
            userId: ctx.user.userId,
            resource: 'backup',
            resourceId: info.fileName,
            message: `Created backup ${info.fileName}`,
            detail: { schemaVersion: info.schemaVersion, tableCounts: info.tableCounts },
        });

        return info;
    }),

    /** Import an uploaded backup file (base64 of the JSON backup). Requires backup@create. */
    upload: protectedProcedure
        .use(hasPermission('backup@create'))
        .input(
            z.object({
                fileName: z.string().min(1).max(255).optional(),
                content: z.string().max(140_000_000),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const content = Buffer.from(input.content, 'base64').toString('utf8');

            let info;
            try {
                info = await saveBackupFromContent(content, input.fileName);
            } catch (error) {
                throw backupErrorToTRPC(error, ctx.locale);
            }

            await logActivity(ctx.db, {
                action: 'CREATE',
                userId: ctx.user.userId,
                resource: 'backup',
                resourceId: info.fileName,
                message: `Imported backup ${info.fileName}`,
                detail: { schemaVersion: info.schemaVersion, tableCounts: info.tableCounts },
            });

            return info;
        }),

    /** Destructive full-database restore from a backup file. Requires backup@restore. */
    restore: protectedProcedure
        .use(hasPermission('backup@restore'))
        .input(
            z.object({
                fileName: z.string().min(1),
                force: z.boolean().optional().default(false),
            })
        )
        // No shared `transactional` middleware — its 30s cap is too short for a
        // large restore, so this opens its own long-running transaction.
        .mutation(async ({ input, ctx }) => {
            try {
                await ctx.db.$transaction(
                    async (tx) => restoreBackup(tx, input.fileName, { force: input.force }),
                    { timeout: 300_000, maxWait: 10_000 }
                );
            } catch (error) {
                throw backupErrorToTRPC(error, ctx.locale);
            }

            await logActivity(ctx.db, {
                action: 'UPDATE',
                userId: ctx.user.userId,
                resource: 'backup',
                resourceId: input.fileName,
                message: `Restored database from backup ${input.fileName}${input.force ? ' (forced)' : ''}`,
                detail: { fileName: input.fileName, force: input.force },
            });

            return { success: true };
        }),

    /** Download a backup file as base64 (never served as a public static file). Requires backup@read. */
    download: protectedProcedure
        .use(hasPermission('backup@read'))
        .input(z.object({ fileName: z.string().min(1) }))
        .query(async ({ input, ctx }) => {
            let content: string;
            try {
                content = await readBackupContent(input.fileName);
            } catch (error) {
                throw backupErrorToTRPC(error, ctx.locale);
            }

            return { fileName: input.fileName, base64: Buffer.from(content, 'utf8').toString('base64') };
        }),

    /** Delete a backup file. Requires backup@delete. */
    delete: protectedProcedure
        .use(hasPermission('backup@delete'))
        .input(z.object({ fileName: z.string().min(1) }))
        .mutation(async ({ input, ctx }) => {
            try {
                await deleteBackup(input.fileName);
            } catch (error) {
                throw backupErrorToTRPC(error, ctx.locale);
            }

            await logActivity(ctx.db, {
                action: 'DELETE',
                userId: ctx.user.userId,
                resource: 'backup',
                resourceId: input.fileName,
                message: `Deleted backup ${input.fileName}`,
            });

            return { success: true };
        }),
});
