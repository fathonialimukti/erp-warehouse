import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import cors from 'cors';
import { parse as parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { createContext } from './context.js';
import { serveUpload } from './lib/upload-file.js';
import { appRouter } from './router.js';
import { sseManager } from './lib/sse-manager.js';

const port = Number(process.env.PORT ?? 2022);
const corsOrigin = process.env.CORS_ORIGIN;
const isDev = process.env.NODE_ENV !== 'production';

const isAllowedDevOrigin = (origin: string) =>
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) || origin === 'tauri://localhost';

console.log('Starting tRPC server on port', port);

const app = express();

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (corsOrigin && origin === corsOrigin) return callback(null, true);
            if (isDev && isAllowedDevOrigin(origin)) return callback(null, true);

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

app.listen(port);
console.log(`✓ tRPC server listening on http://localhost:${port}/trpc/`);
