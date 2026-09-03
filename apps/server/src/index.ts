import express, { type Request, type Response, type NextFunction } from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createContext } from './context.js';
import { serveUpload } from './lib/upload-file.js';
import { appRouter } from './router.js';
import { sseManager } from './lib/sse-manager.js';
import { prisma } from './lib/prisma.js';
import { authenticateRequest } from './lib/auth-middleware.js';
import { logger } from './lib/logger.js';
import { aiChatHandler, aiChatResumeHandler, aiQueryDatabaseHandler } from './routes/ai.js';
import { aiAdminChatHandler, aiAdminChatResumeHandler, aiAdminQueryHandler } from './routes/ai-admin.js';
import { randomBytes } from 'node:crypto';
import { parse as parseCookie } from 'cookie';
import { validateEnv } from './lib/env.js';

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

app.use(express.json({ limit: '5mb' }));
app.use(helmet());
app.use(serveUpload);

// General API rate limit
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter limit for AI endpoints (expensive LLM calls)
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 AI requests per minute
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', generalLimiter);
app.use('/api/ai/', aiLimiter);

// Double-submit CSRF validation for mutating requests
const validateCsrf = (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const token = req.headers['x-csrf-token'];
        const cookies = parseCookie(req.headers.cookie ?? '');
        const cookieToken = cookies.csrf_token;
        if (!token || !cookieToken || token !== cookieToken) {
            res.status(403).json({ error: 'Invalid CSRF token' });
            return;
        }
    }
    next();
};

app.use(validateCsrf);

// SSE endpoint for real-time notification delivery
app.get('/notifications/stream', (req, res) => {
    const auth = authenticateRequest(req);
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

app.use(
    '/trpc',
    createExpressMiddleware({
        router: appRouter,
        createContext,
    })
);

app.post('/api/ai/chat', aiChatHandler);
app.get('/api/ai/chat/:chatId/stream', aiChatResumeHandler);
app.post('/api/ai/query', aiQueryDatabaseHandler);

app.post('/api/ai/admin/chat', aiAdminChatHandler);
app.get('/api/ai/admin/chat/:chatId/stream', aiAdminChatResumeHandler);
app.post('/api/ai/admin/query', aiAdminQueryHandler);

// CSRF token endpoint (double-submit cookie pattern)
app.get('/api/csrf', (_req, res) => {
    const token = randomBytes(32).toString('hex');
    res.cookie('csrf_token', token, {
        httpOnly: false,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24,
    });
    res.json({ token });
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

const server = app.listen(port, '0.0.0.0');
server.setTimeout(30_000); // 30 seconds
logger.info({ port }, 'tRPC server listening');

const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(() => {
        logger.info('HTTP server closed');
    });
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10_000).unref();
    await prisma.$disconnect();
    sseManager.closeAll();
    process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
