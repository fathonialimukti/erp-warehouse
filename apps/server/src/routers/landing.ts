import { TRPCError } from "@trpc/server";
import {
  listContactSubmissionsSchema,
  submitContactSchema,
} from "@repo/schemas/landing";
import { sendContactNotification } from "../lib/contact-mailer.js";
import {
  buildPaginationMeta,
  buildPaginationParams,
  buildTextSearchWhere,
} from "../lib/list-query.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import {
  hasPermission,
  protectedProcedure,
  publicProcedure,
  router,
} from "../trpc.js";

// In-memory sliding window for the anonymous contact form: 5 submissions
// per IP per 15 minutes. The global HTTP limiter (middleware/smart-rate-limit.ts)
// bounds overall throughput; this per-endpoint cap stops contact-form spam.
const CONTACT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_MAX = 5;
const contactHits = new Map<string, number[]>();

/** Exposed for tests. */
export const __testHooks = {
  clearContactRateLimits: () => contactHits.clear(),
};

const contactRateLimitedProcedure = publicProcedure.use(
  async ({ ctx, next }) => {
    const now = Date.now();
    const key = ctx.req.ip ?? ctx.req.socket?.remoteAddress ?? "unknown";
    const hits = (contactHits.get(key) ?? []).filter(
      (t) => now - t < CONTACT_WINDOW_MS,
    );
    if (hits.length >= CONTACT_MAX) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many contact submissions. Please try again later.",
      });
    }
    hits.push(now);
    contactHits.set(key, hits);
    if (contactHits.size > 1000) {
      for (const [k, v] of contactHits) {
        if (v.every((t) => now - t >= CONTACT_WINDOW_MS)) contactHits.delete(k);
      }
    }
    return next();
  },
);

/**
 * Public landing page router — no auth required.
 * Returns WH01 warehouse layout data for the hero 3D scene
 * and accepts contact form submissions.
 */
export const landingRouter = router({
  getScene: publicProcedure.query(async () => {
    const warehouse = await prisma.warehouse.findFirst({
      where: { objectId: "WH01" },
      select: { id: true, objectId: true },
    });

    if (!warehouse) {
      return { warehouseObjectId: null, locations: [] };
    }

    const locations = await prisma.storageLocation.findMany({
      where: { warehouseId: warehouse.id },
      orderBy: { id: "asc" },
      select: {
        id: true,
        pallet: {
          select: {
            id: true,
            sourceType: true,
            sourceItemId: true,
            sku: {
              select: {
                id: true,
                name: true,
                objectId: true,
                packageName: true,
              },
            },
          },
        },
      },
    });

    return { warehouseObjectId: warehouse.objectId, locations };
  }),

  submitContact: contactRateLimitedProcedure
    .input(submitContactSchema)
    .mutation(async ({ ctx, input }) => {
      const submission = {
        name: input.name.trim(),
        email: input.email.trim(),
        company: input.company?.trim() || null,
        message: input.message.trim(),
      };
      const created = await ctx.db.contactSubmission.create({
        data: submission,
        select: { id: true },
      });
      // Email is best-effort: the DB row is the source of truth, so a mail
      // failure must never fail the submission.
      void sendContactNotification(submission).catch((err: unknown) => {
        logger.error({ err }, "Contact notification email failed");
      });

      return { success: true, id: created.id };
    }),

  /** List contact inquiries. Requires landing@read. */
  listContactSubmissions: protectedProcedure
    .use(hasPermission("landing@read"))
    .input(listContactSubmissionsSchema)
    .query(async ({ ctx, input }) => {
      const { page, limit, skip } = buildPaginationParams(input);
      const where = buildTextSearchWhere(input.search, [
        "name",
        "email",
      ] as const);

      const [data, total] = await Promise.all([
        ctx.db.contactSubmission.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        ctx.db.contactSubmission.count({ where }),
      ]);

      return { data, pagination: buildPaginationMeta({ page, limit, total }) };
    }),
});
