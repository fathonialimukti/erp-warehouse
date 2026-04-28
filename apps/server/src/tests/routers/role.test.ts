import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { createCaller } from '../helpers/caller.js';
import { seedPermission, seedRoleWithPermissions, seedTestUser } from '../helpers/seed.js';
import { prisma } from '../../lib/prisma.js';

let caller: ReturnType<typeof createCaller>;
let actorUserId: string;
let actorRoleId: string;
const createdRoleIds: string[] = [];

beforeAll(async () => {
  const role = await seedRoleWithPermissions([
    'role@read',
    'role@create',
    'role@update',
    'role@delete',
  ]);

  const actor = await seedTestUser({
    roleId: role.id,
    email: `actor-${randomUUID()}@example.com`,
    name: 'Role Test Actor',
  });

  actorRoleId = role.id;
  actorUserId = actor.id;
  caller = createCaller({ userId: actor.id, email: actor.email, name: actor.name });
});

afterAll(async () => {
  if (createdRoleIds.length > 0) {
    await prisma.role.deleteMany({ where: { id: { in: createdRoleIds } } });
  }
  await prisma.user.delete({ where: { id: actorUserId } });
  await prisma.role.delete({ where: { id: actorRoleId } });
});

describe('role router', () => {
  it('creates a role with permissions and logs activity', async () => {
    const permission = await seedPermission(`TEST_ROLE_PERMISSION_CREATE_${randomUUID()}`, 'Permission for create test');

    const role = await caller.accessControl.role.create({
      name: `TEST_ROLE_CREATE_${randomUUID()}`,
      permissions: [permission.id],
    });

    expect(role.id).toBeTruthy();
    expect(role.permissions.map((rp) => rp.permission.id)).toContain(permission.id);

    createdRoleIds.push(role.id);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'role',
        resourceId: role.id,
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('updates a role and logs activity', async () => {
    const permissionA = await seedPermission(`TEST_ROLE_PERMISSION_UPDATE_A_${randomUUID()}`, 'Permission A');
    const permissionB = await seedPermission(`TEST_ROLE_PERMISSION_UPDATE_B_${randomUUID()}`, 'Permission B');

    const role = await prisma.role.create({
      data: {
        name: `TEST_ROLE_UPDATE_${randomUUID()}`,
        permissions: {
          create: [{ permissionId: permissionA.id }],
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    createdRoleIds.push(role.id);

    const updated = await caller.accessControl.role.update({
      id: role.id,
      name: `${role.name}-UPDATED`,
      permissions: [permissionB.id],
    });

    expect(updated.name).toContain('-UPDATED');
    expect(updated.permissions.map((rp) => rp.permission.id)).toEqual([permissionB.id]);

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'role',
        resourceId: updated.id,
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });

  it('deletes a role and logs activity', async () => {
    const permission = await seedPermission(`TEST_ROLE_PERMISSION_DELETE_${randomUUID()}`, 'Permission for delete test');

    const role = await prisma.role.create({
      data: {
        name: `TEST_ROLE_DELETE_${randomUUID()}`,
        permissions: {
          create: [{ permissionId: permission.id }],
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    const response = await caller.accessControl.role.delete({ id: role.id });
    expect(response.success).toBe(true);

    const deletedRole = await prisma.role.findUnique({ where: { id: role.id } });
    expect(deletedRole).toBeNull();

    const activity = await prisma.activityLog.findFirst({
      where: {
        resource: 'role',
        resourceId: role.id,
        action: 'DELETE',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(activity).toBeTruthy();
  });
});
