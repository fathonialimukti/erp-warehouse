export interface NavMenuItem {
  name: string;
  icon?: string;
  href?: string;
  permission?: string | string[];
  children?: NavMenuItem[];
}

export const NAV_MENU: NavMenuItem[] = [
  {
    name: "nav.dashboard",
    icon: "nav:dashboard",
    href: "/dashboard",
  },
  {
    name: "nav.access_control",
    icon: "nav:access-control",
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
    name: "nav.warehouses",
    icon: "nav:warehouses",
    href: "/warehouse",
    permission: "warehouse@read",
  },
  {
    name: "nav.skus",
    icon: "nav:skus",
    href: "/skus",
    permission: "sku@read",
  },
  {
    name: "nav.suppliers",
    icon: "nav:suppliers",
    href: "/suppliers",
    permission: "supplier@read",
  },
  {
    name: "nav.products",
    icon: "nav:products",
    href: "/products",
    permission: "product@read",
  },
  {
    name: "nav.activity_logs",
    icon: "nav:activity-logs",
    href: "/activity-logs",
    permission: "activity_log@read",
  },
  {
    name: "nav.notifications_admin",
    icon: "nav:notifications",
    href: "/notifications",
    permission: "notification@read",
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
  },
  {
    name: "nav.subinventory_transfer",
    icon: "nav:subinventory",
    href: "/subinventory-transfer",
    permission: "subinventory-transfer@read",
  },
  {
    name: "nav.pallets",
    icon: "nav:pallets",
    href: "/pallets",
    permission: "pallet@read",
  },
  {
    name: "nav.stock_movement",
    icon: "nav:stock-movement",
    href: "/stock-movement",
    permission: "stock-movement@read",
  },
  {
    name: "nav.reports",
    icon: "nav:reports",
    permission: "stock-movement@read",
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
    ],
  },
  {
    name: "nav.inventory_aging",
    icon: "nav:inventory-aging",
    href: "/inventory-aging",
    permission: "inventoryAging@read",
  },
];
