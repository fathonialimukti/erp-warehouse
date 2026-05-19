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
    icon: "solar:home-2-linear",
    href: "/dashboard",
  },
  {
    name: "nav.access_control",
    icon: "solar:shield-user-linear",
    children: [
      {
        name: "nav.users",
        icon: "solar:users-group-two-rounded-linear",
        href: "/users",
        permission: "user@read",
      },
      {
        name: "nav.roles",
        icon: "solar:user-check-linear",
        href: "/access-control/roles",
        permission: "role@read",
      },
    ],
  },
  {
    name: "nav.warehouses",
    icon: "solar:buildings-2-linear",
    href: "/warehouse",
    permission: "warehouse@read",
  },
  {
    name: "nav.skus",
    icon: "solar:box-minimalistic-linear",
    href: "/skus",
    permission: "sku@read",
  },
  {
    name: "nav.activity_logs",
    icon: "solar:document-text-linear",
    href: "/activity-logs",
    permission: "activity_log@read",
  },
  {
    name: "nav.notifications_admin",
    icon: "solar:bell-bing-linear",
    href: "/notifications",
    permission: "notification@read",
  },
  {
    name: "nav.transactions_in",
    icon: "solar:arrow-to-bottom-down-bold",
    href: "/inbound-transaction",
    permission: ["receiving@read", "wip-completion@read", "rma-receipt@read", "found@read"],
  },
  {
    name: "nav.transactions_out",
    icon: "solar:arrow-to-top-up-bold",
    href: "/outbound-transaction",
    permission: ["shipment@read", "wip-issue@read", "return-to-supplier@read", "disposal@read", "loss@read"],
  },
];
