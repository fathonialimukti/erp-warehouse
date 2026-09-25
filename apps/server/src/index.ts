import express, { type NextFunction, type Request, type Response } from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import cors from 'cors';
import helmet from 'helmet';
import { createContext } from './context.js';
import { serveUpload } from './lib/upload-file.js';
import { appRouter } from './router.js';
import { sseManager } from './lib/sse-manager.js';
import { prisma } from './lib/prisma.js';
import { authenticateRequestRevocable, extractToken, verifyToken } from './lib/auth-middleware.js';
import { logger } from './lib/logger.js';
import { aiChatHandler, aiChatResumeHandler, aiQueryDatabaseHandler } from './routes/ai.js';
import { aiAdminChatHandler, aiAdminChatResumeHandler, aiAdminQueryHandler } from './routes/ai-admin.js';
import { randomBytes } from 'node:crypto';
import { validateEnv } from './lib/env.js';
import { requestContextMiddleware, getRequestContext } from './lib/request-context.js';
import { createCsrfMiddleware } from './middleware/csrf.js';
import { logSystemError, logSystemInfo, logSystemWarn, flushSystemLogs, subscribeLogStream, unsubscribeLogStream, closeAllLogStreams, purgeOldSystemLogs } from './lib/system-log.js';
import { getRawSettings, getNumberSetting } from './lib/app-settings.js';
import { maybeSendMonthlyReport } from './lib/report-email.js';
import { smartRateLimit } from './middleware/smart-rate-limit.js';

validateEnv();

const port = Number(process.env.PORT ?? 10012);
const isDev = process.env.NODE_ENV !== 'production';

// Comma-separated allowed origins in production (CORS_ORIGIN).
// Default: the client app domain.
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'https://erp-warehouse.aetherglo.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

logger.info({ port }, 'Starting tRPC server');

const app = express();
app.disable('x-powered-by');

// Request-ID correlation — first middleware so every log line can carry it.
app.use(requestContextMiddleware);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            // Allow any localhost origin only in development
            if (isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
            if (isDev) return callback(null, true);

            return callback(new Error(`CORS blocked: ${origin}`));
        },
        credentials: true,
    })
);

// Large body limit ONLY for the backup.upload route: it posts base64 content up
// to 140M chars (~105MB binary) in one JSON body. A global 150mb parser would let
// ANY unauthenticated request buffer 150MB of JSON before CSRF/auth — a memory
// DoS. body-parser skips already-parsed bodies (req._body), so the global 5mb
// parser below is a no-op for this route. httpBatchLink can batch several
// procedures into one POST whose path joins names with commas — the regex must
// match the WHOLE path (Express 5 applies use-mounted regexes only when the
// match ends at a path boundary), so cover backup.upload alone, first in a
// batch, or after other procedures.
app.use(/^\/trpc\/(.*,)?backup\.upload(,[^/]*)?$/, express.json({ limit: '150mb' }));
app.use(express.json({ limit: '5mb' }));
app.use(helmet());
app.use(serveUpload);

// ── Rate limiting (settings-driven, makes requests wait before failing) ─────
app.use('/trpc/auth.login', smartRateLimit('auth'));
app.use('/api/ai/', smartRateLimit('ai'));
app.use(['/trpc', '/api/'], smartRateLimit('general'));

// ── HTTP access log (console; warn/error also persisted to system_logs) ─────
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const auth = verifyToken(extractToken(req) ?? '');
    const ctx = getRequestContext();
    if (ctx) ctx.userId = auth?.userId ?? null;

    res.on('finish', () => {
        if (req.path === '/health') return;
        const durationMs = Date.now() - start;
        const statusCode = res.statusCode;
        const base = {
            requestId: ctx?.requestId,
            userId: auth?.userId,
            path: req.originalUrl,
            method: req.method,
            statusCode,
            durationMs,
        };
        const message = `${req.method} ${req.originalUrl} ${statusCode} ${durationMs}ms`;
        if (statusCode >= 500) {
            logSystemError({ source: 'http', message, ...base });
        } else if (statusCode >= 400) {
            logSystemWarn({ source: 'http', message, ...base });
        } else {
            void getRawSettings().then((raw) => {
                if (raw['logs.httpRequestsEnabled'] === 'true') {
                    logSystemInfo({ source: 'http', message, ...base });
                }
            });
        }
    });
    next();
});

// Double-submit CSRF validation for mutating requests (see middleware/csrf.ts:
// skips unauthenticated requests, accepts allowlisted-Origin first-party
// requests whose in-memory token is missing, otherwise requires the
// `x-csrf-token` header to equal the `csrf_token` cookie).
app.use(createCsrfMiddleware(allowedOrigins));

// SSE endpoint for real-time notification delivery
app.get('/notifications/stream', async (req, res) => {
    const auth = await authenticateRequestRevocable(req);
    if (!auth) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const userId = auth.userId;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.write('data: {"type":"connected"}\n\n');

    sseManager.subscribe(userId, res);

    const pingInterval = setInterval(() => {
        res.write(': ping\n\n');
    }, 30_000);

    req.on('close', () => {
        clearInterval(pingInterval);
        sseManager.unsubscribe(userId, res);
    });
});

// SSE endpoint for the admin log viewer live tail
const userHasLogReadPermission = async (userId: string): Promise<boolean> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    const permissions = user?.role?.permissions.map((rp) => rp.permission.name) ?? [];
    return permissions.some((p) => p === 'log@read' || p === 'log@*' || p === '*');
};

app.get('/logs/stream', async (req, res) => {
    const auth = await authenticateRequestRevocable(req);
    if (!auth) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const allowed = await userHasLogReadPermission(auth.userId).catch(() => false);
    if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.write('data: {"type":"connected"}\n\n');
    subscribeLogStream(res);

    const pingInterval = setInterval(() => {
        res.write(': ping\n\n');
    }, 30_000);

    req.on('close', () => {
        clearInterval(pingInterval);
        unsubscribeLogStream(res);
    });
});

app.use(
    '/trpc',
    createExpressMiddleware({
        router: appRouter,
        createContext,
        onError: ({ error, path, ctx }) => {
            const isServerError = error.code === 'INTERNAL_SERVER_ERROR';
            const base = {
                requestId: getRequestContext()?.requestId,
                userId: ctx?.user?.userId,
                path: `/trpc/${path}`,
                statusCode: isServerError ? 500 : 400,
                meta: { code: error.code },
            };
            const message = `tRPC ${error.code} on ${path}: ${error.message}`;
            if (isServerError) {
                logSystemError({ source: 'trpc', message, meta: { ...base.meta, stack: error.stack } , requestId: base.requestId, userId: base.userId, path: base.path, statusCode: base.statusCode });
            } else {
                logSystemWarn({ source: 'trpc', message, requestId: base.requestId, userId: base.userId, path: base.path, statusCode: base.statusCode, meta: base.meta });
            }
        },
    })
);

app.post('/api/ai/chat', aiChatHandler);
app.get('/api/ai/chat/:chatId/stream', aiChatResumeHandler);
app.post('/api/ai/query', aiQueryDatabaseHandler);

app.post('/api/ai/admin/chat', aiAdminChatHandler);
app.get('/api/ai/admin/chat/:chatId/stream', aiAdminChatResumeHandler);
app.post('/api/ai/admin/query', aiAdminQueryHandler);

// CSRF token endpoint (double-submit cookie pattern). GET skips the CSRF
// middleware (safe method), so this doubles as the refresh path: on a
// `CSRF_TOKEN_INVALID` 403 the client refetches here and retries once.
app.get('/api/csrf', (_req, res) => {
    const token = randomBytes(32).toString('hex');
    // Never cache: each response carries a fresh token.
    res.setHeader('Cache-Control', 'no-store');
    res.cookie('csrf_token', token, {
        httpOnly: false,
        // Lax (not strict) to match the auth cookie: the production client
        // and API live on different subdomains, and Tauri webviews don't
        // reliably persist strict cookies — strict meant the cookie never
        // arrived back, failing every double-submit check.
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        // Express maxAge is milliseconds (was 60*60*24 = ~86s, expiring the
        // cookie almost immediately and 403ing all later mutations).
        maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ token });
});

app.get('/health', async (_req, res) => {
    let dbOk = true;
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch {
        dbOk = false;
    }
    res.status(dbOk ? 200 : 503).json({ status: dbOk ? 'ok' : 'degraded', db: dbOk, uptime: process.uptime() });
});

// 404 catch-all for unknown API routes
app.use((req, res) => {
    if (req.path.startsWith('/trpc') || req.path.startsWith('/api') || req.path.startsWith('/notifications') || req.path.startsWith('/logs')) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    res.status(404).json({ error: 'Not found' });
});

// Global Express error handler — logs and returns a safe 500.
app.use((err: Error & { status?: number }, req: Request, res: Response) => {
    const ctx = getRequestContext();
    logSystemError({
        source: 'http',
        message: `Unhandled error: ${err.message}`,
        requestId: ctx?.requestId,
        path: req.originalUrl,
        method: req.method,
        statusCode: 500,
        meta: { stack: err.stack, name: err.name },
    });
    if (res.headersSent) return;
    res.status(err.status && Number.isInteger(err.status) ? err.status : 500).json({ error: 'Internal server error' });
});

const server = app.listen(port, '0.0.0.0');
// 10 min: backup restore runs a server-side transaction of up to 300s (see
// backupRouter.restore) and large backup downloads/uploads also take minutes —
// a short idle-socket timeout destroys the client's connection mid-request
// (ECONNRESET) while the server keeps working. Must stay >= the 300s restore cap.
server.setTimeout(600_000);
logger.info({ port }, 'tRPC server listening');

// ── Log retention: purge rows older than logs.retentionDays every 6 hours ───
const retentionTimer = setInterval(() => {
    void (async () => {
        const days = await getNumberSetting('logs.retentionDays');
        const deleted = await purgeOldSystemLogs(days);
        if (deleted > 0) {
            logSystemInfo({ source: 'app', message: `system_logs retention purge: removed ${deleted} rows (>${days}d)` });
        }
    })().catch((error) => logger.warn({ err: error }, 'system-log retention purge failed'));
}, 6 * 60 * 60 * 1000);
retentionTimer.unref?.();

// ── Scheduled email reports: checked hourly, sent once per configured month-day
const reportTimer = setInterval(() => {
    void maybeSendMonthlyReport();
}, 60 * 60 * 1000);
reportTimer.unref?.();
setTimeout(() => void maybeSendMonthlyReport(), 30_000).unref?.();

const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    clearInterval(retentionTimer);
    clearInterval(reportTimer);
    server.close(() => {
        logger.info('HTTP server closed');
    });
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10_000).unref();
    try {
        await flushSystemLogs();
    } catch {
        // best effort
    }
    await prisma.$disconnect();
    sseManager.closeAll();
    closeAllLogStreams();
    process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    logSystemError({
        source: 'app',
        message: `Unhandled promise rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
        meta: { stack: reason instanceof Error ? reason.stack : undefined },
    });
});

process.on('uncaughtException', (error) => {
    logSystemError({
        source: 'app',
        message: `Uncaught exception: ${error.message}`,
        meta: { stack: error.stack },
    });
    void shutdown('uncaughtException');
});
