import { useMemo } from 'react';
import { Button, Card, Chip } from '@heroui/react';
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

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <div className={mono ? 'mt-2 font-mono text-sm text-foreground' : 'mt-2 text-sm text-foreground'}>{value}</div>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const user = useMemo(() => SAMPLE_USERS.find((u) => u.id === id) ?? SAMPLE_USERS[0], [id]);
  const role = SAMPLE_ROLES.find((r) => r.id === user?.roleId);
  const createdAt = useMemo(() => {
    if (!user?.createdAt) return '-';
    return new Date(user.createdAt).toLocaleString();
  }, [user?.createdAt]);

  const createdAtDate = useMemo(() => {
    if (!user?.createdAt) return '-';
    return new Date(user.createdAt).toLocaleDateString();
  }, [user?.createdAt]);

  const createdAtTime = useMemo(() => {
    if (!user?.createdAt) return '-';
    return new Date(user.createdAt).toLocaleTimeString();
  }, [user?.createdAt]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div>
            <Card.Title className="text-2xl">User Detail</Card.Title>
            <Card.Description>Informasi profil pengguna, role yang digunakan, dan metadata dasar akun.</Card.Description>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" onPress={() => navigate(`/users/${user?.id}/edit`)} className="bg-warning hover:bg-warning-hover text-warning-foreground">
            <Icon icon="solar:pen-linear" className="h-4 w-4" />
            Edit
          </Button>
          <Button variant="ghost" onPress={() => navigate('/users')}>
            <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <Card>
            <Card.Header>
              <Card.Title className="text-base">Ringkasan Pengguna</Card.Title>
              <Card.Description>Informasi identitas utama untuk akun yang sedang dilihat.</Card.Description>
            </Card.Header>
            <Card.Content className="space-y-4">
              <div className="rounded-2xl bg-default-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Display Name</p>
                <p className="mt-2 text-sm leading-6 text-foreground">{user?.name ?? '-'}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <DetailField label="Email" value={user?.email ?? '-'} />
                <DetailField label="Tanggal Dibuat" value={createdAtDate} />
                <DetailField label="Jam Dibuat" value={createdAtTime} />
              </div>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title className="text-base">Akses & Role</Card.Title>
              <Card.Description>Ringkasan hak akses berdasarkan role yang terpasang.</Card.Description>
            </Card.Header>
            <Card.Content className="space-y-3">
              <DetailField label="Role" value={role?.name ?? '-'} />
              <DetailField label="Role ID" value={role?.id ?? '-'} mono />
              <DetailField label="Status Akun" value={<Chip color="success" size="sm" variant="soft">Active</Chip>} />
            </Card.Content>
          </Card>
        </div>

        <Card>
          <Card.Header>
            <Card.Title className="text-base">Metadata</Card.Title>
            <Card.Description>Referensi identitas teknis untuk pelacakan dan pengelolaan akun.</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DetailField label="User ID" value={user?.id ?? '-'} mono />
            <DetailField label="Role" value={role?.name ?? '-'} />
            <DetailField label="Created At" value={createdAt} mono />
            <DetailField label="Email" value={user?.email ?? '-'} />
          </Card.Content>
        </Card>
      </div>
    </section>
  );
}
