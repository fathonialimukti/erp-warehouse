import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser, deleteTestRole, deleteTestUser } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';
import { splitIntoChunks } from '../../lib/knowledge-ingest.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
const docIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'knowledge@read',
    'knowledge@create',
    'knowledge@update',
    'knowledge@delete',
  ]);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `knowledge-actor-${randomUUID()}@example.com`,
    name: 'Knowledge Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (docIds.length > 0) {
    const docs = await prisma.knowledgeDocument.findMany({
      where: { id: { in: docIds } },
      select: { slug: true },
    });
    await prisma.knowledgeChunk.deleteMany({
      where: { source: { in: docs.map((d) => d.slug) } },
    });
    await prisma.knowledgeDocument.deleteMany({ where: { id: { in: docIds } } });
  }
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
});

describe('knowledge-ingest splitIntoChunks', () => {
  it('splits markdown by headings and keeps short sections', () => {
    const chunks = splitIntoChunks(
      '# Title\n\nShort intro paragraph about warehouse ops.\n\n## Section\n\nMore detail about receiving goods and putaway flow.',
      'general',
    );
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.title).toBe('Title');
  });
});

describe('knowledge router', () => {
  it('creates, reindexes, deactivates, and deletes with chunk lifecycle', async () => {
    const slug = `kb-${randomUUID().slice(0, 8)}`;
    const content = `# ${slug}\n\nThis is a knowledge document used for router tests. It must be long enough to form a chunk.`;

    const created = await caller.knowledge.create({
      slug,
      title: 'Test Knowledge',
      content,
      isActive: true,
    });
    expect(created.slug).toBe(slug);
    expect(created.chunkCount).toBeGreaterThan(0);
    docIds.push(created.id);

    const chunkCountAfterCreate = await prisma.knowledgeChunk.count({ where: { source: slug } });
    expect(chunkCountAfterCreate).toBe(created.chunkCount);

    const reindexed = await caller.knowledge.reindex({ id: created.id });
    expect(reindexed.success).toBe(true);
    expect(reindexed.chunks).toBe(chunkCountAfterCreate);

    const deactivated = await caller.knowledge.update({
      id: created.id,
      isActive: false,
    });
    expect(deactivated.isActive).toBe(false);
    expect(deactivated.chunkCount).toBe(0);
    expect(await prisma.knowledgeChunk.count({ where: { source: slug } })).toBe(0);

    const activated = await caller.knowledge.update({
      id: created.id,
      isActive: true,
    });
    expect(activated.isActive).toBe(true);
    expect(activated.chunkCount).toBeGreaterThan(0);

    const deleted = await caller.knowledge.delete({ id: created.id });
    expect(deleted.success).toBe(true);
    expect(await prisma.knowledgeDocument.findUnique({ where: { id: created.id } })).toBeNull();
    expect(await prisma.knowledgeChunk.count({ where: { source: slug } })).toBe(0);
    docIds.pop();
  });
});
