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
  await prisma.appSetting.deleteMany({ where: { key: testKey } });
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
});
