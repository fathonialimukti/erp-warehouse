/**
 * Knowledge base ingestion script.
 * Reads all .md files from src/knowledge/, splits into chunks,
 * and upserts them into the knowledge_chunks table.
 *
 * Usage: bun src/scripts/ingest-knowledge.ts
 */
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, '../knowledge');
const CHUNK_SIZE = 800; // characters per chunk

function splitIntoChunks(text: string, source: string): Array<{ title: string; content: string }> {
    const chunks: Array<{ title: string; content: string }> = [];
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

        // Split large sections into smaller chunks
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

async function ingest() {
    console.log('Reading knowledge files from:', KNOWLEDGE_DIR);

    const files = (await readdir(KNOWLEDGE_DIR)).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} knowledge file(s):`, files);

    // Clear existing chunks (full re-ingest)
    await prisma.knowledgeChunk.deleteMany({});
    console.log('Cleared existing knowledge chunks.');

    let totalChunks = 0;

    for (const file of files) {
        const source = file.replace('.md', '');
        const content = await readFile(join(KNOWLEDGE_DIR, file), 'utf-8');
        const chunks = splitIntoChunks(content, source);

        if (chunks.length === 0) continue;

        await prisma.knowledgeChunk.createMany({
            data: chunks.map(c => ({
                source,
                title: c.title,
                content: c.content,
            })),
        });

        console.log(`  ${file}: ${chunks.length} chunk(s) ingested`);
        totalChunks += chunks.length;
    }

    // Create GIN index for full-text search if it doesn't exist
    await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS knowledge_chunks_fts_idx
        ON knowledge_chunks
        USING GIN (to_tsvector('english', title || ' ' || content))
    `;

    console.log(`\n✓ Ingestion complete: ${totalChunks} total chunks stored.`);
    await prisma.$disconnect();
}

ingest().catch(err => {
    console.error('Ingestion failed:', err);
    process.exit(1);
});
