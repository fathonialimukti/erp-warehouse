/**
 * Knowledge base ingestion CLI.
 *
 * Default: reindex all active KnowledgeDocument rows into knowledge_chunks.
 * Optional: --from-disk imports apps/server/src/knowledge/*.md first (bootstrap).
 *
 * Usage:
 *   bun src/scripts/ingest-knowledge.ts
 *   bun src/scripts/ingest-knowledge.ts --from-disk
 */
import 'dotenv/config';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureKnowledgeFtsIndex,
  importKnowledgeFromDisk,
  reindexAllActive,
} from '../lib/knowledge-ingest.js';
import { prisma } from '../lib/prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = join(__dirname, '../knowledge');

async function ingest() {
  const fromDisk = process.argv.includes('--from-disk');

  if (fromDisk) {
    console.log('Importing knowledge documents from disk:', KNOWLEDGE_DIR);
    const result = await importKnowledgeFromDisk(prisma, KNOWLEDGE_DIR);
    console.log(`✓ Imported ${result.documents} document(s), ${result.chunks} chunk(s).`);
  } else {
    console.log('Reindexing active knowledge documents from DB...');
    const chunks = await reindexAllActive(prisma);
    const documents = await prisma.knowledgeDocument.count({ where: { isActive: true } });
    await ensureKnowledgeFtsIndex(prisma);
    console.log(`✓ Reindexed ${documents} active document(s) → ${chunks} chunk(s).`);
  }

  await prisma.$disconnect();
}

ingest().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
