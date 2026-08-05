import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import cors from 'cors';
import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { createContext } from './context.js';
import { serveUpload } from './lib/upload-file.js';
import { appRouter } from './router.js';
import { sseManager } from './lib/sse-manager.js';
import { aiChatHandler, aiChatResumeHandler, aiQueryDatabaseHandler } from './routes/ai.js';
import { aiAdminChatHandler, aiAdminChatResumeHandler, aiAdminQueryHandler } from './routes/ai-admin.js';

const port = Number(process.env.PORT ?? 10012);
const isDev = process.env.NODE_ENV !== 'production';

// Comma-separated allowed origins in production (CORS_ORIGIN).
// Default: the client app domain.
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'https://erp-warehouse.aetherglo.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

console.log('Starting tRPC server on port', port);

const app = express();

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            if (isDev) return callback(null, true);

            return callback(new Error(`CORS blocked: ${origin}`));
        },
        credentials: true,
    })
);

app.use(express.json({ limit: '10mb' }));
app.use(serveUpload);

// SSE endpoint for real-time notification delivery
app.get('/notifications/stream', (req, res) => {
    let token: string | null = null;
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        const cookies = parseCookie(cookieHeader);
        if (cookies.access_token) token = cookies.access_token;
    }
    if (!token) {
        const auth = req.headers.authorization;
        if (auth?.startsWith('Bearer ')) token = auth.slice('Bearer '.length);
    }
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    let userId: string;
    try {
        const jwtSecret = process.env.JWT_SECRET ?? 'your-secret-key-change-this';
        const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
        if (!payload?.userId) throw new Error('Invalid token');
        userId = String(payload.userId);
    } catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }

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

app.listen(port, '0.0.0.0');
console.log(`✓ tRPC server listening on http://0.0.0.0:${port}/trpc/`);
