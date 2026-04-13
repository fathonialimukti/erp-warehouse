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
        name: 'nav.warehouse3dViewer',
        icon: 'solar:box-minimalistic-broken',
        href: '/warehouse-layout-3d',
    },
    {
        name: 'nav.accessControl',
        icon: 'solar:shield-user-linear',
        children: [
            {
                name: 'nav.users',
                icon: 'solar:users-group-two-rounded-linear',
                href: '/users',
                permission: 'user:read',
            },
            {
                name: 'nav.roles',
                icon: 'solar:user-check-linear',
                href: '/access-control/roles',
                permission: 'role:read',
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
                permission: 'gudang:read',
            },
            {
                name: 'nav.skus',
                icon: 'solar:box-minimalistic-linear',
                href: '/skus',
                permission: 'sku:read',
            },
        ],
    },
    {
        name: 'nav.activityLogs',
        icon: 'solar:document-text-linear',
        href: '/activity-logs',
        permission: 'activity_log:read',
    },
    {
        name: 'nav.transactions',
        icon: 'solar:document-bold',
        href: '/transactions',
        permission: 'transaksi_gudang:read',
    },
];