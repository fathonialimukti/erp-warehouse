export interface NavMenuItem {
    name: string;
    icon?: string;
    href?: string;
    permission?: string;
    children?: NavMenuItem[];
}

export const NAV_MENU: NavMenuItem[] = [
    {
        name: 'Dashboard',
        icon: 'solar:home-2-linear',
        href: '/dashboard',
    },
    {
        name: 'Access Control',
        icon: 'solar:shield-user-linear',
        children: [
            {
                name: 'Users',
                icon: 'solar:users-group-two-rounded-linear',
                href: '/users',
                permission: 'user:read',
            },
            {
                name: 'Roles',
                icon: 'solar:user-check-linear',
                href: '/access-control/roles',
                permission: 'role:read',
            },
        ],
    },
    {
        name: 'Warehouse',
        icon: 'solar:box-minimalistic-linear',
        children: [
            {
                name: 'Warehouses',
                icon: 'solar:buildings-2-linear',
                href: '/warehouse',
                permission: 'gudang:read',
            },
            {
                name: 'SKU & Jenis Palet',
                icon: 'solar:box-minimalistic-linear',
                href: '/skus',
                permission: 'sku:read',
            },
        ],
    },
    {
        name: 'Activity Logs',
        icon: 'solar:document-text-linear',
        href: '/activity-logs',
        permission: 'activity_log:read',
    },
];