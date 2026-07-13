import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { authBootstrapReadyAtom, authTokenAtom, authUserAtom, clearAuthAtom } from './atoms';
import { trpcClient } from './trpc';

type LoginInput = {
  email: string;
  password: string;
};

function mapPermissions(roles: Array<{ permissions: string[] }>) {
  return Array.from(new Set(roles.flatMap((role) => role.permissions))).sort();
}

export function useAuthBootstrap() {
  const setAuthToken = useSetAtom(authTokenAtom);
  const setAuthUser = useSetAtom(authUserAtom);
  const clearAuth = useSetAtom(clearAuthAtom);
  const setAuthBootstrapReady = useSetAtom(authBootstrapReadyAtom);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      setAuthBootstrapReady(false);

      try {
        const response = await trpcClient.auth.me.query();
        const rolePermissions = mapPermissions(response.user.roles);
        const primaryRoleName = response.user.roles[0]?.name ?? 'User';

        setAuthToken(`${response.user.id}:${response.tokenExpiresAt ?? Date.now()}`);
        setAuthUser({
          id: response.user.id,
          email: response.user.email,
          name: response.user.name ?? response.user.email,
          permissions: rolePermissions,
          roleName: primaryRoleName,
        });
      } catch {
        clearAuth();
      } finally {
        if (active) {
          setAuthBootstrapReady(true);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [setAuthToken, setAuthUser, clearAuth, setAuthBootstrapReady]);
}

export function useAuthActions() {
  const setAuthToken = useSetAtom(authTokenAtom);
  const setAuthUser = useSetAtom(authUserAtom);
  const clearAuth = useSetAtom(clearAuthAtom);

  const login = async ({ email, password }: LoginInput) => {
    const response = await trpcClient.auth.login.mutate({
      email,
      password,
      rememberMe: true,
    });

    const rolePermissions = mapPermissions(response.user.roles);
    const primaryRoleName = response.user.roles[0]?.name ?? 'User';

    setAuthToken(`${response.user.id}:${response.tokenExpiresAt ?? Date.now()}`);
    setAuthUser({
      id: response.user.id,
      email: response.user.email,
      name: response.user.name ?? response.user.email,
      permissions: rolePermissions,
      roleName: primaryRoleName,
    });
  };

  const logout = async () => {
    try {
      await trpcClient.auth.logout.mutate();
    } finally {
      clearAuth();
    }
  };

  return { login, logout };
}
