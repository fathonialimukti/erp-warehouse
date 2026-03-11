import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button, Card, Input } from '@heroui/react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProtectedRouteLoader } from '../../lib/route-guard';
import { trpc } from '#/utils/trpc';
import { AppLayout } from '#/components/AppLayout';
import { getAuthSession, clearAuthSession } from '#/state/auth';
import { UserTable } from './components/-UserTable';

export const Route = createFileRoute('/users/')({
  beforeLoad: createProtectedRouteLoader({
    requiredAnyPermissions: ['user:read', 'user:*'],
  }),
  component: UserListPage,
});

function UserListPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const session = getAuthSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess: async () => {
        clearAuthSession()
        // Remove queries instead of invalidating to prevent refetch with cleared cookie
        queryClient.removeQueries(trpc.auth.me.pathFilter())
        await navigate({ to: '/login' })
      },
      onError: () => {
        // Even if logout fails, clear local session and redirect
        clearAuthSession()
        queryClient.removeQueries(trpc.auth.me.pathFilter())
        navigate({ to: '/login' })
      },
    }),
  )

  return (
    <AppLayout
      userName={session.userName || 'User'}
      roleName={session.roleName || 'Guest'}
      permissions={session.permissions}
      onLogout={() => logoutMutation.mutate()}
      isLoggingOut={logoutMutation.isPending}
    >
      <Card variant="secondary" className="w-full">
        <Card.Header>
          <div className="flex w-full flex-wrap items-start justify-between gap-3">
            <div className="flex-1">
              <Card.Title>Users</Card.Title>
              <Card.Description>Manage system users and their roles</Card.Description>
            </div>
            <Link to="/users/new" className="no-underline">
              <Button variant="primary" size="md">
                + New User
              </Button>
            </Link>
          </div>
        </Card.Header>

        <Card.Content>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              fullWidth
            />

            <UserTable page={page} limit={10} search={search || undefined} onPageChange={setPage} />
          </div>
        </Card.Content>
      </Card>
    </AppLayout>
  );
}
