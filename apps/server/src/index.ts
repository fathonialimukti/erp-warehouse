import express from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import cors from 'cors';
import { createContext } from './context.js';
import { serveUpload } from './lib/upload-file.js';
import { appRouter } from './router.js';

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
app.use(
    '/trpc',
    createExpressMiddleware({
        router: appRouter,
        createContext,
    })
);

app.listen(port);
console.log(`✓ tRPC server listening on http://localhost:${port}/trpc/`);
