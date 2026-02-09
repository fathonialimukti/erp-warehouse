import { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: string[];
}

export const ProtectedRoute = ({
  children,
  requiredPermissions = [],
}: ProtectedRouteProps) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (requiredPermissions.length > 0 && user) {
    const userPermissions = user.roles.flatMap((role) => role.permissions);
    const hasRequiredPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasRequiredPermissions) {
      return <div>You do not have permission to access this page.</div>;
    }
  }

  return <>{children}</>;
};
