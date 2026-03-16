export type NavMenuItem = {
  name: string;
  icon: string;
  href?: string;
  permission?: string;
  children?: NavMenuItem[];
};

export const NAV_MENU: NavMenuItem[] = [
  {
    name: 'Dashboard',
    icon: 'solar:home-2-linear',
    href: '/dashboard',
  },
  {
    name: 'System Module',
    icon: 'solar:settings-linear',
    children: [
      {
        name: 'Users',
        icon: 'solar:users-group-rounded-linear',
        href: '/users',
        permission: 'user:read',
      },
      {
        name: 'Access Control',
        icon: 'solar:user-id-linear',
        href: '/access-control',
        permission: 'role:read',
      },
    ],
  },
];
