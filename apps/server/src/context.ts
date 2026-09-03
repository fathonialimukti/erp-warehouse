import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { prisma, type DbClient } from './lib/prisma.js';
import { parseLocaleCookie, ServerLocale, DEFAULT_LOCALE } from './lib/locale.js';

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}

export type AuthUser = {
    userId: string;
    email: string;
    name: string | null;
    exp: number;
};

export type RequestContext = {
    req: CreateExpressContextOptions['req'];
    res: CreateExpressContextOptions['res'];
    user: AuthUser | null;
    token: string | null;
    db: DbClient;
    locale: ServerLocale;
};

const getTokenFromRequest = (req: CreateExpressContextOptions['req']) => {
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        const cookies = parse(cookieHeader);
        if (cookies.access_token) return cookies.access_token;
    }

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice('Bearer '.length);

    return null;
};

const getUserFromToken = (token: string): AuthUser | null => {
    try {
        const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        if (!payload?.userId || !payload?.email || typeof payload.exp !== 'number') {
            return null;
        }

        return {
            userId: String(payload.userId),
            email: String(payload.email),
            name: payload.name ? String(payload.name) : null,
            exp: payload.exp,
        };
    } catch {
        return null;
    }
};

export const createContext = ({ req, res }: CreateExpressContextOptions) => {
    const token = getTokenFromRequest(req);
    const user = token ? getUserFromToken(token) : null;
    const locale = parseLocaleCookie(req.headers.cookie ?? undefined) ?? DEFAULT_LOCALE;

    return { req, res, user, token, db: prisma, locale } satisfies RequestContext;
};

export type Context = Awaited<ReturnType<typeof createContext>>;
