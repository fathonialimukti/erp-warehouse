import { embed, embedMany } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { prisma, type DbClient } from './prisma.js';

/** Locked to the `knowledge_chunks.embedding` column — NOT tunable. */
export const EMBEDDING_COLUMN_DIMENSIONS = 1536;

const SETTING_KEYS = {
  baseUrl: 'ai.baseUrl',
  model: 'ai.model',
  embeddingModel: 'ai.embeddingModel',
  similarityThreshold: 'ai.similarityThreshold',
} as const;

/** Resolve a setting value: DB `AppSetting` first, then env fallback. */
const resolveSetting = async (db: DbClient, key: string, envName: string): Promise<string | null> => {
  const row = await db.appSetting.findUnique({ where: { key } });
  if (row?.value.trim()) return row.value;
  return process.env[envName] ?? null;
};

export const isEmbeddingConfigured = async (db: DbClient): Promise<boolean> => {
  const baseUrl = await resolveSetting(db, SETTING_KEYS.baseUrl, 'AI_BASE_URL');
  const model = await resolveSetting(db, SETTING_KEYS.model, 'AI_MODEL');
  return Boolean(baseUrl && model);
};

export const getEmbeddingModelId = async (db: DbClient): Promise<string> => {
  const setting = await resolveSetting(db, SETTING_KEYS.embeddingModel, 'AI_EMBEDDING_MODEL');
  if (setting) return setting;
  const model = await resolveSetting(db, SETTING_KEYS.model, 'AI_MODEL');
  if (model) return model;
  return 'text-embedding-3-small';
};

export const getEmbeddingSimilarityThreshold = async (db: DbClient): Promise<number> => {
  const setting = await resolveSetting(db, SETTING_KEYS.similarityThreshold, 'AI_EMBEDDING_SIMILARITY_THRESHOLD');
  const value = setting ? Number.parseFloat(setting) : Number.NaN;
  if (Number.isNaN(value) || value <= 0) return 0.5;
  return value;
};

/** pgvector literal — `[v1,v2,...]` with no quotes. */
export const toPgVectorLiteral = (vec: number[]): string => `[${vec.join(',')}]`;

/** Embedding input for one knowledge chunk. */
export const buildEmbedText = (title: string, content: string): string => `${title}\n\n${content}`;

const getProvider = async (db: DbClient) => {
  const baseUrl = (await resolveSetting(db, SETTING_KEYS.baseUrl, 'AI_BASE_URL')) ?? 'http://localhost:20128/v1';
  return createOpenAICompatible({
    name: 'embedding-router',
    baseURL: baseUrl,
    apiKey: process.env.AI_API_KEY ?? '',
  });
};

/** Single embedding. Never throws — returns null when unconfigured or on error. */
export const generateEmbedding = async (db: DbClient, text: string): Promise<number[] | null> => {
  if (!(await isEmbeddingConfigured(db))) return null;
  try {
    const { embedding } = await embed({
      model: (await getProvider(db)).embeddingModel(await getEmbeddingModelId(db)),
      value: text,
    });
    return embedding;
  } catch {
    return null;
  }
};

/** Batch embeddings in chunks of 32. Never throws — returns null when unconfigured or on error. */
export const generateEmbeddings = async (db: DbClient, values: string[]): Promise<number[][] | null> => {
  if (!(await isEmbeddingConfigured(db))) return null;
  const model = (await getProvider(db)).embeddingModel(await getEmbeddingModelId(db));
  const CHUNK_SIZE = 32;
  const embeddings: number[][] = [];
  try {
    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const { embeddings: chunkEmbeddings } = await embedMany({
        model,
        values: values.slice(i, i + CHUNK_SIZE),
      });
      embeddings.push(...chunkEmbeddings);
    }
    return embeddings;
  } catch {
    return null;
  }
};

/** Write a chunk embedding via raw SQL (Prisma cannot write `vector` types). */
export const upsertChunkEmbedding = async (id: string, vec: number[], model: string): Promise<void> => {
  await prisma.$executeRawUnsafe(
    'UPDATE knowledge_chunks SET embedding = $2::vector, embedding_model = $3, embedding_updated_at = now(), embedding_status = $4 WHERE id = $1',
    id,
    toPgVectorLiteral(vec),
    model,
    'EMBEDDED',
  );
};

/** Clear a chunk embedding via raw SQL (called before re-embedding on edit). */
export const clearChunkEmbedding = async (id: string): Promise<void> => {
  await prisma.$executeRawUnsafe(
    'UPDATE knowledge_chunks SET embedding = NULL, embedding_status = $2 WHERE id = $1',
    id,
    'PENDING',
  );
};

/** Set only the embedding status on a chunk. */
export const setChunkEmbeddingStatus = async (
  id: string,
  status: 'PENDING' | 'EMBEDDED' | 'FAILED',
): Promise<void> => {
  await prisma.$executeRawUnsafe('UPDATE knowledge_chunks SET embedding_status = $2 WHERE id = $1', id, status);
};

/** Embed one chunk and persist the vector. Never throws — false on any failure. */
export const embedKnowledgeChunkBestEffort = async (
  db: DbClient,
  id: string,
  title: string,
  content: string,
): Promise<boolean> => {
  try {
    if (!(await isEmbeddingConfigured(db))) return false; // unconfigured: leave status PENDING
    const vec = await generateEmbedding(db, buildEmbedText(title, content));
    if (!vec) {
      await setChunkEmbeddingStatus(id, 'FAILED');
      return false;
    }
    await upsertChunkEmbedding(id, vec, await getEmbeddingModelId(db)); // status becomes EMBEDDED
    return true;
  } catch {
    await setChunkEmbeddingStatus(id, 'FAILED').catch(() => undefined); // keep never-throws contract
    return false;
  }
};
