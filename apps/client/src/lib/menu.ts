import type { MenuItem } from '#/lib/permission'

export type { MenuItem }

export const ERP_MENU_ITEMS: MenuItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Overview and quick status',
    to: '/dashboard',
  },
  {
    key: 'users',
    label: 'Users',
    description: 'Manage application users',
    requiredAnyPermissions: ['user:read', 'user:*'],
    to: '/users',
  },
  {
    key: 'warehouse',
    label: 'Warehouse',
    description: 'Master data and configuration',
    requiredAnyPermissions: ['gudang:read'],
    to: '/warehouse',
  },
  {
    key: 'palet',
    label: 'Pallets',
    description: 'Track pallet lifecycle',
    requiredAnyPermissions: ['palet:read'],
  },
  {
    key: 'operations',
    label: 'Operations',
    description: 'Inbound, placement, outbound flows',
    requiredAnyPermissions: ['transaksi_gudang:read'],
    to: '/operations',
  },
  {
    key: 'approval',
    label: 'Approvals',
    description: 'Pending and completed approvals',
    requiredAnyPermissions: ['approval:read'],
  },
]
