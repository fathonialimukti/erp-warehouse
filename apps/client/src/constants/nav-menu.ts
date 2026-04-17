export interface NavMenuItem {
    name: string;
    icon?: string;
    href?: string;
    permission?: string;
    children?: NavMenuItem[];
}

export const NAV_MENU: NavMenuItem[] = [
    {
        name: 'nav.dashboard',
        icon: 'solar:home-2-linear',
        href: '/dashboard',
    },
    {
        name: 'nav.warehouse3d_viewer',
        icon: 'solar:box-minimalistic-broken',
        href: '/warehouse-layout-3d',
    },
    {
        name: 'nav.access_control',
        icon: 'solar:shield-user-linear',
        children: [
            {
                name: 'nav.users',
                icon: 'solar:users-group-two-rounded-linear',
                href: '/users',
                permission: 'user_read',
            },
            {
                name: 'nav.roles',
                icon: 'solar:user-check-linear',
                href: '/access-control/roles',
                permission: 'role_read',
            },
        ],
    },
    {
        name: 'nav.warehouse',
        icon: 'solar:box-minimalistic-linear',
        children: [
            {
                name: 'nav.warehouses',
                icon: 'solar:buildings-2-linear',
                href: '/warehouse',
                permission: 'warehouse_read',
            },
            {
                name: 'nav.skus',
                icon: 'solar:box-minimalistic-linear',
                href: '/skus',
                permission: 'sku_read',
            },
        ],
    },
    {
        name: 'nav.activity_logs',
        icon: 'solar:document-text-linear',
        href: '/activity-logs',
        permission: 'activity_log_read',
    },
    {
        name: 'nav.transactions',
        icon: 'solar:document-bold',
        href: '/transactions',
        permission: 'warehouse_transaction_read',
    },
];