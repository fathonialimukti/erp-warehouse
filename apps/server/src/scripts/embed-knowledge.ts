/**
 * Batch embedding CLI — embeds all knowledge chunks missing embeddings.
 *
 * Gracefully degrades if AI embedding is not configured (prints a message and exits 0).
 * Never crashes on a single bad batch — marks failed chunks and continues.
 *
 * Usage:
 *   bun src/scripts/embed-knowledge.ts
 *   bun run ai:embed
 */
import 'dotenv/config';
import { buildEmbedText, generateEmbeddings, getEmbeddingModelId, isEmbeddingConfigured, setChunkEmbeddingStatus, upsertChunkEmbedding } from '../lib/ai-embedding.js';
import { prisma } from '../lib/prisma.js';

interface ChunkRow {
  id: string;
  title: string;
  content: string;
}

/** Embed one batch, retrying on failures (e.g. provider 429 rate limits) with growing waits. */
async function embedBatchWithRetry(
  db: Parameters<typeof generateEmbeddings>[0],
  batch: string[],
  batchIndex: number,
  totalBatches: number,
): Promise<number[][] | null> {
  const RETRY_DELAYS_MS = [30_000, 60_000];
  let vecs = await generateEmbeddings(db, batch);
  for (let attempt = 0; !vecs && attempt < RETRY_DELAYS_MS.length; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt] ?? 60_000;
    console.log(`… batch ${batchIndex}/${totalBatches} failed, retrying in ${delay / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    vecs = await generateEmbeddings(db, batch);
  }
  return vecs;
}

async function embed() {
  if (!(await isEmbeddingConfigured(prisma))) {
    console.log(
      'AI embedding is not configured. Set ai.baseUrl/ai.embeddingModel settings or AI_BASE_URL/AI_EMBEDDING_MODEL env vars (embedding-specific ai.embeddingBaseUrl/ai.embeddingApiKey are also supported).',
    );
    await prisma.$disconnect();
    process.exit(0);
  }

  const modelId = await getEmbeddingModelId(prisma);

  // Count total for summary
  const total = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    'SELECT COUNT(*)::bigint AS count FROM knowledge_chunks',
  );
  const totalChunks = Number(total[0].count);

  // Fetch chunks needing embeddings
  const rows = await prisma.$queryRawUnsafe<ChunkRow[]>(
    'SELECT id, title, content FROM knowledge_chunks WHERE embedding_status <> $1',
    'EMBEDDED',
  );

  if (rows.length === 0) {
    console.log(`All ${totalChunks} chunk(s) already embedded. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${rows.length} chunk(s) needing embeddings (${totalChunks} total).`);

  const values = rows.map((r) => buildEmbedText(r.title, r.content));
  const BATCH_SIZE = 32;
  let embedded = 0;
  let failed = 0;
  let pending = 0;

  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const batchRows = rows.slice(i, i + BATCH_SIZE);
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(values.length / BATCH_SIZE);

    const vecs = await embedBatchWithRetry(prisma, batch, batchIndex, totalBatches);

    if (!vecs) {
      // Entire batch failed after retries
      for (const row of batchRows) {
        await setChunkEmbeddingStatus(row.id, 'FAILED').catch(() => undefined);
        failed++;
      }
      console.log(`✗ Batch ${batchIndex}/${totalBatches}: ${batchRows.length} chunk(s) FAILED`);
      continue;
    }

    // Write each embedding
    for (let j = 0; j < vecs.length; j++) {
      const vec = vecs[j];
      const row = batchRows[j];
      if (!vec || !row) continue; // safety: index parity between values and rows
      try {
        await upsertChunkEmbedding(row.id, vec, modelId);
        embedded++;
      } catch {
        await setChunkEmbeddingStatus(row.id, 'FAILED').catch(() => undefined);
        failed++;
      }
    }

    console.log(`✓ Embedded ${embedded} chunk(s) (batch ${batchIndex} of ${totalBatches})`);
  }

  pending = rows.length - embedded - failed;

  console.log(`Done: ${embedded} embedded, ${failed} failed, ${pending} pending, ${totalChunks} total.`);

  await prisma.$disconnect();
}

embed().catch((err) => {
  console.error('Embedding failed:', err);
  process.exit(1);
});