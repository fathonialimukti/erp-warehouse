import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { parse } from 'cookie';
import jwt from 'jsonwebtoken';
import { prisma, type DbClient } from './lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your-secret-key-change-this';

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

    return { req, res, user, token, db: prisma } satisfies RequestContext;
};

export type Context = Awaited<ReturnType<typeof createContext>>;
