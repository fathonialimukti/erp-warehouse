import { prisma } from './prisma.js';
import {
    generateEmbedding,
    getEmbeddingSimilarityThreshold,
    isEmbeddingConfigured,
    toPgVectorLiteral,
} from './ai-embedding.js';

export type KnowledgeHit = { id: string; title: string; content: string; source: string; rank: number };

/** Postgres full-text search over knowledge chunks. rank = the ts_rank value. */
export const searchKnowledgeChunksFts = async (query: string, limit: number): Promise<KnowledgeHit[]> => {
    if (!query.trim()) return [];

    return prisma.$queryRaw<KnowledgeHit[]>`
        SELECT id, title, content, source,
               ts_rank(
                   to_tsvector('english', title || ' ' || content),
                   plainto_tsquery('english', ${query})
               ) AS rank
        FROM knowledge_chunks
        WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${query})
        ORDER BY rank DESC
        LIMIT ${limit}
    `;
};

/** pgvector cosine similarity search. Never throws — [] when unconfigured, no embedded rows, or on error. */
export const searchKnowledgeChunksVector = async (
    query: string,
    limit: number,
    threshold?: number,
): Promise<KnowledgeHit[]> => {
    if (!query.trim()) return [];

    try {
        if (!(await isEmbeddingConfigured(prisma))) return [];

        const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) AS count FROM knowledge_chunks WHERE embedding IS NOT NULL
        `;
        if (rows.length === 0 || Number(rows[0]!.count) === 0) return [];

        const vec = await generateEmbedding(prisma, query);
        if (!vec) return [];

        const similarity = threshold ?? (await getEmbeddingSimilarityThreshold(prisma));
        // $1 threshold, $2 vector literal, $3 limit — all bound params.
        return prisma.$queryRawUnsafe<KnowledgeHit[]>(
            `SELECT id, title, content, source,
                   1 - (embedding <=> $2::vector) AS rank
             FROM knowledge_chunks
             WHERE embedding IS NOT NULL
               AND 1 - (embedding <=> $2::vector) >= $1
             ORDER BY rank DESC
             LIMIT $3`,
            similarity,
            toPgVectorLiteral(vec),
            limit,
        );
    } catch {
        return [];
    }
};

/** Merge two hit lists: dedupe by id (fall back to content), keep higher rank, sort rank desc, slice to limit. */
export const mergeKnowledgeHits = (primary: KnowledgeHit[], secondary: KnowledgeHit[], limit: number): KnowledgeHit[] => {
    const best = new Map<string, KnowledgeHit>();
    for (const hit of [...primary, ...secondary]) {
        const key = hit.id || hit.content;
        const current = best.get(key);
        if (!current || hit.rank > current.rank) best.set(key, hit);
    }
    return [...best.values()].sort((a, b) => b.rank - a.rank).slice(0, limit);
};

/** Hybrid retrieval: FTS always; vector search added when embeddings are configured and populated. Never throws. */
export const searchKnowledgeChunks = async (query: string, limit = 5): Promise<KnowledgeHit[]> => {
    if (!query.trim()) return [];

    let ftsHits: KnowledgeHit[] = [];
    try {
        ftsHits = await searchKnowledgeChunksFts(query, limit);
    } catch {
        ftsHits = []; // FTS unavailable — still try vector below
    }

    let vectorHits: KnowledgeHit[] = [];
    try {
        if (await isEmbeddingConfigured(prisma)) {
            vectorHits = await searchKnowledgeChunksVector(query, limit);
        }
    } catch {
        vectorHits = []; // fall back to FTS-only
    }

    return mergeKnowledgeHits(ftsHits, vectorHits, limit);
};

/** Markdown for system-prompt injection; '' for empty input. */
export const formatKnowledgeHits = (hits: KnowledgeHit[]): string => {
    if (hits.length === 0) return '';
    return hits.map(hit => `### ${hit.title}\n${hit.content}`).join('\n\n');
};

/** Thin wrapper keeping the pre-hybrid API — routes/ai.ts consumes this unchanged. */
export const retrieveRelevantChunks = async (query: string, limit = 5): Promise<string> =>
    formatKnowledgeHits(await searchKnowledgeChunks(query, limit));
