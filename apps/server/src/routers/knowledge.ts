import { TRPCError } from '@trpc/server';
import {
  createKnowledgeDocumentSchema,
  knowledgeIdSchema,
  knowledgeListInputSchema,
  reindexKnowledgeSchema,
  updateKnowledgeDocumentSchema,
} from '@repo/schemas/knowledge';
import { logActivity } from '../lib/activity-log.js';
import {
  deleteChunksForSource,
  reindexAllActive,
  reindexDocument,
  replaceChunksForSource,
} from '../lib/knowledge-ingest.js';
import { buildCreateLogDetail, buildDeleteLogDetail, buildUpdateLogDetail } from '../lib/log-detail.js';
import { getMessage } from '../lib/locale.js';
import { buildPaginationMeta, buildPaginationParams } from '../lib/list-query.js';
import type { DbClient } from '../lib/prisma.js';
import { hasPermission, protectedProcedure, router, transactional } from '../trpc.js';

const listSelect = {
  id: true,
  slug: true,
  title: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

async function chunkCountBySources(db: DbClient, sources: string[]): Promise<Record<string, number>> {
  if (sources.length === 0) return {};
  const rows = await db.knowledgeChunk.groupBy({
    by: ['source'],
    where: { source: { in: sources } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.source, r._count._all]));
}

/**
 * Knowledge base document CRUD + reindex.
 * Documents are the source of truth; knowledge_chunks are a derived FTS index.
 */
export const knowledgeRouter = router({
  list: protectedProcedure
    .use(hasPermission('knowledge@read'))
    .input(knowledgeListInputSchema)
    .query(async ({ ctx, input }) => {
      const { page, limit, skip } = buildPaginationParams(input);
      const search = input?.search?.trim();

      const where = search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [rows, total] = await Promise.all([
        ctx.db.knowledgeDocument.findMany({
          where,
          skip,
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: listSelect,
        }),
        ctx.db.knowledgeDocument.count({ where }),
      ]);

      const counts = await chunkCountBySources(
        ctx.db,
        rows.map((r) => r.slug),
      );

      return {
        data: rows.map((row) => ({ ...row, chunkCount: counts[row.slug] ?? 0 })),
        meta: buildPaginationMeta({ page, limit, total }),
      };
    }),

  getById: protectedProcedure
    .use(hasPermission('knowledge@read'))
    .input(knowledgeIdSchema)
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.knowledgeDocument.findUnique({ where: { id: input.id } });
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'knowledge.notFound') });
      }

      const chunkCount = await ctx.db.knowledgeChunk.count({ where: { source: row.slug } });
      return { ...row, chunkCount };
    }),

  create: protectedProcedure
    .use(hasPermission('knowledge@create'))
    .use(transactional)
    .input(createKnowledgeDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.knowledgeDocument.findUnique({ where: { slug: input.slug } });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: getMessage(ctx.locale, 'knowledge.slugTaken') });
      }

      const created = await ctx.db.knowledgeDocument.create({ data: input });
      const chunkCount = created.isActive
        ? await replaceChunksForSource(ctx.db, created.slug, created.content)
        : 0;

      await logActivity(ctx.db, {
        action: 'CREATE',
        userId: ctx.user!.userId,
        resource: 'knowledge',
        resourceId: created.id,
        message: `Created knowledge document ${created.slug}`,
        detail: buildCreateLogDetail(created),
      });

      return { ...created, chunkCount };
    }),

  update: protectedProcedure
    .use(hasPermission('knowledge@update'))
    .use(transactional)
    .input(updateKnowledgeDocumentSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.knowledgeDocument.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'knowledge.notFound') });
      }

      const { id, ...data } = input;

      if (data.slug && data.slug !== existing.slug) {
        const taken = await ctx.db.knowledgeDocument.findUnique({ where: { slug: data.slug } });
        if (taken) {
          throw new TRPCError({ code: 'CONFLICT', message: getMessage(ctx.locale, 'knowledge.slugTaken') });
        }
      }

      const updated = await ctx.db.knowledgeDocument.update({ where: { id }, data });

      const slugChanged = updated.slug !== existing.slug;
      const contentChanged = updated.content !== existing.content;
      const activeChanged = updated.isActive !== existing.isActive;
      const needsRechunk = slugChanged || contentChanged || activeChanged;

      if (slugChanged) {
        await deleteChunksForSource(ctx.db, existing.slug);
      }

      let chunkCount = 0;
      if (needsRechunk) {
        chunkCount = await reindexDocument(ctx.db, updated);
      } else {
        chunkCount = await ctx.db.knowledgeChunk.count({ where: { source: updated.slug } });
      }

      await logActivity(ctx.db, {
        action: 'UPDATE',
        userId: ctx.user!.userId,
        resource: 'knowledge',
        resourceId: updated.id,
        message: `Updated knowledge document ${updated.slug}`,
        detail: buildUpdateLogDetail(existing, updated),
      });

      return { ...updated, chunkCount };
    }),

  delete: protectedProcedure
    .use(hasPermission('knowledge@delete'))
    .use(transactional)
    .input(knowledgeIdSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.knowledgeDocument.findUnique({ where: { id: input.id } });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'knowledge.notFound') });
      }

      await deleteChunksForSource(ctx.db, existing.slug);
      await ctx.db.knowledgeDocument.delete({ where: { id: input.id } });

      await logActivity(ctx.db, {
        action: 'DELETE',
        userId: ctx.user!.userId,
        resource: 'knowledge',
        resourceId: input.id,
        message: `Deleted knowledge document ${existing.slug}`,
        detail: buildDeleteLogDetail(existing),
      });

      return { success: true };
    }),

  reindex: protectedProcedure
    .use(hasPermission('knowledge@update'))
    .use(transactional)
    .input(reindexKnowledgeSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.id) {
        const doc = await ctx.db.knowledgeDocument.findUnique({ where: { id: input.id } });
        if (!doc) {
          throw new TRPCError({ code: 'NOT_FOUND', message: getMessage(ctx.locale, 'knowledge.notFound') });
        }
        const chunkCount = await reindexDocument(ctx.db, doc);
        return { success: true, documents: 1, chunks: chunkCount };
      }

      const chunks = await reindexAllActive(ctx.db);
      const documents = await ctx.db.knowledgeDocument.count({ where: { isActive: true } });
      return { success: true, documents, chunks };
    }),
});
