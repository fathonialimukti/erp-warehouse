import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

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

// Computed atom for user permissions
export const userPermissionsAtom = atom((get) => {
  const user = get(authUserAtom);
  return user?.permissions ?? [];
});

// Helper to check if user has permission
export const hasPermissionAtom = atom(
  (get) => (permission: string) => {
    const permissions = get(userPermissionsAtom);
    return permissions.includes(permission);
  },
);

export const clearAuthAtom = atom(null, (_get, set) => {
  set(authTokenAtom, null);
  set(authUserAtom, null);
});
