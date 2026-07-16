import "dotenv/config";
import { hashSync } from "bcrypt";
import { faker } from "@faker-js/faker";
import { Client, type PoolClient } from "pg";
import {
  ApprovalStatus,
  DispatchOpenStatus,
  DispatchStatus,
  MovementDirection,
  PalletStatus,
  PickLineStatus,
  PutawayLineStatus,
  PutawayStatus,
  SkuType,
  StorageLocationStatus,
  WarehouseTransactionType,
} from "./generated/client.js";
import { prisma } from "../lib/prisma.js";
import { TX_CODE } from "../lib/document-number.js";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// =============================================
// SEED PALLET NUMBER HELPER
// Mirrors lib/pallet-number.ts but standalone (seed runs outside tRPC).
// Format: YYMMDDXXXX — global daily counter.
// =============================================
const seedDailyCounters = new Map<string, number>();
function nextSeedPalletNumber(date: Date): string {
  const yy = String(date.getUTCFullYear()).slice(-2).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const prefix = `${yy}${mm}${dd}`;
  const next = (seedDailyCounters.get(prefix) ?? 0) + 1;
  seedDailyCounters.set(prefix, next);
  return `${prefix}${String(next).padStart(4, '0')}`;
}

// =============================================
// ACCESS CONTROL CONSTANTS
// =============================================

const PERMISSIONS = [
  // User
  { name: "user@create", description: "Create users" },
  { name: "user@read", description: "Read users" },
  { name: "user@update", description: "Update users" },
  { name: "user@delete", description: "Delete users" },

  // Role
  { name: "role@create", description: "Create roles" },
  { name: "role@read", description: "Read roles" },
  { name: "role@update", description: "Update roles" },
  { name: "role@delete", description: "Delete roles" },

  // Permission
  { name: "permission@create", description: "Create permissions" },
  { name: "permission@read", description: "Read permissions" },
  { name: "permission@update", description: "Update permissions" },
  { name: "permission@delete", description: "Delete permissions" },

  // Warehouse
  { name: "warehouse@create", description: "Create warehouses" },
  { name: "warehouse@read", description: "Read warehouses" },
  { name: "warehouse@update", description: "Update warehouses" },
  { name: "warehouse@delete", description: "Delete warehouses" },

  // SKU
  { name: "sku@create", description: "Create SKUs" },
  { name: "sku@read", description: "Read SKUs" },
  { name: "sku@update", description: "Update SKUs" },
  { name: "sku@delete", description: "Delete SKUs" },

  // Pallet Type
  { name: "pallet_type@create", description: "Create pallet types" },
  { name: "pallet_type@read", description: "Read pallet types" },
  { name: "pallet_type@update", description: "Update pallet types" },
  { name: "pallet_type@delete", description: "Delete pallet types" },

  // Storage Location
  { name: "storage_location@create", description: "Create storage locations" },
  { name: "storage_location@read", description: "Read storage locations" },
  { name: "storage_location@update", description: "Update storage locations" },
  { name: "storage_location@delete", description: "Delete storage locations" },
  {
    name: "storage_location@import",
    description: "Import storage locations via Excel",
  },

  // Pallet
  { name: "pallet@create", description: "Create pallets" },
  { name: "pallet@read", description: "Read pallets" },
  { name: "pallet@update", description: "Update pallets" },
  { name: "pallet@delete", description: "Delete pallets" },

  // Receiving Transaction
  { name: "receiving@create", description: "Create receiving transactions" },
  { name: "receiving@read", description: "Read receiving transactions" },
  { name: "receiving@update", description: "Update receiving transactions" },
  { name: "receiving@delete", description: "Delete receiving transactions" },
  { name: "receiving@approve", description: "Approve receiving transactions" },

  // WIP Completion
  {
    name: "wip-completion@create",
    description: "Create WIP completion transactions",
  },
  {
    name: "wip-completion@read",
    description: "Read WIP completion transactions",
  },
  {
    name: "wip-completion@update",
    description: "Update WIP completion transactions",
  },
  {
    name: "wip-completion@delete",
    description: "Delete WIP completion transactions",
  },
  {
    name: "wip-completion@approve",
    description: "Approve WIP completion transactions",
  },

  // RMA Receipt
  {
    name: "rma-receipt@create",
    description: "Create RMA receipt transactions",
  },
  { name: "rma-receipt@read", description: "Read RMA receipt transactions" },
  {
    name: "rma-receipt@update",
    description: "Update RMA receipt transactions",
  },
  {
    name: "rma-receipt@delete",
    description: "Delete RMA receipt transactions",
  },
  {
    name: "rma-receipt@approve",
    description: "Approve RMA receipt transactions",
  },

  // WIP Issue
  { name: "wip-issue@create", description: "Create WIP issue transactions" },
  { name: "wip-issue@read", description: "Read WIP issue transactions" },
  { name: "wip-issue@update", description: "Update WIP issue transactions" },
  { name: "wip-issue@delete", description: "Delete WIP issue transactions" },
  { name: "wip-issue@approve", description: "Approve WIP issue transactions" },

  // Shipment
  { name: "shipment@create", description: "Create shipment transactions" },
  { name: "shipment@read", description: "Read shipment transactions" },
  { name: "shipment@update", description: "Update shipment transactions" },
  { name: "shipment@delete", description: "Delete shipment transactions" },
  { name: "shipment@approve", description: "Approve shipment transactions" },

  // Return to Supplier
  {
    name: "return-to-supplier@create",
    description: "Create return-to-supplier transactions",
  },
  {
    name: "return-to-supplier@read",
    description: "Read return-to-supplier transactions",
  },
  {
    name: "return-to-supplier@update",
    description: "Update return-to-supplier transactions",
  },
  {
    name: "return-to-supplier@delete",
    description: "Delete return-to-supplier transactions",
  },
  {
    name: "return-to-supplier@approve",
    description: "Approve return-to-supplier transactions",
  },

  // Disposal
  { name: "disposal@create", description: "Create disposal transactions" },
  { name: "disposal@read", description: "Read disposal transactions" },
  { name: "disposal@update", description: "Update disposal transactions" },
  { name: "disposal@delete", description: "Delete disposal transactions" },
  { name: "disposal@approve", description: "Approve disposal transactions" },

  // Subinventory Transfer
  {
    name: "subinventory-transfer@create",
    description: "Create subinventory transfer transactions",
  },
  {
    name: "subinventory-transfer@read",
    description: "Read subinventory transfer transactions",
  },
  {
    name: "subinventory-transfer@update",
    description: "Update subinventory transfer transactions",
  },
  {
    name: "subinventory-transfer@delete",
    description: "Delete subinventory transfer transactions",
  },
  {
    name: "subinventory-transfer@approve",
    description: "Approve subinventory transfer transactions",
  },

  // Loss Transaction
  { name: "loss@create", description: "Create loss transactions" },
  { name: "loss@read", description: "Read loss transactions" },
  { name: "loss@update", description: "Update loss transactions" },
  { name: "loss@delete", description: "Delete loss transactions" },
  { name: "loss@approve", description: "Approve loss transactions" },

  // Found Transaction
  { name: "found@create", description: "Create found transactions" },
  { name: "found@read", description: "Read found transactions" },
  { name: "found@update", description: "Update found transactions" },
  { name: "found@delete", description: "Delete found transactions" },
  { name: "found@approve", description: "Approve found transactions" },

  // Transaction execution (putaway + dispatch) — unified under transaction@*
  { name: "transaction@putaway", description: "View putaway assignment data, list/complete putaway lines, and submit pallet assignments for an IN-direction transaction (3D layout page)" },
  { name: "transaction@dispatch", description: "View dispatch assignment data, list/complete pick lines, and submit pallet dispatch assignments for an OUT-direction transaction (3D layout page)" },

  // Supplier
  { name: "supplier@create", description: "Create suppliers" },
  { name: "supplier@read", description: "Read suppliers" },
  { name: "supplier@update", description: "Update suppliers" },
  { name: "supplier@delete", description: "Delete suppliers" },

  // Product (finished-good SKU management)
  { name: "product@create", description: "Create products (finished-good SKUs)" },
  { name: "product@read", description: "Read products (finished-good SKUs)" },
  { name: "product@update", description: "Update products (finished-good SKUs)" },
  { name: "product@delete", description: "Delete products (finished-good SKUs)" },

  // Stock Movement
  { name: "stock-movement@read", description: "Read stock movements" },

  // Activity Log
  { name: "activity_log@read", description: "Read activity logs" },

  // Notification (admin)
  { name: "notification@read", description: "View all users' notifications" },
  { name: "notification@delete", description: "Delete notifications" },
  {
    name: "notification@broadcast",
    description: "Broadcast notifications to users",
  },

  // Inventory Aging Analyzer
  { name: "inventoryAging@read", description: "View inventory aging analytics (dead stock, slow moving, value at risk)" },

  // AI System Admin
  { name: "ai_admin@access", description: "Access AI System Admin (full database read/write)" },
];

const ROLES = [{ name: "System Admin", description: "Full system access" }];

const INBOUND_TYPES = [
  "receiving",
  "wip-completion",
  "rma-receipt",
  "found",
] as const;
const OUTBOUND_TYPES = [
  "wip-issue",
  "shipment",
  "return-to-supplier",
  "disposal",
] as const;
const ALL_TRANSACTION_TYPES = [
  ...INBOUND_TYPES,
  ...OUTBOUND_TYPES,
  "subinventory-transfer",
  "loss",
] as const;

const ROLE_PERMISSIONS: Record<string, string[]> = {
  "System Admin": ["*"],

  "Warehouse Manager": [
    "warehouse@*",
    "sku@*",
    "pallet_type@*",
    "storage_location@*",
    "pallet@*",
    "supplier@*",
    "product@*",
    "stock-movement@read",
    "activity_log@read",
    "transaction@putaway",
    "transaction@dispatch",
    ...ALL_TRANSACTION_TYPES.flatMap((t) => [`${t}@*`]),
  ],

  "Warehouse Operator": [
    "warehouse@read",
    "sku@read",
    "pallet_type@read",
    "storage_location@read",
    "pallet@read",
    "pallet@create",
    "pallet@update",
    "supplier@read",
    "stock-movement@read",
    "transaction@putaway",
    "transaction@dispatch",
    ...ALL_TRANSACTION_TYPES.flatMap((t) => [
      `${t}@read`,
      `${t}@create`,
      `${t}@update`,
    ]),
  ],

  Approver: [
    "activity_log@read",
    "stock-movement@read",
    ...ALL_TRANSACTION_TYPES.flatMap((t) => [`${t}@read`, `${t}@approve`]),
  ],
};

// =============================================
// ACCESS CONTROL FUNCTIONS
// =============================================

function normalizePermissionName(permission: string) {
  if (permission.includes("@")) return permission;
  return permission.replace(/_([^_]+)$/, "@$1");
}

function normalizePattern(pattern: string) {
  if (pattern === "*") return pattern;
  if (pattern.includes("@")) return pattern;
  return normalizePermissionName(pattern);
}

function matchesPattern(permName: string, patterns: string[]): boolean {
  const normalizedPermission = normalizePermissionName(permName);
  return patterns.some((pattern) => {
    if (pattern === "*") return true;
    const normalizedPattern = normalizePattern(pattern);
    if (normalizedPattern === normalizedPermission) return true;
    if (normalizedPattern.endsWith("@*")) {
      const prefix = normalizedPattern.slice(0, -2);
      return normalizedPermission.startsWith(prefix + "@");
    }
    return false;
  });
}

async function seedPermissionsAndRoles(client: Client | PoolClient) {
  console.log("Cleaning existing permissions and roles...");
  await client.query(
    "UPDATE users SET role_id = NULL WHERE role_id IS NOT NULL",
  );
  await client.query("DELETE FROM role_has_permissions");
  await client.query("DELETE FROM permissions");
  await client.query("DELETE FROM roles");
  console.log("✓ Cleaned existing permissions and roles");

  console.log("Ensuring permission, role, and user IDs have DB defaults...");
  await client.query(`
    ALTER TABLE permissions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE roles ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  `);

  console.log("Seeding permissions...");
  for (const perm of PERMISSIONS) {
    await client.query(
      `
      INSERT INTO permissions (name, description, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
    `,
      [perm.name, perm.description],
    );
  }
  console.log(`✓ ${PERMISSIONS.length} permissions seeded`);

  console.log("Seeding roles...");
  const roleIds: Record<string, string> = {};
  for (const role of ROLES) {
    const result = await client.query(
      `
      INSERT INTO roles (name, description, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      RETURNING id
    `,
      [role.name, role.description],
    );
    roleIds[role.name] = result.rows[0].id;
  }
  console.log(`✓ ${ROLES.length} roles seeded`);

  console.log("Assigning permissions to roles...");
  const { rows: allPermissions } = await client.query(
    "SELECT id, name FROM permissions",
  );

  for (const [roleName, patterns] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleIds[roleName];
    if (!roleId) continue;

    for (const perm of allPermissions) {
      if (matchesPattern(perm.name, patterns)) {
        await client.query(
          `
          INSERT INTO role_has_permissions (role_id, permission_id, created_at, updated_at)
          VALUES ($1, $2, NOW(), NOW())
        `,
          [roleId, perm.id],
        );
      }
    }
  }
  console.log("✓ Permissions assigned to roles");

  return roleIds;
}

// =============================================
// USER SEEDER FUNCTIONS
// =============================================

async function seedUsers(client: Client) {
  console.log("Ensuring admin user exists...");
  const hashedPassword = hashSync("password", 10);

  const existingUser = await client.query(
    "SELECT id FROM users WHERE email = $1",
    ["admin@mail.com"],
  );

  if (existingUser.rows.length > 0) {
    await client.query(
      "UPDATE users SET name = $1, password = $2, updated_at = NOW() WHERE email = $3",
      ["Admin", hashedPassword, "admin@mail.com"],
    );
    console.log("✓ Admin user updated");
  } else {
    await client.query(
      "INSERT INTO users (email, name, password, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())",
      ["admin@mail.com", "Admin", hashedPassword],
    );
    console.log("✓ Admin user created");
  }
}

async function assignRoleToAdmin(
  client: Client,
  roleIds: { [key: string]: string },
) {
  console.log("Assigning role to admin user...");
  const adminUser = await client.query(
    "SELECT id FROM users WHERE email = $1",
    ["admin@mail.com"],
  );

  if (adminUser.rows.length > 0) {
    await client.query(
      "UPDATE users SET role_id = $1, updated_at = NOW() WHERE id = $2",
      [roleIds["System Admin"], adminUser.rows[0].id],
    );
    console.log("✓ System Admin role assigned to admin user");
    return adminUser.rows[0].id;
  }

  throw new Error("Admin user not found");
}

// =============================================
// GENERATE FAKE DATA TYPES & CONSTANTS
// =============================================

interface SeedUsers {
  creatorId: string;
  approverId: string;
  operatorId: string;
}

interface AvailablePallet {
  id: string;
  skuId: string;
  warehouseId: string;
  storageLocationId: string;
  packagesPerPallet: number;
  quantityPerPackage: number;
}

interface MovementEvent {
  skuId: string;
  warehouseId: string;
  date: Date;
  signedQty: number;
}

interface WarehouseSeed {
  id: string;
  objectId: string | null;
}

const MONTH_WINDOW = Number(process.env.SEED_MONTHS) || 4;
const FAKER_SEED = Number(process.env.SEED_SEED) || 20260519;
const SKIP_RESET = process.env.SEED_SKIP_RESET === 'true';

const documentCounters = new Map<string, number>();
const transferredPalletIds = new Set<string>();

// =============================================
// GENERATE FAKE DATA UTILITY FUNCTIONS
// =============================================

const pickOne = <T>(items: T[]): T => {
  if (!items.length) {
    throw new Error("Cannot pick from empty array");
  }
  const idx = faker.number.int({ min: 0, max: items.length - 1 });
  return items[idx]!;
};

const sampleMany = <T>(items: T[], count: number): T[] => {
  if (count <= 0) return [];
  if (count >= items.length) return [...items];

  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    const idx = faker.number.int({ min: 0, max: pool.length - 1 });
    const [picked] = pool.splice(idx, 1);
    if (picked) {
      out.push(picked);
    }
  }
  return out;
};

const toMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const nextDocumentNumber = (
  type: WarehouseTransactionType,
  warehouseCode: string,
  date: Date,
): string => {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  const key = `${type}/${warehouseCode}/${year}/${month}`;
  const nextIndex = (documentCounters.get(key) ?? 0) + 1;
  documentCounters.set(key, nextIndex);
  const index = String(nextIndex).padStart(4, "0");
  return `${TX_CODE[type]}/${warehouseCode}/${month}/${year}/${index}`;
};

const palletQuantity = (sku: { packagesPerPallet: number; quantityPerPackage: number }): number =>
  sku.packagesPerPallet * sku.quantityPerPackage;

const isoDateInMonth = (monthStart: Date): Date => {
  const day = faker.number.int({ min: 1, max: 26 });
  return new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day),
  );
};

const monthStarts = (monthCount: number): Date[] => {
  const now = new Date();
  const starts: Date[] = [];
  for (let i = monthCount - 1; i >= 0; i -= 1) {
    starts.push(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)),
    );
  }
  return starts;
};

const createApprovalHistory = (approvedById: string, approvedAt: Date) => [
  {
    action: "APPROVED",
    by: approvedById,
    at: approvedAt.toISOString(),
  },
];

// =============================================
// GENERATE FAKE DATA MASTER DATA FUNCTIONS
// =============================================

const ensureUsers = async (): Promise<SeedUsers> => {
  const password = hashSync("password", 10);

  const creator = await prisma.user.upsert({
    where: { email: "seed.creator@factory.local" },
    update: { name: "Seed Creator", password },
    create: {
      email: "seed.creator@factory.local",
      name: "Seed Creator",
      password,
    },
    select: { id: true },
  });

  const approver = await prisma.user.upsert({
    where: { email: "seed.approver@factory.local" },
    update: { name: "Seed Approver", password },
    create: {
      email: "seed.approver@factory.local",
      name: "Seed Approver",
      password,
    },
    select: { id: true },
  });

  const operator = await prisma.user.upsert({
    where: { email: "seed.operator@factory.local" },
    update: { name: "Seed Operator", password },
    create: {
      email: "seed.operator@factory.local",
      name: "Seed Operator",
      password,
    },
    select: { id: true },
  });

  return {
    creatorId: creator.id,
    approverId: approver.id,
    operatorId: operator.id,
  };
};

const resetWarehouseDomain = async (): Promise<void> => {
  await prisma.pickLine.deleteMany();
  await prisma.putawayLine.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.skuInventoryBalance.deleteMany();

  await prisma.subinventoryTransferItem.deleteMany();
  await prisma.lossTransactionItem.deleteMany();
  await prisma.foundTransactionItem.deleteMany();
  await prisma.disposalItem.deleteMany();
  await prisma.returnToSupplierItem.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.wipIssueItem.deleteMany();
  await prisma.rmaReceiptItem.deleteMany();
  await prisma.wipCompletionItem.deleteMany();
  await prisma.receivingTransactionItem.deleteMany();

  await prisma.subinventoryTransfer.deleteMany();
  await prisma.lossTransaction.deleteMany();
  await prisma.foundTransaction.deleteMany();
  await prisma.disposal.deleteMany();
  await prisma.returnToSupplier.deleteMany();
  await prisma.rmaReceipt.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.wipIssue.deleteMany();
  await prisma.wipCompletion.deleteMany();
  await prisma.receivingTransaction.deleteMany();

  await prisma.pallet.deleteMany();
  await prisma.supplierSku.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.sku.deleteMany();
  await prisma.storageLocation.deleteMany();
  await prisma.warehouse.deleteMany();
};

const seedMasterData = async (): Promise<{
  warehouses: WarehouseSeed[];
  supplierIds: string[];
  freeLocations: Map<string, Set<string>>;
  skus: { id: string; code: string | null; packagesPerPallet: number; quantityPerPackage: number }[];
}> => {
  const warehouseData = [
    {
      objectId: "WH01",
      name: "Raw Material Hub",
      address: "Kawasan Industri Delta Blok A1, Bekasi",
      totalCapacity: 264,
    },
    {
      objectId: "WH02",
      name: "Production Buffer Warehouse",
      address: "Kawasan Industri Delta Blok B4, Bekasi",
      totalCapacity: 108,
    },
    {
      objectId: "WH03",
      name: "Finished Goods Distribution Center",
      address: "Kawasan Industri Delta Blok C7, Bekasi",
      totalCapacity: 324,
    },
  ];

  const warehouses = await Promise.all(
    warehouseData.map((warehouse) =>
      prisma.warehouse.create({
        data: {
          ...warehouse,
          code: warehouse.objectId,
        },
        select: { id: true, objectId: true, code: true },
      }),
    ),
  );

  const warehouseLocationPlan: Record<
    string,
    { RACK: number; FLOOR: number }
  > = {
    WH01: { RACK: 216, FLOOR: 48 },
    WH02: { RACK: 0, FLOOR: 108 },
    WH03: { RACK: 324, FLOOR: 0 },
  };

  for (const warehouse of warehouses) {
    const warehouseCode =
      warehouse.objectId ?? warehouse.id.slice(0, 4).toUpperCase();

    const locationPlan = warehouseLocationPlan[warehouseCode];
    if (!locationPlan) {
      throw new Error(`Missing storage location plan for warehouse ${warehouseCode}`);
    }

    const locations = (
      ["RACK", "FLOOR"] as const
    ).flatMap((locationType) =>
      Array.from({ length: locationPlan[locationType] }, (_, index) => ({
        id: `${warehouseCode}/${locationType}/${String(index + 1).padStart(4, "0")}`,
        warehouseId: warehouse.id,
        status: StorageLocationStatus.ACTIVE,
      })),
    );

    await prisma.storageLocation.createMany({ data: locations });
  }

  const skuData = [
    // Raw Materials — Grain
    {
      code: "RM-RICE-25",
      name: "Raw Rice Paddy 25kg",
      type: SkuType.RAW_MATERIAL,
      baseUnit: "kg",
      packageName: "sack",
      packagesPerPallet: 40,
      quantityPerPackage: 25,
      packageUnit: "kg",
      length: 1200,
      width: 1000,
      height: 1400,
      maxWeight: 1000,
    },
    {
      code: "RM-RICE-50",
      name: "Raw Rice Paddy 50kg",
      type: SkuType.RAW_MATERIAL,
      baseUnit: "kg",
      packageName: "sack",
      packagesPerPallet: 20,
      quantityPerPackage: 50,
      packageUnit: "kg",
      length: 1200,
      width: 1000,
      height: 1600,
      maxWeight: 1000,
    },
    // Raw Materials — Oil
    {
      code: "RM-OIL-20",
      name: "Crude Palm Oil Drum 20L",
      type: SkuType.RAW_MATERIAL,
      baseUnit: "liter",
      packageName: "drum",
      packagesPerPallet: 24,
      quantityPerPackage: 20,
      packageUnit: "liter",
      length: 1200,
      width: 1000,
      height: 1100,
      maxWeight: 960,
    },
    {
      code: "RM-OIL-200",
      name: "Crude Palm Oil IBC 200L",
      type: SkuType.RAW_MATERIAL,
      baseUnit: "liter",
      packageName: "IBC tote",
      packagesPerPallet: 1,
      quantityPerPackage: 200,
      packageUnit: "liter",
      length: 1200,
      width: 1000,
      height: 1200,
      maxWeight: 200,
    },
    // Raw Materials — Other
    {
      code: "RM-SUGAR-50",
      name: "Raw Cane Sugar 50kg",
      type: SkuType.RAW_MATERIAL,
      baseUnit: "kg",
      packageName: "bag",
      packagesPerPallet: 20,
      quantityPerPackage: 50,
      packageUnit: "kg",
      length: 1200,
      width: 1000,
      height: 1500,
      maxWeight: 1000,
    },
    {
      code: "RM-SALT-25",
      name: "Iodized Salt 25kg",
      type: SkuType.RAW_MATERIAL,
      baseUnit: "kg",
      packageName: "sack",
      packagesPerPallet: 40,
      quantityPerPackage: 25,
      packageUnit: "kg",
      length: 1200,
      width: 1000,
      height: 1400,
      maxWeight: 1000,
    },
    // Packaging Materials
    {
      code: "PM-BOTTLE-1L",
      name: "PET Bottle 1L (blank)",
      type: SkuType.PACKAGING_MATERIAL,
      baseUnit: "pcs",
      packageName: "bundle",
      packagesPerPallet: 60,
      quantityPerPackage: 100,
      packageUnit: "pcs",
      length: 1200,
      width: 1000,
      height: 1800,
      maxWeight: 150,
    },
    {
      code: "PM-BOTTLE-2L",
      name: "PET Bottle 2L (blank)",
      type: SkuType.PACKAGING_MATERIAL,
      baseUnit: "pcs",
      packageName: "bundle",
      packagesPerPallet: 40,
      quantityPerPackage: 60,
      packageUnit: "pcs",
      length: 1200,
      width: 1000,
      height: 1800,
      maxWeight: 120,
    },
    {
      code: "PM-CAP-STD",
      name: "Bottle Cap Standard",
      type: SkuType.PACKAGING_MATERIAL,
      baseUnit: "pcs",
      packageName: "carton",
      packagesPerPallet: 1,
      quantityPerPackage: 1,
      packageUnit: "pcs",
      length: 1200,
      width: 1000,
      height: 1200,
      maxWeight: 100,
    },
    {
      code: "PM-SACK-PP",
      name: "PP Woven Sack 5kg",
      type: SkuType.PACKAGING_MATERIAL,
      baseUnit: "pcs",
      packageName: "bundle",
      packagesPerPallet: 100,
      quantityPerPackage: 50,
      packageUnit: "pcs",
      length: 1200,
      width: 1000,
      height: 1200,
      maxWeight: 200,
    },
    {
      code: "PM-SACK-PP-10",
      name: "PP Woven Sack 10kg",
      type: SkuType.PACKAGING_MATERIAL,
      baseUnit: "pcs",
      packageName: "bundle",
      packagesPerPallet: 80,
      quantityPerPackage: 50,
      packageUnit: "pcs",
      length: 1200,
      width: 1000,
      height: 1300,
      maxWeight: 200,
    },
    {
      code: "PM-CARTON-01",
      name: "Retail Carton Box (6-pack)",
      type: SkuType.PACKAGING_MATERIAL,
      baseUnit: "pcs",
      packageName: "bundle",
      packagesPerPallet: 120,
      quantityPerPackage: 10,
      packageUnit: "pcs",
      length: 1200,
      width: 1000,
      height: 1500,
      maxWeight: 360,
    },
    {
      code: "PM-LABEL-OIL",
      name: "Oil Label Sheet (roll)",
      type: SkuType.PACKAGING_MATERIAL,
      baseUnit: "roll",
      packageName: "carton",
      packagesPerPallet: 1,
      quantityPerPackage: 1,
      packageUnit: "roll",
      length: 1200,
      width: 1000,
      height: 1000,
      maxWeight: 50,
    },
    // Finished Goods
    {
      code: "FG-RICE-5KG",
      name: "Premium White Rice 5kg",
      type: SkuType.FINISHED_GOOD,
      baseUnit: "kg",
      packageName: "sack",
      packagesPerPallet: 160,
      quantityPerPackage: 5,
      packageUnit: "kg",
      length: 1200,
      width: 1000,
      height: 1600,
      maxWeight: 800,
    },
    {
      code: "FG-RICE-10KG",
      name: "Premium White Rice 10kg",
      type: SkuType.FINISHED_GOOD,
      baseUnit: "kg",
      packageName: "sack",
      packagesPerPallet: 80,
      quantityPerPackage: 10,
      packageUnit: "kg",
      length: 1200,
      width: 1000,
      height: 1600,
      maxWeight: 800,
    },
    {
      code: "FG-OIL-1L",
      name: "Refined Cooking Oil 1L",
      type: SkuType.FINISHED_GOOD,
      baseUnit: "liter",
      packageName: "carton",
      packagesPerPallet: 60,
      quantityPerPackage: 12,
      packageUnit: "liter",
      length: 1200,
      width: 1000,
      height: 1400,
      maxWeight: 864,
    },
    {
      code: "FG-OIL-2L",
      name: "Refined Cooking Oil 2L",
      type: SkuType.FINISHED_GOOD,
      baseUnit: "liter",
      packageName: "carton",
      packagesPerPallet: 48,
      quantityPerPackage: 12,
      packageUnit: "liter",
      length: 1200,
      width: 1000,
      height: 1400,
      maxWeight: 576,
    },
    {
      code: "FG-SUGAR-1KG",
      name: "Refined White Sugar 1kg",
      type: SkuType.FINISHED_GOOD,
      baseUnit: "kg",
      packageName: "carton",
      packagesPerPallet: 50,
      quantityPerPackage: 20,
      packageUnit: "kg",
      length: 1200,
      width: 1000,
      height: 1400,
      maxWeight: 1000,
    },
    {
      code: "FG-COOK-01",
      name: "Premium Cooking Pack",
      type: SkuType.FINISHED_GOOD,
      baseUnit: "pcs",
      packageName: "carton",
      packagesPerPallet: 48,
      quantityPerPackage: 1,
      packageUnit: "pcs",
      length: 1200,
      width: 1000,
      height: 1000,
      maxWeight: 480,
    },
  ];

  const skus = await Promise.all(
    skuData.map((sku) =>
      prisma.sku.create({ data: sku, select: { id: true, code: true, packagesPerPallet: true, quantityPerPackage: true } }),
    ),
  );

  const skuByCode = new Map(skus.map((sku) => [sku.code ?? "", { id: sku.id, packagesPerPallet: Number(sku.packagesPerPallet), quantityPerPackage: Number(sku.quantityPerPackage) }]));

  const suppliers = await Promise.all([
    prisma.supplier.create({
      data: {
        code: "SUP-RICE-01",
        name: "Nusantara Rice Milling",
        email: "sales@nusantararice.example",
        phone: "+62-21-555-0101",
        address: "Karawang, West Java",
      },
      select: { id: true },
    }),
    prisma.supplier.create({
      data: {
        code: "SUP-OIL-01",
        name: "Archipelago Palm Refinery",
        email: "sales@archipelagooil.example",
        phone: "+62-21-555-0102",
        address: "Dumai, Riau",
      },
      select: { id: true },
    }),
    prisma.supplier.create({
      data: {
        code: "SUP-PACK-01",
        name: "Prima Packaging Works",
        email: "orders@primapack.example",
        phone: "+62-21-555-0103",
        address: "Tangerang, Banten",
      },
      select: { id: true },
    }),
  ]);

  const supplierIds = suppliers.map((supplier) => supplier.id);

  const allSkuIds = skus.map((sku) => sku.id);
  for (const supplierId of supplierIds) {
    for (const skuId of allSkuIds) {
      await prisma.supplierSku.create({
        data: {
          supplierId,
          skuId,
          supplierItemCode: faker.string.alphanumeric({
            length: 8,
            casing: "upper",
          }),
          unitPrice: faker.number.float({
            min: 4,
            max: 150,
            fractionDigits: 2,
          }),
          leadTimeDays: faker.number.int({ min: 2, max: 14 }),
          minimumOrderQty: faker.number.float({
            min: 1,
            max: 8,
            fractionDigits: 2,
          }),
          isPreferred: faker.datatype.boolean({ probability: 0.5 }),
        },
      });
    }
  }

  const locationRows = await prisma.storageLocation.findMany({
    select: { id: true, warehouseId: true },
  });

  const freeLocations = new Map<string, Set<string>>();
  for (const warehouse of warehouses) {
    freeLocations.set(warehouse.id, new Set());
  }

  for (const location of locationRows) {
    freeLocations.get(location.warehouseId)?.add(location.id);
  }

  return {
    warehouses,
    supplierIds,
    freeLocations,
    skus: skus.map((sku) => ({
      id: sku.id,
      code: sku.code,
      packagesPerPallet: Number(sku.packagesPerPallet),
      quantityPerPackage: Number(sku.quantityPerPackage),
    })),
  };
};

// =============================================
// GENERATE FAKE DATA LOCATION UTILITIES
// =============================================

const occupyLocation = (
  freeLocations: Map<string, Set<string>>,
  warehouseId: string,
  locationId: string,
): void => {
  freeLocations.get(warehouseId)?.delete(locationId);
};

const releaseLocation = (
  freeLocations: Map<string, Set<string>>,
  warehouseId: string,
  locationId: string,
): void => {
  freeLocations.get(warehouseId)?.add(locationId);
};

const takeFreeLocation = (
  freeLocations: Map<string, Set<string>>,
  warehouseId: string,
): string => {
  const set = freeLocations.get(warehouseId);
  if (!set || set.size === 0) {
    throw new Error(`No free location available for warehouse ${warehouseId}`);
  }

  const iterator = set.values().next();
  if (!iterator.value) {
    throw new Error(`No free location value for warehouse ${warehouseId}`);
  }

  const locationId = iterator.value;
  set.delete(locationId);
  return locationId;
};

// =============================================
// GENERATE FAKE DATA MOVEMENT TRACKING
// =============================================

const createStockMovements = async (
  transactionType: WarehouseTransactionType,
  direction: MovementDirection,
  documentId: string,
  documentNumber: string,
  warehouseId: string,
  postedById: string,
  txDate: Date,
  rows: Array<{ skuId: string; quantity: number }>,
  movementEvents: MovementEvent[],
): Promise<void> => {
  for (const row of rows) {
    const signedQty =
      direction === MovementDirection.IN ? row.quantity : row.quantity * -1;

    await prisma.stockMovement.create({
      data: {
        transactionType,
        direction,
        documentId,
        documentNumber,
        skuId: row.skuId,
        warehouseId,
        quantity: row.quantity,
        signedQty,
        transactionDate: txDate,
        postedById,
        notes: `Auto-generated fake movement for ${documentNumber}`,
      },
    });

    movementEvents.push({
      skuId: row.skuId,
      warehouseId,
      date: txDate,
      signedQty,
    });
  }
};

const groupConsumedPallets = (
  pallets: AvailablePallet[],
) => {
  const grouped = new Map<
    string,
    { skuId: string; quantity: number }
  >();

  for (const pallet of pallets) {
    const key = pallet.skuId;
    const quantity = palletQuantity(pallet);
    const current = grouped.get(key);

    if (current) {
      current.quantity += quantity;
    } else {
      grouped.set(key, {
        skuId: pallet.skuId,
        quantity,
      });
    }
  }

  return [...grouped.values()];
};

const removePalletsFromPool = (
  availablePallets: AvailablePallet[],
  palletIds: string[],
): AvailablePallet[] => {
  const target = new Set(palletIds);
  return availablePallets.filter((pallet) => !target.has(pallet.id));
};

// =============================================
// GENERATE FAKE DATA INBOUND TRANSACTIONS
// =============================================

/**
 * Creates one inbound pallet + a completed putaway line, assigns the pallet to
 * its storage location, and registers it in the available-pallet pool.
 * Shared by every inbound transaction type (RECEIVING / WIP_COMPLETION /
 * RMA_RECEIPT / FOUND) — only `type` differs between them.
 */
const seedInboundPallet = async (
  type: WarehouseTransactionType,
  headerId: string,
  sku: { id: string; packagesPerPallet: number; quantityPerPackage: number },
  itemId: string,
  locationId: string,
  warehouseId: string,
  txDate: Date,
  approvedAt: Date,
  users: SeedUsers,
  availablePallets: AvailablePallet[],
): Promise<void> => {
  const pallet = await prisma.pallet.create({
    data: {
      palletNumber: nextSeedPalletNumber(txDate),
      skuId: sku.id,
      storageLocationId: null,
      status: PalletStatus.AVAILABLE,
      sourceType: type,
      sourceItemId: itemId,
    },
    select: { id: true },
  });

  await prisma.putawayLine.create({
    data: {
      transactionType: type,
      documentId: headerId,
      palletId: pallet.id,
      storageLocationId: locationId,
      status: PutawayLineStatus.COMPLETED,
      completedAt: approvedAt,
      completedById: users.operatorId,
    },
  });

  await prisma.pallet.update({
    where: { id: pallet.id },
    data: { storageLocationId: locationId },
  });

  availablePallets.push({
    id: pallet.id,
    warehouseId,
    skuId: sku.id,
    packagesPerPallet: sku.packagesPerPallet,
    quantityPerPackage: sku.quantityPerPackage,
    storageLocationId: locationId,
  });
};

const createInboundTransaction = async (
  kind: WarehouseTransactionType,
  warehouse: WarehouseSeed,
  txDate: Date,
  users: SeedUsers,
  skus: { id: string; packagesPerPallet: number; quantityPerPackage: number }[],
  availablePallets: AvailablePallet[],
  freeLocations: Map<string, Set<string>>,
  movementEvents: MovementEvent[],
  shipmentIds: string[],
  supplierIds: string[],
): Promise<void> => {
  const warehouseCode =
    warehouse.objectId ?? warehouse.id.slice(0, 4).toUpperCase();
  const documentNumber = nextDocumentNumber(kind, warehouseCode, txDate);
  const approvedAt = new Date(txDate.getTime() + 90 * 60 * 1000);
  const approvalHistory = createApprovalHistory(users.approverId, approvedAt);

  const typeCandidates =
    kind === WarehouseTransactionType.WIP_COMPLETION ||
    kind === WarehouseTransactionType.RMA_RECEIPT
      ? skus.filter(
          (sku) => sku.id === skus[skus.length - 1]?.id,
        )
      : skus;

  const selectedTypes = sampleMany(
    typeCandidates,
    faker.number.int({ min: 1, max: Math.min(3, typeCandidates.length) }),
  );
  const movementRows: Array<{
    skuId: string;
    quantity: number;
  }> = [];

  if (kind === WarehouseTransactionType.RECEIVING) {
    const header = await prisma.receivingTransaction.create({
      data: {
        documentNumber,
        date: txDate,
        supplierId: pickOne(supplierIds),
        purchaseOrderRef: documentNumber,
        deliveryNoteRef: `DN/${warehouseCode}/${faker.number.int({ min: 1000, max: 9999 })}`,
        carrier: faker.company.name(),
        trackingNumber: faker.string.alphanumeric({
          length: 10,
          casing: "upper",
        }),
        driverName: faker.person.fullName(),
        driverContact: `+62${faker.string.numeric(11)}`,
        vehiclePlate: `B ${faker.number.int({ min: 1000, max: 9999 })} ${faker.string.alpha({ length: 2, casing: "upper" })}`,
        notes: "Scheduled receiving generated for manufacturing test scenario",
        warehouseId: warehouse.id,
        createdById: users.creatorId,
        approvedById: users.approverId,
        approvedAt,
        approvalStatus: ApprovalStatus.APPROVED,
        putawayStatus: PutawayStatus.COMPLETED,
        approvalHistory,
      },
    });

    for (const sku of selectedTypes) {
      const palletCount = faker.number.int({ min: 2, max: 5 });
      const quantity = palletCount * palletQuantity(sku);
      const item = await prisma.receivingTransactionItem.create({
        data: {
          receivingTransactionId: header.id,
          skuId: sku.id,
          quantity,
          details: `Auto generated receiving item (${palletCount} pallets)`,
        },
      });

      movementRows.push({ skuId: sku.id, quantity });

      for (let i = 0; i < palletCount; i += 1) {
        const locationId = takeFreeLocation(freeLocations, warehouse.id);
        await seedInboundPallet(
          WarehouseTransactionType.RECEIVING,
          header.id,
          sku,
          item.id,
          locationId,
          warehouse.id,
          txDate,
          approvedAt,
          users,
          availablePallets,
        );
      }
    }

    await createStockMovements(
      WarehouseTransactionType.RECEIVING,
      MovementDirection.IN,
      header.id,
      documentNumber,
      warehouse.id,
      users.approverId,
      txDate,
      movementRows,
      movementEvents,
    );

    return;
  }

  if (kind === WarehouseTransactionType.WIP_COMPLETION) {
    const header = await prisma.wipCompletion.create({
      data: {
        documentNumber,
        date: txDate,
        workOrderRef: documentNumber,
        productionBatchNo: `BATCH/${warehouseCode}/${faker.number.int({ min: 1000, max: 9999 })}`,
        reference: documentNumber,
        notes: "Auto generated WIP completion for finished goods replenishment",
        warehouseId: warehouse.id,
        createdById: users.creatorId,
        approvedById: users.approverId,
        approvedAt,
        approvalStatus: ApprovalStatus.APPROVED,
        putawayStatus: PutawayStatus.COMPLETED,
        approvalHistory,
      },
    });

    for (const sku of selectedTypes) {
      const palletCount = faker.number.int({ min: 2, max: 4 });
      const quantity = palletCount * palletQuantity(sku);
      const item = await prisma.wipCompletionItem.create({
        data: {
          wipCompletionId: header.id,
          skuId: sku.id,
          quantity,
          details: `Generated from production line (${palletCount} pallets)`,
        },
      });

      movementRows.push({ skuId: sku.id, quantity });

      for (let i = 0; i < palletCount; i += 1) {
        const locationId = takeFreeLocation(freeLocations, warehouse.id);
        await seedInboundPallet(
          WarehouseTransactionType.WIP_COMPLETION,
          header.id,
          sku,
          item.id,
          locationId,
          warehouse.id,
          txDate,
          approvedAt,
          users,
          availablePallets,
        );
      }
    }

    await createStockMovements(
      WarehouseTransactionType.WIP_COMPLETION,
      MovementDirection.IN,
      header.id,
      documentNumber,
      warehouse.id,
      users.approverId,
      txDate,
      movementRows,
      movementEvents,
    );

    return;
  }

  if (kind === WarehouseTransactionType.RMA_RECEIPT) {
    const originalShipmentId = shipmentIds.length ? pickOne(shipmentIds) : null;

    const header = await prisma.rmaReceipt.create({
      data: {
        documentNumber,
        date: txDate,
        originalShipmentId,
        salesOrderRef: `SO/${warehouseCode}/${faker.number.int({ min: 10000, max: 99999 })}`,
        returnReason: pickOne([
          "damaged carton",
          "wrong quantity",
          "customer rejection",
        ]),
        reference: documentNumber,
        notes: "Auto generated customer return receipt",
        warehouseId: warehouse.id,
        createdById: users.creatorId,
        approvedById: users.approverId,
        approvedAt,
        approvalStatus: ApprovalStatus.APPROVED,
        putawayStatus: PutawayStatus.COMPLETED,
        approvalHistory,
      },
    });

    for (const sku of selectedTypes) {
      const palletCount = faker.number.int({ min: 1, max: 2 });
      const quantity = palletCount * palletQuantity(sku);
      const item = await prisma.rmaReceiptItem.create({
        data: {
          rmaReceiptId: header.id,
          skuId: sku.id,
          quantity,
          details: `Generated RMA intake (${palletCount} pallets)`,
        },
      });

      movementRows.push({ skuId: sku.id, quantity });

      for (let i = 0; i < palletCount; i += 1) {
        const locationId = takeFreeLocation(freeLocations, warehouse.id);
        await seedInboundPallet(
          WarehouseTransactionType.RMA_RECEIPT,
          header.id,
          sku,
          item.id,
          locationId,
          warehouse.id,
          txDate,
          approvedAt,
          users,
          availablePallets,
        );
      }
    }

    await createStockMovements(
      WarehouseTransactionType.RMA_RECEIPT,
      MovementDirection.IN,
      header.id,
      documentNumber,
      warehouse.id,
      users.approverId,
      txDate,
      movementRows,
      movementEvents,
    );

    return;
  }

  if (kind === WarehouseTransactionType.FOUND) {
    const header = await prisma.foundTransaction.create({
      data: {
        documentNumber,
        date: txDate,
        foundReason: pickOne([
          "cycle count reconciliation",
          "misplaced pallet located",
        ]),
        foundLocation: faker.helpers.arrayElement([
          "dock area",
          "staging area",
          "overflow lane",
        ]),
        reference: documentNumber,
        notes: "Auto generated found stock adjustment",
        warehouseId: warehouse.id,
        createdById: users.creatorId,
        approvedById: users.approverId,
        approvedAt,
        approvalStatus: ApprovalStatus.APPROVED,
        putawayStatus: PutawayStatus.COMPLETED,
        approvalHistory,
      },
    });

    for (const sku of selectedTypes) {
      const palletCount = faker.number.int({ min: 1, max: 2 });
      const quantity = palletCount * palletQuantity(sku);
      const item = await prisma.foundTransactionItem.create({
        data: {
          foundTransactionId: header.id,
          skuId: sku.id,
          quantity,
          details: `Generated found stock (${palletCount} pallets)`,
        },
      });

      movementRows.push({ skuId: sku.id, quantity });

      for (let i = 0; i < palletCount; i += 1) {
        const locationId = takeFreeLocation(freeLocations, warehouse.id);
        await seedInboundPallet(
          WarehouseTransactionType.FOUND,
          header.id,
          sku,
          item.id,
          locationId,
          warehouse.id,
          txDate,
          approvedAt,
          users,
          availablePallets,
        );
      }
    }

    await createStockMovements(
      WarehouseTransactionType.FOUND,
      MovementDirection.IN,
      header.id,
      documentNumber,
      warehouse.id,
      users.approverId,
      txDate,
      movementRows,
      movementEvents,
    );
  }
};

// =============================================
// GENERATE FAKE DATA OUTBOUND TRANSACTIONS
// =============================================

const takeWarehousePallets = (
  availablePallets: AvailablePallet[],
  warehouseId: string,
  count: number,
): AvailablePallet[] => {
  const candidates = availablePallets.filter(
    (pallet) => pallet.warehouseId === warehouseId,
  );
  if (!candidates.length) return [];
  return sampleMany(candidates, Math.min(count, candidates.length));
};

const createOutboundTransaction = async (
  kind: WarehouseTransactionType,
  warehouse: WarehouseSeed,
  txDate: Date,
  users: SeedUsers,
  availablePallets: AvailablePallet[],
  freeLocations: Map<string, Set<string>>,
  movementEvents: MovementEvent[],
): Promise<AvailablePallet[]> => {
  const toConsume = takeWarehousePallets(
    availablePallets,
    warehouse.id,
    faker.number.int({ min: 2, max: 5 }),
  );
  if (!toConsume.length) {
    return availablePallets;
  }

  const groupedRows = groupConsumedPallets(toConsume);
  const warehouseCode =
    warehouse.objectId ?? warehouse.id.slice(0, 4).toUpperCase();
  const documentNumber = nextDocumentNumber(kind, warehouseCode, txDate);
  const approvedAt = new Date(txDate.getTime() + 90 * 60 * 1000);
  const approvalHistory = createApprovalHistory(users.approverId, approvedAt);

  if (kind === WarehouseTransactionType.SHIPMENT) {
    const header = await prisma.shipment.create({
      data: {
        documentNumber,
        date: txDate,
        shipmentNumber: documentNumber,
        salesOrderRef: `SO/${warehouseCode}/${faker.number.int({ min: 10000, max: 99999 })}`,
        recipient: faker.company.name(),
        reference: documentNumber,
        notes: "Auto generated outbound shipment",
        carrier: faker.company.name(),
        trackingNumber: faker.string.alphanumeric({
          length: 10,
          casing: "upper",
        }),
        warehouseId: warehouse.id,
        createdById: users.creatorId,
        approvedById: users.approverId,
        approvedAt,
        approvalStatus: ApprovalStatus.APPROVED,
        dispatchStatus: DispatchStatus.COMPLETED,
        dispatchOpenStatus: DispatchOpenStatus.CLOSED,
        approvalHistory,
      },
      select: { id: true },
    });

    for (const row of groupedRows) {
      await prisma.shipmentItem.create({
        data: {
          shipmentId: header.id,
          skuId: row.skuId,
          quantity: row.quantity,
          details: `Auto generated shipment item (${documentNumber})`,
        },
      });
    }

    for (const pallet of toConsume) {
      await prisma.pickLine.create({
        data: {
          transactionType: WarehouseTransactionType.SHIPMENT,
          documentId: header.id,
          palletId: pallet.id,
          fromLocationId: pallet.storageLocationId,
          status: PickLineStatus.COMPLETED,
          assignedAt: approvedAt,
          assignedById: users.operatorId,
          completedAt: approvedAt,
          completedById: users.operatorId,
        },
      });

      await prisma.pallet.update({
        where: { id: pallet.id },
        data: {
          status: PalletStatus.NOT_AVAILABLE,
          storageLocationId: null,
        },
      });

      releaseLocation(freeLocations, warehouse.id, pallet.storageLocationId);
    }

    await createStockMovements(
      WarehouseTransactionType.SHIPMENT,
      MovementDirection.OUT,
      header.id,
      documentNumber,
      warehouse.id,
      users.approverId,
      txDate,
      groupedRows,
      movementEvents,
    );

    return removePalletsFromPool(
      availablePallets,
      toConsume.map((pallet) => pallet.id),
    );
  }

  if (kind === WarehouseTransactionType.WIP_ISSUE) {
    const header = await prisma.wipIssue.create({
      data: {
        documentNumber,
        date: txDate,
        workOrderRef: `WO/${warehouseCode}/${faker.number.int({ min: 1000, max: 9999 })}`,
        reference: documentNumber,
        notes: "Auto generated issue to production",
        warehouseId: warehouse.id,
        createdById: users.creatorId,
        approvedById: users.approverId,
        approvedAt,
        approvalStatus: ApprovalStatus.APPROVED,
        dispatchStatus: DispatchStatus.COMPLETED,
        approvalHistory,
      },
      select: { id: true },
    });

    for (const row of groupedRows) {
      await prisma.wipIssueItem.create({
        data: {
          wipIssueId: header.id,
          skuId: row.skuId,
          quantity: row.quantity,
          details: `Auto generated WIP issue item (${documentNumber})`,
        },
      });
    }

    for (const pallet of toConsume) {
      await prisma.pickLine.create({
        data: {
          transactionType: WarehouseTransactionType.WIP_ISSUE,
          documentId: header.id,
          palletId: pallet.id,
          fromLocationId: pallet.storageLocationId,
          status: PickLineStatus.COMPLETED,
          assignedAt: approvedAt,
          assignedById: users.operatorId,
          completedAt: approvedAt,
          completedById: users.operatorId,
        },
      });

      await prisma.pallet.update({
        where: { id: pallet.id },
        data: {
          status: PalletStatus.NOT_AVAILABLE,
          storageLocationId: null,
        },
      });

      releaseLocation(freeLocations, warehouse.id, pallet.storageLocationId);
    }

    await createStockMovements(
      WarehouseTransactionType.WIP_ISSUE,
      MovementDirection.OUT,
      header.id,
      documentNumber,
      warehouse.id,
      users.approverId,
      txDate,
      groupedRows,
      movementEvents,
    );

    return removePalletsFromPool(
      availablePallets,
      toConsume.map((pallet) => pallet.id),
    );
  }

  if (kind === WarehouseTransactionType.RETURN_TO_SUPPLIER) {
    const supplier = await prisma.supplier.findFirst({
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!supplier) {
      return availablePallets;
    }

    const header = await prisma.returnToSupplier.create({
      data: {
        documentNumber,
        date: txDate,
        supplierId: supplier.id,
        returnReason: pickOne([
          "quality issue",
          "expired incoming lot",
          "vendor return request",
        ]),
        reference: documentNumber,
        notes: "Auto generated supplier return",
        warehouseId: warehouse.id,
        createdById: users.creatorId,
        approvedById: users.approverId,
        approvedAt,
        approvalStatus: ApprovalStatus.APPROVED,
        dispatchStatus: DispatchStatus.COMPLETED,
        approvalHistory,
      },
      select: { id: true },
    });

    for (const row of groupedRows) {
      await prisma.returnToSupplierItem.create({
        data: {
          returnToSupplierId: header.id,
          skuId: row.skuId,
          quantity: row.quantity,
          details: `Auto generated return item (${documentNumber})`,
        },
      });
    }

    for (const pallet of toConsume) {
      await prisma.pickLine.create({
        data: {
          transactionType: WarehouseTransactionType.RETURN_TO_SUPPLIER,
          documentId: header.id,
          palletId: pallet.id,
          fromLocationId: pallet.storageLocationId,
          status: PickLineStatus.COMPLETED,
          assignedAt: approvedAt,
          assignedById: users.operatorId,
          completedAt: approvedAt,
          completedById: users.operatorId,
        },
      });

      await prisma.pallet.update({
        where: { id: pallet.id },
        data: {
          status: PalletStatus.NOT_AVAILABLE,
          storageLocationId: null,
        },
      });

      releaseLocation(freeLocations, warehouse.id, pallet.storageLocationId);
    }

    await createStockMovements(
      WarehouseTransactionType.RETURN_TO_SUPPLIER,
      MovementDirection.OUT,
      header.id,
      documentNumber,
      warehouse.id,
      users.approverId,
      txDate,
      groupedRows,
      movementEvents,
    );

    return removePalletsFromPool(
      availablePallets,
      toConsume.map((pallet) => pallet.id),
    );
  }

  if (kind === WarehouseTransactionType.DISPOSAL) {
    const header = await prisma.disposal.create({
      data: {
        documentNumber,
        date: txDate,
        disposalReason: pickOne([
          "damaged during handling",
          "expired shelf life",
          "contamination risk",
        ]),
        reference: documentNumber,
        notes: "Auto generated disposal transaction",
        warehouseId: warehouse.id,
        createdById: users.creatorId,
        approvedById: users.approverId,
        approvedAt,
        approvalStatus: ApprovalStatus.APPROVED,
        dispatchStatus: DispatchStatus.COMPLETED,
        approvalHistory,
      },
      select: { id: true },
    });

    for (const row of groupedRows) {
      await prisma.disposalItem.create({
        data: {
          disposalId: header.id,
          skuId: row.skuId,
          quantity: row.quantity,
          details: `Auto generated disposal item (${documentNumber})`,
        },
      });
    }

    for (const pallet of toConsume) {
      await prisma.pickLine.create({
        data: {
          transactionType: WarehouseTransactionType.DISPOSAL,
          documentId: header.id,
          palletId: pallet.id,
          fromLocationId: pallet.storageLocationId,
          status: PickLineStatus.COMPLETED,
          assignedAt: approvedAt,
          assignedById: users.operatorId,
          completedAt: approvedAt,
          completedById: users.operatorId,
        },
      });

      await prisma.pallet.update({
        where: { id: pallet.id },
        data: {
          status: PalletStatus.NOT_AVAILABLE,
          storageLocationId: null,
        },
      });

      releaseLocation(freeLocations, warehouse.id, pallet.storageLocationId);
    }

    await createStockMovements(
      WarehouseTransactionType.DISPOSAL,
      MovementDirection.OUT,
      header.id,
      documentNumber,
      warehouse.id,
      users.approverId,
      txDate,
      groupedRows,
      movementEvents,
    );

    return removePalletsFromPool(
      availablePallets,
      toConsume.map((pallet) => pallet.id),
    );
  }

  return availablePallets;
};

// =============================================
// GENERATE FAKE DATA EXCEPTION TRANSACTIONS
// =============================================

const createLossTransaction = async (
  warehouse: WarehouseSeed,
  txDate: Date,
  users: SeedUsers,
  availablePallets: AvailablePallet[],
  freeLocations: Map<string, Set<string>>,
  movementEvents: MovementEvent[],
): Promise<AvailablePallet[]> => {
  const picked = takeWarehousePallets(availablePallets, warehouse.id, 1);
  if (!picked.length) {
    return availablePallets;
  }

  const pallet = picked[0]!;

  const warehouseCode =
    warehouse.objectId ?? warehouse.id.slice(0, 4).toUpperCase();
  const documentNumber = nextDocumentNumber(
    WarehouseTransactionType.LOSS,
    warehouseCode,
    txDate,
  );
  const approvedAt = new Date(txDate.getTime() + 75 * 60 * 1000);

  const header = await prisma.lossTransaction.create({
    data: {
      documentNumber,
      date: txDate,
      lossReason: pickOne([
        "cycle count variance",
        "damaged and missing",
        "untraceable shrinkage",
      ]),
      reference: documentNumber,
      notes: "Auto generated stock loss adjustment",
      warehouseId: warehouse.id,
      createdById: users.creatorId,
      approvedById: users.approverId,
      approvedAt,
      approvalStatus: ApprovalStatus.APPROVED,
      approvalHistory: createApprovalHistory(users.approverId, approvedAt),
    },
    select: { id: true },
  });

  const qty = palletQuantity(pallet);
  await prisma.lossTransactionItem.create({
    data: {
      lossTransactionId: header.id,
      skuId: pallet.skuId,
      quantity: qty,
      details: `Auto generated loss adjustment (${documentNumber})`,
    },
  });

  await prisma.pallet.update({
    where: { id: pallet.id },
    data: {
      status: PalletStatus.NOT_AVAILABLE,
      storageLocationId: null,
    },
  });

  releaseLocation(freeLocations, warehouse.id, pallet.storageLocationId);

  await createStockMovements(
    WarehouseTransactionType.LOSS,
    MovementDirection.OUT,
    header.id,
    documentNumber,
    warehouse.id,
    users.approverId,
    txDate,
    [{ skuId: pallet.skuId, quantity: qty }],
    movementEvents,
  );

  return removePalletsFromPool(availablePallets, [pallet.id]);
};

const createSubinventoryTransfer = async (
  warehouse: WarehouseSeed,
  txDate: Date,
  users: SeedUsers,
  availablePallets: AvailablePallet[],
  freeLocations: Map<string, Set<string>>,
): Promise<void> => {
  const movable = availablePallets.filter(
    (pallet) =>
      pallet.warehouseId === warehouse.id &&
      !transferredPalletIds.has(pallet.id),
  );

  if (!movable.length) {
    return;
  }

  const freeSet = freeLocations.get(warehouse.id);
  if (!freeSet || freeSet.size === 0) {
    return;
  }

  const pallet = pickOne(movable);
  const toLocationId = takeFreeLocation(freeLocations, warehouse.id);
  const warehouseCode =
    warehouse.objectId ?? warehouse.id.slice(0, 4).toUpperCase();
  const documentNumber = nextDocumentNumber(
    WarehouseTransactionType.SUBINVENTORY_TRANSFER,
    warehouseCode,
    txDate,
  );
  const approvedAt = new Date(txDate.getTime() + 60 * 60 * 1000);

  const header = await prisma.subinventoryTransfer.create({
    data: {
      documentNumber,
      date: txDate,
      transferReason: pickOne([
        "slot optimization",
        "replenishment prep",
        "safety zoning",
      ]),
      reference: documentNumber,
      notes: "Auto generated internal transfer",
      warehouseId: warehouse.id,
      createdById: users.creatorId,
      approvedById: users.approverId,
      approvedAt,
      approvalStatus: ApprovalStatus.APPROVED,
      approvalHistory: createApprovalHistory(users.approverId, approvedAt),
    },
    select: { id: true },
  });

  await prisma.subinventoryTransferItem.create({
    data: {
      subinventoryTransferId: header.id,
      palletId: pallet.id,
      fromLocationId: pallet.storageLocationId,
      toLocationId,
    },
  });

  await prisma.pallet.update({
    where: { id: pallet.id },
    data: {
      storageLocationId: toLocationId,
    },
  });

  releaseLocation(freeLocations, warehouse.id, pallet.storageLocationId);
  occupyLocation(freeLocations, warehouse.id, toLocationId);

  const targetPallet = availablePallets.find((item) => item.id === pallet.id);
  if (targetPallet) {
    targetPallet.storageLocationId = toLocationId;
  }

  transferredPalletIds.add(pallet.id);
};

// =============================================
// GENERATE FAKE DATA INVENTORY BALANCE
// =============================================

const seedInventoryBalances = async (
  movementEvents: MovementEvent[],
  months: Date[],
): Promise<void> => {
  const movementBySkuWarehouse = new Map<string, MovementEvent[]>();

  for (const event of movementEvents) {
    const key = `${event.skuId}:${event.warehouseId}`;
    const list = movementBySkuWarehouse.get(key) ?? [];
    list.push(event);
    movementBySkuWarehouse.set(key, list);
  }

  const monthKeys = months.map((month) => toMonthKey(month));

  for (const [key, events] of movementBySkuWarehouse.entries()) {
    const [skuId, warehouseId] = key.split(":");
    if (!skuId || !warehouseId) continue;

    let opening = 0;

    for (const monthKey of monthKeys) {
      const [yearStr, monthStr] = monthKey.split("-");
      if (!yearStr || !monthStr) continue;

      const monthEvents = events.filter(
        (event) => toMonthKey(event.date) === monthKey,
      );
      const totalInbound = monthEvents
        .filter((event) => event.signedQty > 0)
        .reduce((acc, cur) => acc + cur.signedQty, 0);
      const totalOutbound = monthEvents
        .filter((event) => event.signedQty < 0)
        .reduce((acc, cur) => acc + Math.abs(cur.signedQty), 0);
      const closing = opening + totalInbound - totalOutbound;

      await prisma.skuInventoryBalance.create({
        data: {
          skuId,
          warehouseId,
          year: Number(yearStr),
          month: Number(monthStr),
          openingQty: Number(opening.toFixed(3)),
          totalInbound: Number(totalInbound.toFixed(3)),
          totalOutbound: Number(totalOutbound.toFixed(3)),
          closingQty: Number(closing.toFixed(3)),
        },
      });

      opening = closing;
    }
  }
};

// =============================================
// MAIN ORCHESTRATION
// =============================================

async function main() {
  await client.connect();
  console.log("🚀 Starting database seed...\n");
  console.log(`   Config: MONTH_WINDOW=${MONTH_WINDOW}, FAKER_SEED=${FAKER_SEED}, SKIP_RESET=${SKIP_RESET}`);

  try {
    // Access Control & Users
    const roleIds = await seedPermissionsAndRoles(client);
    await seedUsers(client);
    await assignRoleToAdmin(client, roleIds);

    // Generate Fake Warehouse Data
    faker.seed(FAKER_SEED);
    const users = await ensureUsers();
    if (!SKIP_RESET) {
      await resetWarehouseDomain();
    }

    const { warehouses, supplierIds, freeLocations, skus: skuList } =
      await seedMasterData();

    const months = monthStarts(MONTH_WINDOW);
    const movementEvents: MovementEvent[] = [];
    let availablePallets: AvailablePallet[] = [];
    const shipmentIds: string[] = [];

    for (const month of months) {
      for (const warehouse of warehouses) {
        await createInboundTransaction(
          WarehouseTransactionType.RECEIVING,
          warehouse,
          isoDateInMonth(month),
          users,
          skuList,
          availablePallets,
          freeLocations,
          movementEvents,
          shipmentIds,
          supplierIds,
        );

        await createInboundTransaction(
          WarehouseTransactionType.WIP_COMPLETION,
          warehouse,
          isoDateInMonth(month),
          users,
          skuList,
          availablePallets,
          freeLocations,
          movementEvents,
          shipmentIds,
          supplierIds,
        );

        await createInboundTransaction(
          WarehouseTransactionType.FOUND,
          warehouse,
          isoDateInMonth(month),
          users,
          skuList,
          availablePallets,
          freeLocations,
          movementEvents,
          shipmentIds,
          supplierIds,
        );

        await createSubinventoryTransfer(
          warehouse,
          isoDateInMonth(month),
          users,
          availablePallets,
          freeLocations,
        );

        availablePallets = await createOutboundTransaction(
          WarehouseTransactionType.SHIPMENT,
          warehouse,
          isoDateInMonth(month),
          users,
          availablePallets,
          freeLocations,
          movementEvents,
        );

        const latestShipment = await prisma.shipment.findFirst({
          where: { warehouseId: warehouse.id },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });

        if (latestShipment) {
          shipmentIds.push(latestShipment.id);
        }

        availablePallets = await createOutboundTransaction(
          WarehouseTransactionType.WIP_ISSUE,
          warehouse,
          isoDateInMonth(month),
          users,
          availablePallets,
          freeLocations,
          movementEvents,
        );

        availablePallets = await createOutboundTransaction(
          WarehouseTransactionType.RETURN_TO_SUPPLIER,
          warehouse,
          isoDateInMonth(month),
          users,
          availablePallets,
          freeLocations,
          movementEvents,
        );

        availablePallets = await createOutboundTransaction(
          WarehouseTransactionType.DISPOSAL,
          warehouse,
          isoDateInMonth(month),
          users,
          availablePallets,
          freeLocations,
          movementEvents,
        );

        availablePallets = await createLossTransaction(
          warehouse,
          isoDateInMonth(month),
          users,
          availablePallets,
          freeLocations,
          movementEvents,
        );

        await createInboundTransaction(
          WarehouseTransactionType.RMA_RECEIPT,
          warehouse,
          isoDateInMonth(month),
          users,
          skuList,
          availablePallets,
          freeLocations,
          movementEvents,
          shipmentIds,
          supplierIds,
        );
      }
    }

    await seedInventoryBalances(movementEvents, months);

    const summary = {
      warehouses: await prisma.warehouse.count(),
      locations: await prisma.storageLocation.count(),
      skus: await prisma.sku.count(),
      pallets: await prisma.pallet.count(),
      stockMovements: await prisma.stockMovement.count(),
      receiving: await prisma.receivingTransaction.count(),
      wipCompletion: await prisma.wipCompletion.count(),
      rmaReceipt: await prisma.rmaReceipt.count(),
      wipIssue: await prisma.wipIssue.count(),
      shipment: await prisma.shipment.count(),
      returnToSupplier: await prisma.returnToSupplier.count(),
      disposal: await prisma.disposal.count(),
      subinventoryTransfer: await prisma.subinventoryTransfer.count(),
      loss: await prisma.lossTransaction.count(),
      found: await prisma.foundTransaction.count(),
      balances: await prisma.skuInventoryBalance.count(),
    };

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("\n📊 Summary:");
    console.table(summary);
  } catch (error) {
    console.error("\n❌ Seeding failed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
    await prisma.$disconnect();
  });
