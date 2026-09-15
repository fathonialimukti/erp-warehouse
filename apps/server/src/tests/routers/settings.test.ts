import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedRoleWithPermissions, seedTestUser, deleteTestRole, deleteTestUser } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';
import { invalidateSettingsCache } from '../../lib/app-settings.js';

let caller: ReturnType<typeof createCaller>;
let noPermCaller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
let noPermUserId: string;
let noPermRoleId: string;
const testKey = 'ratelimit.max';

beforeAll(async () => {
  const role = await seedRoleWithPermissions(['settings@read', 'settings@update']);
  actorRoleId = role.id;
  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `settings-actor-${randomUUID()}@example.com`,
    name: 'Settings Actor',
  });
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });

  const noPermRole = await seedRoleWithPermissions(['warehouse@read']);
  noPermRoleId = noPermRole.id;
  const noPermUser = await seedTestUser({
    roleId: noPermRoleId,
    email: `settings-noperm-${randomUUID()}@example.com`,
    name: 'Settings NoPerm',
  });
  noPermUserId = noPermUser.id;
  noPermCaller = createCaller({ userId: noPermUser.id, email: noPermUser.email, name: noPermUser.name });

  invalidateSettingsCache();
});

afterAll(async () => {
  await prisma.appSetting.deleteMany({
    where: { OR: [{ key: testKey }, { key: 'ai.apiKey' }, { key: 'ai.embeddingApiKey' }] },
  });
  await deleteTestUser(actorUserId);
  await deleteTestRole(actorRoleId);
  await deleteTestUser(noPermUserId);
  await deleteTestRole(noPermRoleId);
  invalidateSettingsCache();
});

describe('settings router', () => {
  it('lists all setting definitions with values', async () => {
    const result = await caller.settings.list();
    expect(result.settings.length).toBeGreaterThan(10);
    const def = result.settings.find((s) => s.key === testKey);
    expect(def).toBeDefined();
    expect(def?.value).toBeTruthy();
    expect(def?.group).toBe('ratelimit');
  });

  it('rejects list without settings@read', async () => {
    await expect(noPermCaller.settings.list()).rejects.toThrow();
  });

  it('updates a setting and reflects it in list', async () => {
    const before = await caller.settings.list();
    const def = before.settings.find((s) => s.key === testKey)!;
    const newValue = String(Number(def.value) + 1);

    const result = await caller.settings.update({
      values: [{ key: testKey, value: newValue }],
    });
    expect(result.success).toBe(true);

    invalidateSettingsCache();
    const after = await caller.settings.list();
    const updated = after.settings.find((s) => s.key === testKey)!;
    expect(updated.value).toBe(newValue);
  });

  it('rejects invalid values', async () => {
    await expect(
      caller.settings.update({ values: [{ key: testKey, value: 'not-a-number' }] }),
    ).rejects.toThrow();
    await expect(
      caller.settings.update({ values: [{ key: testKey, value: '0' }] }),
    ).rejects.toThrow();
    await expect(
      caller.settings.update({ values: [{ key: 'unknown.key', value: 'x' }] }),
    ).rejects.toThrow();
  });

  it('rejects update without settings@update', async () => {
    await expect(
      noPermCaller.settings.update({ values: [{ key: testKey, value: '123' }] }),
    ).rejects.toThrow();
  });

  it('resets a setting back to its default', async () => {
    const result = await caller.settings.reset({ key: testKey });
    expect(result.success).toBe(true);
    const after = await caller.settings.list();
    const def = after.settings.find((s) => s.key === testKey)!;
    expect(def.value).toBe(def.default);
  });

  describe.each(['ai.apiKey', 'ai.embeddingApiKey'])('%s secret handling', (secretKey) => {
    it('masks the value in list, ignores masked updates, and clears on empty', async () => {
      // Store a real key, then confirm the list only returns the mask.
      await caller.settings.update({ values: [{ key: secretKey, value: 'sk-test-secret-123' }] });
      const withKey = (await caller.settings.list()).settings.find((s) => s.key === secretKey)!;
      expect(withKey.value).toBe('********');

      // Submitting the mask back is a no-op (stored value is kept, not overwritten).
      await caller.settings.update({ values: [{ key: secretKey, value: '********' }] });
      const rawRow = await prisma.appSetting.findUnique({ where: { key: secretKey } });
      expect(rawRow?.value).toBe('sk-test-secret-123');

      // Submitting '' clears the override so the env var takes over again.
      await caller.settings.update({ values: [{ key: secretKey, value: '' }] });
      const cleared = await prisma.appSetting.findUnique({ where: { key: secretKey } });
      expect(cleared).toBeNull();
    });

    it('masks the previous value in the reset activity log', async () => {
      await caller.settings.update({ values: [{ key: secretKey, value: 'sk-reset-secret-456' }] });
      await caller.settings.reset({ key: secretKey });

      const log = await prisma.activityLog.findFirst({
        where: { resource: 'app_setting', resourceId: secretKey },
        orderBy: { createdAt: 'desc' },
      });
      const detail = log?.detail as unknown as { before?: unknown } | null;
      expect(detail?.before).toBe('********');
      expect(JSON.stringify(detail)).not.toContain('sk-reset-secret-456');
    });

    it('skips masked entries in the updated count', async () => {
      const masked = await caller.settings.update({ values: [{ key: secretKey, value: '********' }] });
      expect(masked.updated).toBe(0);

      const cleared = await caller.settings.update({ values: [{ key: secretKey, value: '' }] });
      expect(cleared.updated).toBe(1);
    });
  });

  it('keeps the raw previous value in the reset activity log for non-secret keys', async () => {
    const key = 'ratelimit.windowMs';
    await caller.settings.update({ values: [{ key, value: '120000' }] });
    await caller.settings.reset({ key });

    const log = await prisma.activityLog.findFirst({
      where: { resource: 'app_setting', resourceId: key },
      orderBy: { createdAt: 'desc' },
    });
    const detail = log?.detail as unknown as { before?: unknown } | null;
    expect(detail?.before).toBe('120000');
  });
});
