import { createHTTPServer } from '@trpc/server/adapters/standalone';
import cors from 'cors';
import { createContext } from './context.js';
import { appRouter } from './router.js';

const port = Number(process.env.PORT ?? 2022);
const corsOrigin = process.env.CORS_ORIGIN;
const isDev = process.env.NODE_ENV !== 'production';

const isAllowedDevOrigin = (origin: string) =>
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) || origin === 'tauri://localhost';

console.log('Starting tRPC server on port', port);

const server = createHTTPServer({
    router: appRouter,
    basePath: '/trpc/',
    createContext,
    middleware: cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (corsOrigin && origin === corsOrigin) return callback(null, true);
            if (isDev && isAllowedDevOrigin(origin)) return callback(null, true);

            return callback(new Error(`CORS blocked: ${origin}`));
        },
        credentials: true,
    }),
});

server.listen(port);
console.log(`✓ tRPC server listening on http://localhost:${port}/trpc/`);
