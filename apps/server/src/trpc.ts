import { TRPCError, initTRPC } from '@trpc/server';
import type { Context } from './context.js';
import { prisma } from './lib/prisma.js';
import { getMessage } from './lib/locale.js';

const t = initTRPC.context<Context>().create();

const isAuthed = t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: getMessage(ctx.locale, 'auth.authenticationRequired') });
    }

    return next({
        ctx: {
            ...ctx,
            user: ctx.user,
            db: ctx.db,
        },
    });
});

const normalizePermission = (permission: string) => {
    if (permission.includes('@')) return permission;
    const sepIndex = permission.lastIndexOf('_');
    if (sepIndex === -1) return permission;
    return `${permission.slice(0, sepIndex)}@${permission.slice(sepIndex + 1)}`;
};

const hasPermission = (requiredPermissions: string | string[]) => {
    return t.middleware(async ({ ctx, next }) => {
        if (!ctx.user) {
            throw new TRPCError({ code: 'UNAUTHORIZED', message: getMessage(ctx.locale, 'auth.authenticationRequired') });
        }

        // Fetch user permissions from database
        const user = await ctx.db.user.findUnique({
            where: { id: ctx.user.userId },
            include: {
                role: {
                    include: {
                        permissions: {
                            include: { permission: true },
                        },
                    },
                },
            },
        });

        if (!user?.role) {
            throw new TRPCError({ code: 'FORBIDDEN', message: getMessage(ctx.locale, 'auth.noRoleAssigned') });
        }

        const userPermissions = user.role.permissions.map((rp) => rp.permission.name);
        const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

        const normalizedRequired = permissions.map(normalizePermission);

        const hasRequiredPermission = normalizedRequired.some((perm) => userPermissions.includes(perm));

        if (!hasRequiredPermission) {
            throw new TRPCError({ code: 'FORBIDDEN', message: getMessage(ctx.locale, 'auth.insufficientPermissions') });
        }

        return next();
    });
};

const transactional = t.middleware(async ({ ctx, next }) => {
    return prisma.$transaction(async (tx) => {
        return next({
            ctx: {
                ...ctx,
                db: tx,
            },
        });
    });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
export const transactionalProtectedProcedure = protectedProcedure.use(transactional);
export { hasPermission, transactional };
