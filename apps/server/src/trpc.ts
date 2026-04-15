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
