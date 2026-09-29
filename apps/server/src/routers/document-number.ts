import { z } from "zod";
import { protectedProcedure, router } from "../trpc.js";
import { getNextDocumentNumber } from "../lib/document-number.js";
import { WarehouseTransactionType } from "../prisma/generated/client.js";

export const documentNumberRouter = router({
  preview: protectedProcedure
    .input(
      z.object({
        transactionType: z.nativeEnum(WarehouseTransactionType),
        warehouseId: z.string().min(1),
        date: z.coerce.date(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const documentNumber = await getNextDocumentNumber(ctx.db, {
        transactionType: input.transactionType,
        warehouseId: input.warehouseId,
        date: input.date,
      });
      return { documentNumber };
    }),
});
