// =============================================
// ACCESS CONTROL CONSTANTS
// =============================================

export const PERMISSIONS = [
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

  // Knowledge Base (RAG documents)
  { name: "knowledge@create", description: "Create knowledge base documents" },
  { name: "knowledge@read", description: "Read knowledge base documents" },
  { name: "knowledge@update", description: "Update and reindex knowledge base documents" },
  { name: "knowledge@delete", description: "Delete knowledge base documents" },
];

export const ROLES = [
  { name: "System Admin", description: "Full system access (WMS administrator)" },
  { name: "Warehouse Manager", description: "Full warehouse-domain management and analytics" },
  { name: "Warehouse Supervisor", description: "Reviews and approves warehouse transactions (SoD from operators)" },
  { name: "Warehouse Operator", description: "Daily warehouse operations (putaway, dispatch, pallets)" },
  { name: "Receiver", description: "Inbound clerk: receiving transactions and putaway" },
  { name: "Picker", description: "Outbound clerk: shipment transactions and dispatch" },
  { name: "Cycle Counter", description: "Owns stock adjustments (loss/found) and inventory aging analytics" },
  { name: "Quality Inspector", description: "Approves returns, supplier returns and disposals; manages quality hold" },
  { name: "Auditor", description: "Read-only compliance view across all warehouse domains" },
  { name: "Logistics Planner", description: "Supplier and product master management, stock visibility" },
];

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

export const ROLE_PERMISSIONS: Record<string, string[]> = {
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
    "inventoryAging@read",
    "transaction@putaway",
    "transaction@dispatch",
    ...ALL_TRANSACTION_TYPES.flatMap((t) => [`${t}@*`]),
  ],

  "Warehouse Supervisor": [
    "warehouse@read",
    "sku@read",
    "pallet_type@read",
    "storage_location@read",
    "pallet@read",
    "supplier@read",
    "stock-movement@read",
    "activity_log@read",
    "inventoryAging@read",
    "transaction@putaway",
    "transaction@dispatch",
    ...ALL_TRANSACTION_TYPES.flatMap((t) => [`${t}@read`, `${t}@approve`]),
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

  Receiver: [
    "warehouse@read",
    "sku@read",
    "storage_location@read",
    "pallet@create",
    "pallet@update",
    "stock-movement@read",
    "transaction@putaway",
    "receiving@*",
    "rma-receipt@read",
    "rma-receipt@create",
    "rma-receipt@update",
    "found@read",
    "found@create",
  ],

  Picker: [
    "warehouse@read",
    "sku@read",
    "storage_location@read",
    "pallet@read",
    "stock-movement@read",
    "transaction@dispatch",
    "shipment@*",
    "return-to-supplier@read",
    "return-to-supplier@create",
    "return-to-supplier@update",
    "disposal@read",
  ],

  "Cycle Counter": [
    "sku@read",
    "warehouse@read",
    "storage_location@read",
    "pallet@read",
    "stock-movement@read",
    "inventoryAging@read",
    "loss@*",
    "found@*",
  ],

  "Quality Inspector": [
    "warehouse@read",
    "sku@read",
    "storage_location@read",
    "pallet@read",
    "stock-movement@read",
    "rma-receipt@read",
    "rma-receipt@create",
    "rma-receipt@approve",
    "return-to-supplier@read",
    "return-to-supplier@approve",
    "disposal@read",
    "disposal@create",
    "disposal@approve",
    "receiving@read",
    "shipment@read",
    "loss@read",
    "found@read",
    "transaction@putaway",
  ],

  Auditor: [
    ...ALL_TRANSACTION_TYPES.flatMap((t) => [`${t}@read`]),
    "warehouse@read",
    "sku@read",
    "pallet_type@read",
    "storage_location@read",
    "pallet@read",
    "supplier@read",
    "product@read",
    "user@read",
    "role@read",
    "permission@read",
    "stock-movement@read",
    "activity_log@read",
    "inventoryAging@read",
    "knowledge@read",
  ],

  "Logistics Planner": [
    "supplier@*",
    "product@*",
    "warehouse@read",
    "sku@read",
    "storage_location@read",
    "stock-movement@read",
    "inventoryAging@read",
    "shipment@read",
    "receiving@read",
  ],
};

// =============================================
// ACCESS CONTROL FUNCTIONS
// =============================================

export function normalizePermissionName(permission: string) {
  if (permission.includes("@")) return permission;
  return permission.replace(/_([^_]+)$/, "@$1");
}

export function normalizePattern(pattern: string) {
  if (pattern === "*") return pattern;
  if (pattern.includes("@")) return pattern;
  return normalizePermissionName(pattern);
}

export function matchesPattern(permName: string, patterns: string[]): boolean {
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