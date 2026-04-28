import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { Locale } from './i18n';
import { getInitialLocale, persistLocale } from './locale';

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
}

export interface UserWithPermissions extends User {
  permissions: string[];
  roleName: string;
}

// Auth state
export const authTokenAtom = atomWithStorage<string | null>('auth-token', null);
export const authUserAtom = atomWithStorage<UserWithPermissions | null>('auth-user', null);
export const authBootstrapReadyAtom = atom(false);
export const isAuthenticatedAtom = atom((get) => Boolean(get(authTokenAtom)));

// UI state
export const sidebarOpenAtom = atomWithStorage<boolean>('sidebar-open', true);
export const themeModeAtom = atomWithStorage<'light' | 'dark'>('theme-mode', 'light');
export const localeAtom = atom<Locale>(getInitialLocale());
export const localeActionsAtom = atom(null, (_get, set, newLocale: Locale) => {
  set(localeAtom, newLocale);
  persistLocale(newLocale);
});

const normalizePermissionName = (permission: string) => {
  if (permission.includes('@')) {
    return permission;
  }

  return permission.replace(/_(?=[^_]+$)/, '@');
};

const normalizePermissions = (permissions: string[]) =>
  permissions.map((permission) => normalizePermissionName(permission));

// Computed atom for user permissions
export const userPermissionsAtom = atom((get) => {
  const user = get(authUserAtom);
  return normalizePermissions(user?.permissions ?? []);
});

// Helper to check if user has permission
export const hasPermissionAtom = atom(
  (get) => (permission: string | string[]) => {
    const permissions = get(userPermissionsAtom);
    const required = Array.isArray(permission) ? permission : [permission];
    const normalizedRequired = required.map(normalizePermissionName);

    return normalizedRequired.some((requiredPermission) =>
      permissions.includes(requiredPermission),
    );
  },
);

export const clearAuthAtom = atom(null, (_get, set) => {
  set(authTokenAtom, null);
  set(authUserAtom, null);
});
