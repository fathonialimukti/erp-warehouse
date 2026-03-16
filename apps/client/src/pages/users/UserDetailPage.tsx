import { useMemo } from 'react';
import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';

const SAMPLE_ROLES = [
  { id: 'ROL-001', name: 'System Admin' },
  { id: 'ROL-002', name: 'Warehouse Manager' },
  { id: 'ROL-003', name: 'Warehouse Operator' },
  { id: 'ROL-004', name: 'Approver' },
];

const SAMPLE_USERS = [
  { id: 'USR-001', name: 'Admin', email: 'admin@mail.com', roleId: 'ROL-001', createdAt: '2026-03-01' },
  { id: 'USR-002', name: 'Warehouse Manager', email: 'manager@mail.com', roleId: 'ROL-002', createdAt: '2026-03-02' },
  { id: 'USR-003', name: 'Operator One', email: 'operator@mail.com', roleId: 'ROL-003', createdAt: '2026-03-03' },
  { id: 'USR-004', name: 'Approver One', email: 'approver@mail.com', roleId: 'ROL-004', createdAt: '2026-03-04' },
];

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const user = useMemo(() => SAMPLE_USERS.find((u) => u.id === id) ?? SAMPLE_USERS[0], [id]);
  const role = SAMPLE_ROLES.find((r) => r.id === user?.roleId);

  return (
    <Card>
      <Card.Header className="flex items-center justify-between gap-4">
        <div>
          <Card.Title className="text-2xl">User Detail</Card.Title>
          <Card.Description>View user information. Use Edit to make changes.</Card.Description>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" onPress={() => navigate('/users')}>
            <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
            Back
          </Button>
          <Button
            variant="ghost"
            onPress={() => navigate(`/users/${user?.id}/edit`)}
            className="text-warning"
          >
            <Icon icon="solar:pen-linear" className="h-4 w-4" />
            Edit
          </Button>
        </div>
      </Card.Header>

      <Card.Content className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="form-label">Name</label>
          <p className="min-h-10 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name ?? '-'}</p>
        </div>

        <div className="space-y-1">
          <label className="form-label">Email</label>
          <p className="min-h-10 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.email ?? '-'}</p>
        </div>

        <div className="space-y-1">
          <label className="form-label">Role</label>
          <p className="min-h-10 text-sm font-medium text-gray-900 dark:text-gray-100">{role?.name ?? '-'}</p>
        </div>

        <div className="space-y-1">
          <label className="form-label">Created At</label>
          <p className="min-h-10 text-sm font-medium text-gray-900 dark:text-gray-100">{user?.createdAt ?? '-'}</p>
        </div>
      </Card.Content>
    </Card>
  );
}
