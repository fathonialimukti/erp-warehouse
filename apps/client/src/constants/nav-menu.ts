export type NavSectionId =
  "overview" | "master_data" | "operations" | "insights" | "administration";

export interface NavMenuItem {
  name: string;
  icon?: string;
  href?: string;
  permission?: string | string[];
  /** Section this top-level item belongs to (rendered as a group heading in the sidebar). */
  section?: NavSectionId;
  children?: NavMenuItem[];
}

/** Render order of sidebar sections. Items without a section fall under 'overview'. */
export const NAV_SECTION_ORDER: NavSectionId[] = [
  "overview",
  "master_data",
  "operations",
  "insights",
  "administration",
];

export const NAV_SECTION_LABEL_KEYS: Record<NavSectionId, string> = {
  overview: "nav.group.overview",
  master_data: "nav.group.master_data",
  operations: "nav.group.operations",
  insights: "nav.group.insights",
  administration: "nav.group.administration",
};

export const NAV_MENU: NavMenuItem[] = [
  {
    name: "nav.dashboard",
    icon: "nav:dashboard",
    href: "/dashboard",
    section: "overview",
  },
  {
    name: "nav.warehouses",
    icon: "nav:warehouses",
    href: "/warehouse",
    permission: "warehouse@read",
    section: "master_data",
  },
  {
    name: "nav.skus",
    icon: "nav:skus",
    href: "/skus",
    permission: "sku@read",
    section: "master_data",
  },
  {
    name: "nav.suppliers",
    icon: "nav:suppliers",
    href: "/suppliers",
    permission: "supplier@read",
    section: "master_data",
  },
  {
    name: "nav.products",
    icon: "nav:products",
    href: "/products",
    permission: "product@read",
    section: "master_data",
  },
  {
    name: "nav.pallets",
    icon: "nav:pallets",
    href: "/pallets",
    permission: "pallet@read",
    section: "master_data",
  },
  {
    name: "nav.transactions_in",
    icon: "nav:inbound",
    href: "/inbound-transaction",
    permission: [
      "receiving@read",
      "wip-completion@read",
      "rma-receipt@read",
      "found@read",
    ],
    section: "operations",
  },
  {
    name: "nav.transactions_out",
    icon: "nav:outbound",
    href: "/outbound-transaction",
    permission: [
      "shipment@read",
      "return-to-supplier@read",
      "disposal@read",
      "wip-issue@read",
      "loss@read",
    ],
    section: "operations",
  },
  {
    name: "nav.subinventory_transfer",
    icon: "nav:subinventory",
    href: "/subinventory-transfer",
    permission: "subinventory-transfer@read",
    section: "operations",
  },
  {
    name: "nav.stock_movement",
    icon: "nav:stock-movement",
    href: "/stock-movement",
    permission: "stock-movement@read",
    section: "operations",
  },
  {
    name: "nav.reorder",
    icon: "nav:stock-movement",
    href: "/reorder",
    permission: "reorder@read",
    section: "operations",
  },
  {
    name: "nav.stock_count",
    icon: "nav:activity-logs",
    href: "/stock-count",
    permission: "stock_count@read",
    section: "operations",
  },
  {
    name: "nav.purchase_orders",
    icon: "nav:inbound",
    href: "/purchase-order",
    permission: "purchase_order@read",
    section: "operations",
  },
  {
    name: "nav.reports",
    icon: "nav:reports",
    permission: "stock-movement@read",
    section: "insights",
    children: [
      {
        name: "nav.report_monthly_stock",
        icon: "nav:monthly-stock",
        href: "/reports/monthly-stock-movement",
        permission: "stock-movement@read",
      },
      {
        name: "nav.report_inventory_balance",
        icon: "nav:inventory-balance",
        href: "/reports/inventory-balance",
        permission: "stock-movement@read",
      },
      {
        name: "nav.report_charts",
        icon: "nav:analytics",
        href: "/reports/charts",
        permission: "stock-movement@read",
      },
      {
        name: "nav.report_expiry",
        icon: "nav:inventory-aging",
        href: "/reports/expiry",
        permission: "stock-movement@read",
      },
    ],
  },
  {
    name: "nav.inventory_aging",
    icon: "nav:inventory-aging",
    href: "/inventory-aging",
    permission: "inventoryAging@read",
    section: "insights",
  },
  {
    name: "nav.ai_analytics",
    icon: "nav:analytics",
    href: "/ai-analytics",
    permission: "stock-movement@read",
    section: "insights",
  },
  {
    name: "nav.access_control",
    icon: "nav:access-control",
    section: "administration",
    children: [
      {
        name: "nav.users",
        icon: "nav:users",
        href: "/users",
        permission: "user@read",
      },
      {
        name: "nav.roles",
        icon: "nav:roles",
        href: "/access-control/roles",
        permission: "role@read",
      },
    ],
  },
  {
    name: "nav.activity_logs",
    icon: "nav:activity-logs",
    href: "/activity-logs",
    permission: "activity_log@read",
    section: "administration",
  },
  {
    name: "nav.notifications_admin",
    icon: "nav:notifications",
    href: "/notifications",
    permission: "notification@read",
    section: "administration",
  },
  {
    name: "nav.knowledge",
    icon: "nav:knowledge",
    href: "/knowledge",
    permission: "knowledge@read",
    section: "administration",
  },
  {
    name: "nav.ai_admin",
    icon: "nav:ai-admin",
    href: "/ai-admin",
    permission: "ai_admin@access",
    section: "administration",
  },
  {
    name: "nav.system",
    icon: "nav:system",
    permission: ["settings@read", "log@read", "backup@read"],
    section: "administration",
    children: [
      {
        name: "nav.system_settings",
        icon: "nav:settings",
        href: "/settings",
        permission: "settings@read",
      },
      {
        name: "backup.title",
        icon: "nav:backup",
        href: "/settings/backup",
        permission: "backup@read",
      },
      {
        name: "nav.system_logs",
        icon: "nav:logs",
        href: "/logs",
        permission: "log@read",
      },
    ],
  },
];
