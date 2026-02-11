import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Spinner } from '@heroui/react';
import { useAuth } from '../auth/AuthContext';

const RootComponent = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-screen'>
        <Spinner size='lg' label='Loading...' />
      </div>
    );
  }

  return <Outlet />;
};

export const Route = createRootRoute({
  component: RootComponent,
});
