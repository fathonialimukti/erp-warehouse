import type { Response } from 'express';
import { Prisma } from '../prisma/generated/client';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

/**
 * System log sink: logs to console (pino) AND persists to the system_logs
 * table for the admin Log Viewer. DB writes are batched (flush every 2s or
 * 50 rows) and never throw — if the DB write fails, the entry is dropped
 * after a console warning so logging can never crash the server.
 *
 * Live tail: every persisted entry is fanned out to SSE subscribers on
 * /logs/stream. Console always receives every level; the DB stores only
 * entries at or above the `logs.dbMinLevel` setting (default: warn).
 */

export type SystemLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SystemLogInput {
    level: SystemLogLevel;
    source: 'http' | 'trpc' | 'app' | 'ai' | 'db' | 'mail' | 'rate-limit';
    message: string;
    requestId?: string;
    userId?: string | null;
    path?: string;
    method?: string;
    statusCode?: number;
    durationMs?: number;
    meta?: Record<string, unknown>;
}

const LEVEL_RANK: Record<SystemLogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/** Mirror of the logs.dbMinLevel setting — kept in sync by app-settings loads. */
const globalForLog = globalThis as unknown as { __systemLogDbMinLevel?: SystemLogLevel };
const dbMinLevel = (): SystemLogLevel => globalForLog.__systemLogDbMinLevel ?? 'warn';
export const setDbMinLevelMirror = (level: string): void => {
    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
        globalForLog.__systemLogDbMinLevel = level;
    }
};

interface PendingEntry {
    level: SystemLogLevel;
    source: string;
    message: string;
    requestId: string | null;
    userId: string | null;
    path: string | null;
    method: string | null;
    statusCode: number | null;
    durationMs: number | null;
    meta: Record<string, unknown> | null;
    createdAt: Date;
}

const MAX_BUFFER = 500;
const FLUSH_INTERVAL_MS = 2_000;
const FLUSH_BATCH_SIZE = 50;

const globalForQueue = globalThis as unknown as {
    __systemLogQueue?: PendingEntry[];
    __systemLogFlushTimer?: NodeJS.Timeout | null;
    __systemLogSubscribers?: Set<Response>;
};

const queue = (): PendingEntry[] => (globalForQueue.__systemLogQueue ??= []);
const subscribers = (): Set<Response> => (globalForQueue.__systemLogSubscribers ??= new Set());
let flushTimer: NodeJS.Timeout | null = globalForQueue.__systemLogFlushTimer ?? null;

function scheduleFlush(): void {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        globalForQueue.__systemLogFlushTimer = null;
        void flushSystemLogs();
    }, FLUSH_INTERVAL_MS);
    flushTimer.unref?.();
}

export async function flushSystemLogs(): Promise<void> {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
        globalForQueue.__systemLogFlushTimer = null;
    }
    if (queue().length === 0) return;

    const batch = queue().splice(0, queue().length);
    const PRISMA_LEVEL = { debug: 'DEBUG', info: 'INFO', warn: 'WARN', error: 'ERROR' } as const;
    try {
        await prisma.systemLog.createMany({
            data: batch.map((entry) => ({
                level: PRISMA_LEVEL[entry.level],
                source: entry.source,
                message: entry.message,
                requestId: entry.requestId ?? undefined,
                userId: entry.userId ?? undefined,
                path: entry.path ?? undefined,
                method: entry.method ?? undefined,
                statusCode: entry.statusCode ?? undefined,
                durationMs: entry.durationMs ?? undefined,
                meta: entry.meta ? (entry.meta as Prisma.InputJsonValue) : Prisma.DbNull,
                createdAt: entry.createdAt,
            })),
        });
    } catch (error) {
        // Never let log persistence break the app; report once per batch.
        logger.warn({ err: error, dropped: batch.length }, 'system-log: DB sink failed, entries dropped');
    }

    if (subscribers().size > 0) {
        const lines = batch
            .map((entry) => `data: ${JSON.stringify({ type: 'log', payload: serializeEntry(entry) })}\n\n`)
            .join('');
        for (const client of subscribers()) {
            try {
                client.write(lines);
            } catch {
                // closed connection — cleaned up by its own close handler
            }
        }
    }
}

const serializeEntry = (entry: PendingEntry) => ({
    id: null,
    level: entry.level.toUpperCase(),
    source: entry.source,
    message: entry.message,
    requestId: entry.requestId,
    userId: entry.userId,
    path: entry.path,
    method: entry.method,
    statusCode: entry.statusCode,
    durationMs: entry.durationMs,
    meta: entry.meta,
    createdAt: entry.createdAt.toISOString(),
});

export function logSystem(input: SystemLogInput): void {
    const { level, source, message, requestId, userId, path, method, statusCode, durationMs, meta } = input;

    // 1. Console — always, every level.
    const payload = { source, requestId, userId: userId ?? undefined, path, method, statusCode, durationMs, meta };
    if (level === 'error') logger.error(payload, message);
    else if (level === 'warn') logger.warn(payload, message);
    else if (level === 'info') logger.info(payload, message);
    else logger.debug(payload, message);

    // 2. DB sink — batched, gated by configured minimum level.
    if (LEVEL_RANK[level] >= LEVEL_RANK[dbMinLevel()]) {
        const entry: PendingEntry = {
            level,
            source,
            message,
            requestId: requestId ?? null,
            userId: userId ?? null,
            path: path ?? null,
            method: method ?? null,
            statusCode: statusCode ?? null,
            durationMs: durationMs ?? null,
            meta: meta ?? null,
            createdAt: new Date(),
        };
        queue().push(entry);
        if (queue().length > MAX_BUFFER) {
            queue().splice(0, queue().length - MAX_BUFFER);
        }
        if (queue().length >= FLUSH_BATCH_SIZE) {
            void flushSystemLogs();
        } else {
            scheduleFlush();
        }
    }
}

export const logSystemError = (input: Omit<SystemLogInput, 'level'>): void => logSystem({ ...input, level: 'error' });
export const logSystemWarn = (input: Omit<SystemLogInput, 'level'>): void => logSystem({ ...input, level: 'warn' });
export const logSystemInfo = (input: Omit<SystemLogInput, 'level'>): void => logSystem({ ...input, level: 'info' });

// ── Live tail (SSE) ──────────────────────────────────────────────────────────

export function subscribeLogStream(res: Response): void {
    subscribers().add(res);
}

export function unsubscribeLogStream(res: Response): void {
    subscribers().delete(res);
}

export function closeAllLogStreams(): void {
    for (const client of subscribers()) {
        try {
            client.end();
        } catch {
            // already closed
        }
    }
    subscribers().clear();
}

// ── Retention ────────────────────────────────────────────────────────────────

/** Delete rows older than the retention window. Returns deleted count. */
export async function purgeOldSystemLogs(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await prisma.systemLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return result.count;
}
