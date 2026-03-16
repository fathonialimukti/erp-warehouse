import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { authBootstrapReadyAtom, authTokenAtom, authUserAtom, clearAuthAtom } from './atoms';
import { trpcClient } from './trpc';

type LoginInput = {
  email: string;
  password: string;
};

export function useAuthBootstrap() {
  const token = useAtomValue(authTokenAtom);
  const setAuthUser = useSetAtom(authUserAtom);
  const clearAuth = useSetAtom(clearAuthAtom);
  const setAuthBootstrapReady = useSetAtom(authBootstrapReadyAtom);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!token) {
        if (!cancelled) {
          setAuthBootstrapReady(true);
        }
        return;
      }

      setAuthBootstrapReady(false);

      try {
        const response = await trpcClient.auth.me.query();
        const rolePermissions = response.user.roles.flatMap((role) => role.permissions);
        const primaryRoleName = response.user.roles[0]?.name ?? 'User';

        setAuthUser({
          id: response.user.id,
          email: response.user.email,
          name: response.user.name ?? response.user.email,
          username: response.user.email,
          permissions: rolePermissions,
          roleName: primaryRoleName,
        });
      } catch {
        clearAuth();
      } finally {
        if (!cancelled) {
          setAuthBootstrapReady(true);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [token, setAuthUser, clearAuth, setAuthBootstrapReady]);
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

    const rolePermissions = response.user.roles.flatMap((role) => role.permissions);
    const primaryRoleName = response.user.roles[0]?.name ?? 'User';

    setAuthToken(`${response.user.id}:${response.tokenExpiresAt ?? Date.now()}`);
    setAuthUser({
      id: response.user.id,
      email: response.user.email,
      name: response.user.name ?? response.user.email,
      username: response.user.email,
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
