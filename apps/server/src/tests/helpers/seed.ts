import { prisma } from '../../lib/prisma.js';

const randomName = (prefix: string) => `${prefix}-${Math.random().toString(36).substring(2, 10)}`;

export const seedPermission = async (name: string, description?: string) => {
  return prisma.permission.upsert({
    where: { name },
    create: { name, description: description ?? null },
    update: {},
  });
};

export const seedRoleWithPermissions = async (permissions: string[]) => {
  const role = await prisma.role.create({
    data: {
      name: randomName('TEST_ROLE'),
      description: 'Generated test role',
    },
  });

  for (const permissionName of permissions) {
    const permission = await seedPermission(permissionName);
    await prisma.roleHasPermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }

  return role;
};

export const seedTestActor = async (permissions: string[]) => {
  const role = await seedRoleWithPermissions(permissions);
  const user = await seedTestUser({
    roleId: role.id,
    email: `${randomName('actor')}@example.com`,
    name: 'Test Actor',
  });

  return { user, role };
};

export const deleteTestPermission = async (permissionId: string) => {
  await prisma.permission.delete({ where: { id: permissionId } });
};

export const seedTestUser = async (options: {
  roleId: string;
  email?: string;
  name?: string;
  password?: string;
}) => {
  const user = await prisma.user.create({
    data: {
      name: options.name ?? randomName('TEST_USER'),
      email: options.email ?? `${randomName('TEST_USER')}@example.com`,
      password: options.password ?? 'Test1234!',
      roleId: options.roleId,
    },
  });

  return user;
};

export const seedTestSku = async () => {
  return prisma.sku.create({
    data: {
      name: randomName('TEST_SKU'),
      description: 'Test SKU for integration tests',
      baseUnit: 'kg',
    },
  });
};

export const seedTestPalletType = async (skuId: string) => {
  return prisma.palletType.create({
    data: {
      skuId,
      name: randomName('TEST_PALLET_TYPE'),
      description: 'Test pallet type for integration tests',
      packageName: 'carton',
      packagesPerPallet: 1,
      quantityPerPackage: 1,
      packageUnit: 'kg',
    },
  });
};

export const seedTestWarehouse = async () => {
  return prisma.warehouse.create({
    data: {
      name: randomName('TEST_WAREHOUSE'),
      address: 'Test warehouse address',
      totalCapacity: 1000,
    },
  });
};

export const seedTestStorageLocation = async (warehouseId: string) => {
  return prisma.storageLocation.create({
    data: {
      warehouseId,
      status: 'ACTIVE',
    },
  });
};

export const seedTestPallet = async (options: {
  palletTypeId: string;
  storageLocationId?: string | null;
  status?: 'AVAILABLE' | 'NOT_AVAILABLE';
}) => {
  return prisma.pallet.create({
    data: {
      palletTypeId: options.palletTypeId,
      storageLocationId: options.storageLocationId ?? null,
      status: options.status ?? 'AVAILABLE',
    },
  });
};

export const deleteTestUser = async (userId: string) => {
  await prisma.user.delete({ where: { id: userId } });
};

export const deleteTestRole = async (roleId: string) => {
  await prisma.role.delete({ where: { id: roleId } });
};

export const deleteTestSku = async (skuId: string) => {
  await prisma.sku.delete({ where: { id: skuId } });
};

export const deleteTestPalletType = async (palletTypeId: string) => {
  await prisma.palletType.delete({ where: { id: palletTypeId } });
};

export const deleteTestWarehouse = async (warehouseId: string) => {
  await prisma.warehouse.delete({ where: { id: warehouseId } });
};

export const deleteTestStorageLocation = async (storageLocationId: string) => {
  await prisma.storageLocation.delete({ where: { id: storageLocationId } });
};
