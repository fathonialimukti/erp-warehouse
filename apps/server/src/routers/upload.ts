import { z } from 'zod';
import { persistUploadedImage } from '../lib/upload-file.js';
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
            const url = await persistUploadedImage({
                image: input.image,
                folder: input.folder,
                req: ctx.req,
            });

            return { url };
        }),
});