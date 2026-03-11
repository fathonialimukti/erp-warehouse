import { TRPCError } from '@trpc/server';
import { serialize } from 'cookie';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { verifyPassword } from '../lib/password.js';
import { publicProcedure, protectedProcedure, router } from '../trpc.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your-secret-key-change-this';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7;

const createAuthCookie = (token: string, rememberMe?: boolean) =>
    serialize('access_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        ...(rememberMe ? { maxAge: TOKEN_MAX_AGE } : {}),
    });

const clearAuthCookie = () =>
    serialize('access_token', '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
    });

export const authRouter = router({
    login: publicProcedure
        .input(
            z.object({
                email: z.email('Invalid email address'),
                password: z.string().min(1, 'Password is required'),
                rememberMe: z.boolean().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {
            console.log('test');

            const { email, password } = input;

            const user = await prisma.user.findUnique({
                where: { email },
                include: {
                    role: {
                        include: {
                            permissions: {
                                include: {
                                    permission: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!user) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });

            const isPasswordValid = await verifyPassword(password, user.password);
            if (!isPasswordValid) {
                throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' });
            }

            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            const decoded = jwt.decode(token) as jwt.JwtPayload | null;
            const tokenExpiresAt = decoded?.exp ? decoded.exp * 1000 : null;

            ctx.res.setHeader('Set-Cookie', createAuthCookie(token, input.rememberMe));

            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    roles: user.role ? [{
                        id: user.role.id,
                        name: user.role.name,
                        permissions: user.role.permissions.map((p) => p.permission.name),
                    }] : [],
                },
                tokenExpiresAt,
            };
        }),

    me: protectedProcedure.query(async ({ ctx }) => {
        const user = await prisma.user.findUnique({
            where: { id: ctx.user.userId },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: {
                                permission: true,
                            },
                        },
                    },
                },
            },
        });

        if (!user) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                roles: user.role
                    ? [{
                        id: user.role.id,
                        name: user.role.name,
                        permissions: user.role.permissions.map((p) => p.permission.name),
                    }]
                    : [],
            },
            tokenExpiresAt: ctx.user.exp * 1000,
        };
    }),

    logout: protectedProcedure.mutation(({ ctx }) => {
        ctx.res.setHeader('Set-Cookie', clearAuthCookie());
        return { success: true };
    }),
});
