import { Navigate } from 'react-router-dom';
import { Spinner } from '@heroui/react';

import { useAuth } from '@/contexts/auth-context';

interface AuthRouteProps {
  children: React.ReactNode;
}

export const AuthRoute: React.FC<AuthRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <Spinner size='lg' />
      </div>
    );
  }

  if (isAuthenticated) {
    // Redirect authenticated users to dashboard
    return <Navigate replace to='/dashboard' />;
  }

  return <>{children}</>;
};
