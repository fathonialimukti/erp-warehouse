import { createRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { Button, Card, CardBody, Avatar, Chip } from '@heroui/react';
import { useAuth } from '../auth/AuthContext';

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate({ to: '/login' });
  };

  return (
    <div className='container mx-auto max-w-4xl py-10 px-4'>
      <div className='flex justify-between items-center mb-10'>
        <h1 className='text-4xl font-bold'>Dashboard</h1>
        <Button onClick={handleLogout} variant='light' color='default'>
          Sign Out
        </Button>
      </div>

      {user && (
        <div className='space-y-6'>
          <Card>
            <CardBody>
              <div className='flex gap-5 items-center'>
                <Avatar
                  name={user.name || user.email}
                  size='lg'
                  showFallback
                  className='text-lg'
                />
                <div>
                  <p className='text-xl font-semibold'>{user.name || 'User'}</p>
                  <p className='text-sm text-gray-500'>{user.email}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {user.roles.length > 0 && (
            <Card>
              <CardBody>
                <h2 className='text-2xl font-semibold mb-4'>
                  Roles & Permissions
                </h2>
                <div className='space-y-4'>
                  {user.roles.map((role) => (
                    <div
                      key={role.id}
                      className='border-b border-gray-200 last:border-0 pb-4 last:pb-0'>
                      <p className='font-semibold text-lg mb-2'>{role.name}</p>
                      <div className='flex flex-wrap gap-2'>
                        {role.permissions.map((permission, idx) => (
                          <Chip
                            key={idx}
                            size='sm'
                            variant='flat'
                            color='primary'>
                            {permission}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async ({ context, location }: any) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: DashboardPage,
});
