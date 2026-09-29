import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  analyzePickLines,
  analyzePutawayLines,
  suggestPickAssignments,
  suggestPutawayAssignments,
} from "../lib/ai-warehouse-service.js";
import { hasPermission, protectedProcedure, router } from "../trpc.js";

/**
 * AI Warehouse — RAG-only putaway/pick analysis + assignment suggestions for
 * the 3D warehouse layout page (PutawayPanel / DispatchPanel).
 *
 * All procedures are `.mutation`: they invoke the LLM and must never be cached
 * or replayed by the client. The service functions never throw — failures come
 * back as `{ error }` results, which we map to TRPCErrors here so the client
 * gets proper tRPC error handling.
 */

const analyzePutawayInputSchema = z.object({
  warehouseId: z.string().optional(),
  inboundTransactionId: z.string().optional(),
});

const suggestPutawayInputSchema = z.object({
  warehouseId: z.string(),
  inboundTransactionId: z.string(),
});

const analyzePickInputSchema = z.object({
  warehouseId: z.string().optional(),
  outboundTransactionId: z.string().optional(),
});

const suggestPickInputSchema = z.object({
  outboundTransactionId: z.string(),
});

/**
 * Service functions return `{ error: string }` on failure — surface as TRPCError.
 * Unconfigured AI / unreachable provider is an availability problem, not an
 * internal fault, so it maps to 503; only genuinely unexpected failures stay 500.
 */
function unwrapServiceResult<T>(result: T | { error: string }): T {
  if (typeof (result as { error?: unknown }).error === "string") {
    const error = (result as { error: string }).error;
    const code = /AI not configured|AI analysis failed/i.test(error)
      ? "SERVICE_UNAVAILABLE"
      : "INTERNAL_SERVER_ERROR";
    throw new TRPCError({ code, message: error });
  }
  return result as T;
}

export const aiWarehouseRouter = router({
  /** AI analysis of pending putaway lines (markdown report). */
  analyzePutaway: protectedProcedure
    .use(hasPermission("transaction@putaway"))
    .input(analyzePutawayInputSchema)
    .mutation(async ({ input }) =>
      unwrapServiceResult(await analyzePutawayLines(input)),
    ),

  /** AI putaway assignment suggestions (pallet → storage location). */
  suggestPutaway: protectedProcedure
    .use(hasPermission("transaction@putaway"))
    .input(suggestPutawayInputSchema)
    .mutation(async ({ input }) =>
      unwrapServiceResult(await suggestPutawayAssignments(input)),
    ),

  /** AI analysis of pending pick lines (markdown report). */
  analyzePick: protectedProcedure
    .use(hasPermission("transaction@dispatch"))
    .input(analyzePickInputSchema)
    .mutation(async ({ input }) =>
      unwrapServiceResult(await analyzePickLines(input)),
    ),

  /** AI pick assignment suggestions (reserved pallet pick order). */
  suggestPick: protectedProcedure
    .use(hasPermission("transaction@dispatch"))
    .input(suggestPickInputSchema)
    .mutation(async ({ input }) =>
      unwrapServiceResult(await suggestPickAssignments(input)),
    ),
});
