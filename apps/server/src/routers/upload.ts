import { z } from 'zod';
import { persistUploadedImageOrThrow } from '../lib/upload-service.js';
import { protectedProcedure, router } from '../trpc.js';

export const uploadRouter = router({
    image: protectedProcedure
        .input(
            z.object({
                folder: z.enum(['users', 'warehouses', 'skus']),
                image: z.string(),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const url = await persistUploadedImageOrThrow({
                image: input.image,
                folder: input.folder,
                req: ctx.req,
                locale: ctx.locale,
            });

            return { url };
        }),
});