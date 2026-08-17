/**
 * Knowledge document → FTS chunk helpers.
 * Chunks are a derived index; KnowledgeDocument is the source of truth.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { embedKnowledgeChunkBestEffort } from './ai-embedding.js';
import { prisma, type DbClient } from './prisma.js';

export const CHUNK_SIZE = 800;

export type KnowledgeChunkInput = { title: string; content: string };

/** Split markdown into heading-aware chunks (max CHUNK_SIZE chars). */
export function splitIntoChunks(text: string, source: string): KnowledgeChunkInput[] {
  const chunks: KnowledgeChunkInput[] = [];
  const sections = text.split(/\n(?=#{1,3} )/);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const titleLine = lines[0] ?? '';
    const title = titleLine.replace(/^#{1,3} /, '').trim() || source;
    const content = section.trim();

    if (content.length <= CHUNK_SIZE) {
      if (content.length > 20) chunks.push({ title, content });
      continue;
    }

    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if ((currentChunk + '\n\n' + paragraph).length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push({ title, content: currentChunk.trim() });
        currentChunk = paragraph;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
      }
    }

    if (currentChunk.trim().length > 20) {
      chunks.push({ title, content: currentChunk.trim() });
    }
  }

  return chunks;
}

export async function deleteChunksForSource(db: DbClient, source: string): Promise<number> {
  const result = await db.knowledgeChunk.deleteMany({ where: { source } });
  return result.count;
}

/** Replace all chunks for a source slug from full document content. */
export async function replaceChunksForSource(
  db: DbClient,
  source: string,
  content: string,
): Promise<number> {
  await deleteChunksForSource(db, source);
  const chunks = splitIntoChunks(content, source);
  if (chunks.length === 0) return 0;

  await db.knowledgeChunk.createMany({
    data: chunks.map((c) => ({
      source,
      title: c.title,
      content: c.content,
    })),
  });

  // Best-effort embedding trigger: fire-and-forget so the mutation never blocks
  // or fails. Fetch via `db` (same transaction visibility as createMany), but
  // embed via the singleton `prisma` so embedding runs after the transaction
  // commits. Idempotent upsert — safe to re-run on chunks that already have an
  // embedding.
  const created = await db.knowledgeChunk.findMany({
    where: { source },
    select: { id: true, title: true, content: true },
  });
  for (const chunk of created) {
    void embedKnowledgeChunkBestEffort(prisma, chunk.id, chunk.title, chunk.content).catch(() => undefined);
  }

  return chunks.length;
}

/** Reindex one document: active → replace chunks; inactive → delete chunks. */
export async function reindexDocument(
  db: DbClient,
  doc: { slug: string; content: string; isActive: boolean },
): Promise<number> {
  if (!doc.isActive) {
    await deleteChunksForSource(db, doc.slug);
    return 0;
  }
  return replaceChunksForSource(db, doc.slug, doc.content);
}

/** Full reindex: wipe chunks, rebuild from all active documents. */
export async function reindexAllActive(db: DbClient): Promise<number> {
  await db.knowledgeChunk.deleteMany({});
  const docs = await db.knowledgeDocument.findMany({
    where: { isActive: true },
    select: { slug: true, content: true },
  });

  let total = 0;
  for (const doc of docs) {
    total += await replaceChunksForSource(db, doc.slug, doc.content);
  }
  return total;
}

export async function ensureKnowledgeFtsIndex(db: DbClient): Promise<void> {
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS knowledge_chunks_fts_idx
    ON knowledge_chunks
    USING GIN (to_tsvector('english', title || ' ' || content))
  `;
}

export function titleFromMarkdown(content: string, slug: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match?.[1]?.trim()) return match[1].trim();
  return slug
    .split('-')
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(' ');
}

/**
 * Upsert KnowledgeDocument rows from disk markdown and re-chunk active docs.
 * Disk is bootstrap only — runtime source of truth is DB.
 */
export async function importKnowledgeFromDisk(
  db: DbClient,
  knowledgeDir: string,
): Promise<{ documents: number; chunks: number }> {
  const files = (await readdir(knowledgeDir)).filter((f) => f.endsWith('.md'));
  let documents = 0;
  let chunks = 0;

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const content = await readFile(join(knowledgeDir, file), 'utf-8');
    const title = titleFromMarkdown(content, slug);

    const doc = await db.knowledgeDocument.upsert({
      where: { slug },
      create: { slug, title, content, isActive: true },
      update: { title, content, isActive: true },
    });

    documents += 1;
    chunks += await reindexDocument(db, doc);
  }

  await ensureKnowledgeFtsIndex(db);
  return { documents, chunks };
}
