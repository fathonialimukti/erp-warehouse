import { TRPCError } from '@trpc/server';
import { serialize } from 'cookie';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { logActivity } from '../lib/activity-log.js';
import { publicProcedure, protectedProcedure, router } from '../trpc.js';
import { getMessage } from '../lib/locale.js';
import { loginSchema, demoLoginSchema, changePasswordSchema, requestPasswordResetSchema, resetPasswordSchema } from '@repo/schemas/auth';
import { getNumberSetting } from '../lib/app-settings.js';
import { isMailConfigured, sendMail, wrapEmailHtml } from '../lib/mailer.js';
import { logSystemWarn } from '../lib/system-log.js';
import { logger } from '../lib/logger.js';

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
// Demo login gate: passwordless "Login as X" is ONLY available when
// DEMO_LOGIN_ENABLED === "true" AND NODE_ENV !== "production". Production is
// hard-off regardless of the flag so a stray env var can never grant
// passwordless admin access. Read at request time (not module load) so
// tests/process managers can toggle it without a re-import.
// See apps/server/.env.example.
const isDemoLoginEnabled = () =>
    process.env.NODE_ENV !== 'production' && process.env.DEMO_LOGIN_ENABLED === 'true';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

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

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const appUrl = () => process.env.APP_URL ?? 'http://localhost:10011';

export const authRouter = router({
    login: publicProcedure
        .input(loginSchema)
        .mutation(async ({ ctx, input }) => {
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

            if (!user) throw new TRPCError({ code: 'UNAUTHORIZED', message: getMessage(ctx.locale, 'auth.invalidCredentials') });

            // Account lockout (settings-driven)
            const maxAttempts = await getNumberSetting('security.maxLoginAttempts');
            const lockoutMinutes = await getNumberSetting('security.lockoutMinutes');
            if (user.lockedUntil && user.lockedUntil > new Date()) {
                throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: getMessage(ctx.locale, 'auth.accountLocked') });
            }

            const isPasswordValid = await verifyPassword(password, user.password);
            if (!isPasswordValid) {
                const attempts = user.failedLoginAttempts + 1;
                const shouldLock = attempts >= maxAttempts;
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        failedLoginAttempts: shouldLock ? 0 : attempts,
                        lockedUntil: shouldLock ? new Date(Date.now() + lockoutMinutes * 60_000) : null,
                    },
                });
                logActivity(prisma, {
                    action: 'LOGIN',
                    userId: user.id,
                    resource: 'user',
                    resourceId: user.id,
                    message: shouldLock
                        ? `Failed login attempt (${attempts}/${maxAttempts}) — account locked for ${lockoutMinutes}m`
                        : `Failed login attempt (${attempts}/${maxAttempts})`,
                }).catch(() => undefined);
                throw new TRPCError({
                    code: shouldLock ? 'TOO_MANY_REQUESTS' : 'UNAUTHORIZED',
                    message: getMessage(ctx.locale, shouldLock ? 'auth.accountLocked' : 'auth.invalidCredentials'),
                });
            }

            if (user.failedLoginAttempts > 0 || user.lockedUntil) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { failedLoginAttempts: 0, lockedUntil: null },
                });
            }

            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                    ver: user.tokenVersion,
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            const decoded = jwt.decode(token) as jwt.JwtPayload | null;
            const tokenExpiresAt = decoded?.exp ? decoded.exp * 1000 : null;

            ctx.res.setHeader('Set-Cookie', createAuthCookie(token, input.rememberMe));

            // Log login activity
            await logActivity(prisma, {
                action: 'LOGIN',
                userId: user.id,
                resource: 'user',
                resourceId: user.id,
                message: `User ${user.name} logged in`,
            });

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
            throw new TRPCError({ code: 'UNAUTHORIZED', message: getMessage(ctx.locale, 'auth.authenticationRequired') });
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

    logout: protectedProcedure.mutation(async ({ ctx }) => {
        // Log logout activity
        await logActivity(prisma, {
            action: 'LOGOUT',
            userId: ctx.user.userId,
            resource: 'user',
            resourceId: ctx.user.userId,
            message: `User ${ctx.user.name} logged out`,
        });

        ctx.res.setHeader('Set-Cookie', clearAuthCookie());
        return { success: true };
    }),

    /** List demo users with their roles/permissions. Only runs when demo mode is enabled. */
    demoUsers: publicProcedure.query(async () => {
        // Disabled → empty list (not FORBIDDEN) so the login UI simply hides
        // the "Login as X" cards without error handling.
        if (!isDemoLoginEnabled()) return [];

        // roleId NOT NULL keeps this human-only: excludes ai-system@aetherglo.com
        // (NULL role) and any legacy role-less rows.
        const users = await prisma.user.findMany({
            where: {
                roleId: { not: null },
                OR: [
                    { lockedUntil: null },
                    { lockedUntil: { lt: new Date() } },
                ],
            },
            orderBy: { name: 'asc' },
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

        return users.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            description: user.description,
            role: user.role
                ? {
                    id: user.role.id,
                    name: user.role.name,
                    // Role has no separate code column; name is @unique and doubles as code.
                    code: user.role.name,
                    // Capability summary for the demo card: sorted `resource@action` strings.
                    permissions: user.role.permissions.map((p) => p.permission.name).sort(),
                }
                : null,
        }));
    }),

    /** Demo sign-in: issues the same session as login without a password. Only runs when demo mode is enabled. */
    demoLogin: publicProcedure
        .input(demoLoginSchema)
        .mutation(async ({ ctx, input }) => {
            // Gate: passwordless login is never allowed when disabled.
            if (!isDemoLoginEnabled()) {
                throw new TRPCError({ code: 'FORBIDDEN', message: getMessage(ctx.locale, 'auth.demoDisabled') });
            }

            // findFirst (not findUnique): id is unique but roleId/lock filters are not.
            const user = await prisma.user.findFirst({
                where: {
                    id: input.userId,
                    roleId: { not: null },
                    OR: [
                        { lockedUntil: null },
                        { lockedUntil: { lt: new Date() } },
                    ],
                },
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

            if (!user) throw new TRPCError({ code: 'UNAUTHORIZED', message: getMessage(ctx.locale, 'auth.invalidCredentials') });

            // Defense in depth: the WHERE clause already requires roleId NOT NULL,
            // but re-verify here plus the email allowlist so a mis-seeded or
            // service row can never get a passwordless session. Generic error to
            // avoid leaking which check failed. Never allow NULL-role users.
            const email = user.email.toLowerCase();
            const isHumanDemoUser =
                user.roleId !== null &&
                user.role !== null &&
                email.endsWith('@aetherglo.com') &&
                email !== 'ai-system@aetherglo.com' &&
                !email.includes('n8n');
            if (!isHumanDemoUser) {
                throw new TRPCError({ code: 'UNAUTHORIZED', message: getMessage(ctx.locale, 'auth.invalidCredentials') });
            }

            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    name: user.name,
                    ver: user.tokenVersion,
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            const decoded = jwt.decode(token) as jwt.JwtPayload | null;
            const tokenExpiresAt = decoded?.exp ? decoded.exp * 1000 : null;

            ctx.res.setHeader('Set-Cookie', createAuthCookie(token, false));

            // Log demo login activity (fire-and-forget)
            logActivity(prisma, {
                action: 'LOGIN',
                userId: user.id,
                resource: 'user',
                resourceId: user.id,
                message: `User ${user.name} logged in (demo)`,
            }).catch(() => undefined);

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

    /** Change own password; revokes all other sessions via tokenVersion bump. */
    changePassword: protectedProcedure
        .input(changePasswordSchema)
        .mutation(async ({ ctx, input }) => {
            const user = await prisma.user.findUnique({ where: { id: ctx.user.userId } });
            if (!user) {
                throw new TRPCError({ code: 'UNAUTHORIZED', message: getMessage(ctx.locale, 'auth.authenticationRequired') });
            }

            const isCurrentValid = await verifyPassword(input.currentPassword, user.password);
            if (!isCurrentValid) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'auth.currentPasswordIncorrect') });
            }

            const minLength = await getNumberSetting('security.passwordMinLength');
            if (input.newPassword.length < minLength) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: getMessage(ctx.locale, 'auth.passwordTooShort', { min: minLength }),
                });
            }

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: await hashPassword(input.newPassword),
                    tokenVersion: { increment: 1 },
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                },
            });

            await logActivity(prisma, {
                action: 'UPDATE',
                userId: user.id,
                resource: 'user',
                resourceId: user.id,
                message: 'User changed their own password',
            });

            // Issue a fresh cookie so the current session survives the tokenVersion bump.
            const token = jwt.sign(
                { userId: user.id, email: user.email, name: user.name, ver: user.tokenVersion + 1 },
                JWT_SECRET,
                { expiresIn: '7d' },
            );
            ctx.res.setHeader('Set-Cookie', createAuthCookie(token, true));

            return { success: true };
        }),

    /** Request a password reset email. Always returns success (no enumeration). */
    requestPasswordReset: publicProcedure
        .input(requestPasswordResetSchema)
        .mutation(async ({ input }) => {
            const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });

            if (user) {
                // Invalidate previous unused tokens for this user
                await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

                const rawToken = randomBytes(32).toString('hex');
                await prisma.passwordResetToken.create({
                    data: {
                        userId: user.id,
                        tokenHash: sha256(rawToken),
                        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
                    },
                });

                const resetUrl = `${appUrl()}/reset-password?token=${rawToken}`;
                const mailConfigured = await isMailConfigured();

                if (mailConfigured) {
                    const sent = await sendMail({
                        to: user.email,
                        subject: 'Reset your WMS password',
                        html: wrapEmailHtml(
                            'Reset your password',
                            `<p>Hello ${user.name ?? user.email},</p>
                             <p>We received a request to reset your password. This link is valid for 1 hour and can be used once.</p>
                             <p><a href="${resetUrl}" style="display:inline-block;background:#0B5FFA;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Reset password</a></p>
                             <p>If you did not request this, you can safely ignore this email.</p>`,
                        ),
                    });
                    if (!sent) {
                        logSystemWarn({
                            source: 'mail',
                            message: `Password reset email failed for ${user.email}; reset URL logged instead`,
                            userId: user.id,
                        });
                    }
                } else {
                    // Mail not configured: hand-over workflow. The full URL goes to
                    // the server CONSOLE only (privileged, PM2-managed) — never to
                    // the system_logs DB, which lower-privileged roles can read.
                    logger.warn(`Password reset requested for ${user.email} but mail is not configured. Reset URL: ${resetUrl}`);
                    logSystemWarn({
                        source: 'mail',
                        message: `Password reset requested for ${user.email} but mail is not configured. Reset URL printed to server console.`,
                        userId: user.id,
                    });
                }
            }

            return { success: true };
        }),

    /** Complete a password reset with a valid token. */
    resetPassword: publicProcedure
        .input(resetPasswordSchema)
        .mutation(async ({ ctx, input }) => {
            const record = await prisma.passwordResetToken.findUnique({
                where: { tokenHash: sha256(input.token) },
            });

            if (!record || record.usedAt || record.expiresAt < new Date()) {
                throw new TRPCError({ code: 'BAD_REQUEST', message: getMessage(ctx.locale, 'auth.resetTokenInvalid') });
            }

            const minLength = await getNumberSetting('security.passwordMinLength');
            if (input.newPassword.length < minLength) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: getMessage(ctx.locale, 'auth.passwordTooShort', { min: minLength }),
                });
            }

            await prisma.$transaction([
                prisma.user.update({
                    where: { id: record.userId },
                    data: {
                        password: await hashPassword(input.newPassword),
                        tokenVersion: { increment: 1 },
                        failedLoginAttempts: 0,
                        lockedUntil: null,
                    },
                }),
                prisma.passwordResetToken.update({
                    where: { id: record.id },
                    data: { usedAt: new Date() },
                }),
                prisma.passwordResetToken.deleteMany({
                    where: { userId: record.userId, usedAt: null },
                }),
            ]);

            ctx.res.setHeader('Set-Cookie', clearAuthCookie());

            await logActivity(prisma, {
                action: 'UPDATE',
                userId: record.userId,
                resource: 'user',
                resourceId: record.userId,
                message: 'Password reset via email token',
            });

            return { success: true };
        }),
});
