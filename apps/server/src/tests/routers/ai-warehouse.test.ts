/**
 * Focused coverage for the AI warehouse router's service-error → tRPC mapping.
 *
 * The service never throws — it returns `{ error }` results. The router maps
 * unconfigured AI / provider failures to SERVICE_UNAVAILABLE (503), while
 * genuinely unexpected failures stay INTERNAL_SERVER_ERROR (500).
 *
 * The service is mocked so both branches are deterministic and no LLM call is
 * ever made.
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/ai-warehouse-service.js', () => ({
  analyzePutawayLines: vi.fn(),
  suggestPutawayAssignments: vi.fn(),
  analyzePickLines: vi.fn(),
  suggestPickAssignments: vi.fn(),
}));

// vitest.config.ts sets `isolate: false`, so this worker shares one module
// registry across test files. Another file has already imported the real
// service (helpers/caller.ts → router.ts), so a plain vi.mock would be ignored.
// Reset the registry so the mock above is authoritative for the imports below.
vi.resetModules();
const { createCaller } = await import('../helpers/caller.js');
const service = await import('../../lib/ai-warehouse-service.js');
const { seedRoleWithPermissions, seedTestUser } = await import('../helpers/seed.js');
const { prisma } = await import('../../lib/prisma.js');

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['transaction@putaway', 'transaction@dispatch']);
  const actor = await seedTestUser({
    roleId: role.id,
    email: `ai-warehouse-${randomUUID()}@example.com`,
    name: 'AI Warehouse Test Actor',
  });
  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('aiWarehouse router service-error mapping', () => {
  it('maps an unconfigured AI ("AI not configured") to SERVICE_UNAVAILABLE', async () => {
    vi.mocked(service.analyzePutawayLines).mockResolvedValueOnce({
      error: 'AI not configured: no chat model available.',
    });
    await expect(caller.aiWarehouse.analyzePutaway({})).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('maps a provider failure ("AI analysis failed") to SERVICE_UNAVAILABLE', async () => {
    vi.mocked(service.analyzePickLines).mockResolvedValueOnce({
      error: 'AI analysis failed: upstream timeout',
    });
    await expect(caller.aiWarehouse.analyzePick({})).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('keeps a genuinely unexpected service failure as INTERNAL_SERVER_ERROR', async () => {
    vi.mocked(service.suggestPutawayAssignments).mockResolvedValueOnce({
      error: 'Unexpected AI warehouse service failure: database exploded',
    });
    await expect(
      caller.aiWarehouse.suggestPutaway({ warehouseId: randomUUID(), inboundTransactionId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
  });
});
