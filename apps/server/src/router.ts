import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

export const appRouter = t.router({
    greeting: t.procedure
        .input(z.object({ name: z.string().nullish() }).nullish())
        .query(({ input }) => {
            const name = input?.name ?? "world";
            return { greeting: `Hello ${name}!` };
        }),

    createGreeting: t.procedure
        .input(z.object({ name: z.string().min(1, "Name is required") }))
        .mutation(({ input }) => {
            return {
                id: Math.random().toString(36).substr(2, 9),
                name: input.name,
                greeting: `Hello ${input.name}!`,
                createdAt: new Date(),
            };
        }),
});

export type AppRouter = typeof appRouter;
