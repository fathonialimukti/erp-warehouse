import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import {
  seedRoleWithPermissions,
  seedTestUser,
  deleteTestRole,
  } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'user@read',
    'user@create',
    'user@update',
    'user@delete',
  ]);
  actorRoleId = role.id;

  const actor = await seedTestUser({
    roleId: actorRoleId,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Test Actor',
  });

  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }

  await prisma.user.deleteMany({ where: { id: actorUserId } });
  await deleteTestRole(actorRoleId);
});

describe('user router', () => {
  it('creates a user and logs activity', async () => {
    const email = `user-${randomUUID()}@example.com`;
    const createdUser = await caller.user.create({
      name: 'Created User',
      email,
      password: 'Test1234!',
      roleId: actorRoleId,
    });

    expect(createdUser.id).toBeTruthy();
    expect(createdUser.email).toBe(email);
    expect(createdUser.name).toBe('Created User');

    createdUserIds.push(createdUser.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'user',
        resourceId: createdUser.id,
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('updates a user and logs activity', async () => {
    const email = `user-${randomUUID()}@example.com`;
    const createdUser = await caller.user.create({
      name: 'Update Target',
      email,
      password: 'Test1234!',
      roleId: actorRoleId,
    });

    createdUserIds.push(createdUser.id);

    const updated = await caller.user.update({
      id: createdUser.id,
      name: 'Updated User',
      email: `updated-${randomUUID()}@example.com`,
    });

    expect(updated.name).toBe('Updated User');
    expect(updated.email).not.toBe(email);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'user',
        resourceId: createdUser.id,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('deletes a user and logs activity', async () => {
    const email = `user-${randomUUID()}@example.com`;
    const createdUser = await caller.user.create({
      name: 'Delete Target',
      email,
      password: 'Test1234!',
      roleId: actorRoleId,
    });

    const response = await caller.user.delete({ id: createdUser.id });
    expect(response.success).toBe(true);

    const deletedUser = await prisma.user.findUnique({ where: { id: createdUser.id } });
    expect(deletedUser).toBeNull();

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'user',
        resourceId: createdUser.id,
        action: 'DELETE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });
});
