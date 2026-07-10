import { prisma } from './prisma.js';

export async function retrieveRelevantChunks(query: string, limit = 5): Promise<string> {
    if (!query.trim()) return '';

    const chunks = await prisma.$queryRaw<Array<{ title: string; content: string }>>`
        SELECT title, content
        FROM knowledge_chunks
        WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${query})
        ORDER BY ts_rank(
            to_tsvector('english', title || ' ' || content),
            plainto_tsquery('english', ${query})
        ) DESC
        LIMIT ${limit}
    `;

    if (chunks.length === 0) return '';

    return chunks.map(c => `### ${c.title}\n${c.content}`).join('\n\n');
}
