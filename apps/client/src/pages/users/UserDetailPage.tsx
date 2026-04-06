import { useMemo, type ReactNode } from 'react';
import { Button, Card, Chip, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import EntityPhoto from '../../components/EntityPhoto';
import { trpcClient } from '../../lib/trpc';

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <div className={mono ? 'mt-2 break-all font-mono text-sm text-foreground' : 'mt-2 text-sm text-foreground'}>{value}</div>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: user, isLoading } = useQuery({
    queryKey: ['userDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.user.detail.query({ id: id ?? '' }),
  });

  const createdAt = useMemo(() => {
    if (!user?.createdAt) return '-';
    return new Date(user.createdAt).toLocaleString('id-ID');
  }, [user?.createdAt]);

  const createdAtDate = useMemo(() => {
    if (!user?.createdAt) return '-';
    return new Date(user.createdAt).toLocaleDateString('id-ID');
  }, [user?.createdAt]);

  const createdAtTime = useMemo(() => {
    if (!user?.createdAt) return '-';
    return new Date(user.createdAt).toLocaleTimeString('id-ID');
  }, [user?.createdAt]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner size="sm" />
        Memuat detail user...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">User tidak ditemukan.</p>
        <Button variant="ghost" onPress={() => navigate('/users')}>
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden border border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96)_48%,rgba(8,145,178,0.9))] text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <Card.Content className="grid gap-6 p-6 md:grid-cols-[280px_1fr] md:p-8">
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/12 bg-white/6 p-3 backdrop-blur-sm">
              <EntityPhoto src={user.foto} alt={user.name ?? user.email} className="h-64 w-full rounded-[1.4rem] border border-white/12 object-cover" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">User ID</p>
              <p className="mt-2 font-mono text-sm text-white">{user.id}</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/72">
                  <Icon icon="solar:user-id-linear" className="size-4" />
                  Account Profile
                </div>
                <div>
                  <Card.Title className="text-3xl text-white">{user.name ?? 'Tanpa nama'}</Card.Title>
                  <Card.Description className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                    Ringkasan identitas akun, email operasional, dan otorisasi role untuk memastikan akses user tetap terkelola dengan rapi.
                  </Card.Description>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="soft" color="accent">
                    {user.role?.name ?? 'Tanpa role'}
                  </Chip>
                  <Chip size="sm" variant="soft" color="success">
                    Active account
                  </Chip>
                  <Chip size="sm" variant="soft" color={user.foto ? 'success' : 'default'}>
                    {user.foto ? 'Foto tersedia' : 'Tanpa foto'}
                  </Chip>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button variant="secondary" onPress={() => navigate(`/users/${user.id}/edit`)}>
                  <Icon icon="solar:pen-linear" className="h-4 w-4" />
                  Edit User
                </Button>
                <Button variant="ghost" onPress={() => navigate('/users')}>
                  <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
                  Kembali
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Email Operasional</p>
                <p className="mt-2 text-sm leading-6 text-white">{user.email}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Role Aktif</p>
                <p className="mt-2 text-2xl font-semibold text-white">{user.role?.name ?? '-'}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Tanggal Dibuat</p>
                <p className="mt-2 text-2xl font-semibold text-white">{createdAtDate}</p>
                <p className="mt-1 text-xs text-white/60">{createdAtTime}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Status Akses</p>
                <div className="mt-2 space-y-1 text-sm text-white/88">
                  <p>Role ID: {user.role?.id ?? '-'}</p>
                  <p>Foto: {user.foto ? 'Tersimpan' : 'Belum ada'}</p>
                </div>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-base">Operational Snapshot</Card.Title>
            <Card.Description>Data inti user yang paling sering dibutuhkan saat audit akun dan validasi akses.</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-3 md:grid-cols-2">
            <DetailField label="Display Name" value={user.name ?? '-'} />
            <DetailField label="Email" value={user.email} />
            <DetailField label="Created At" value={createdAt} mono />
          </Card.Content>
        </Card>

        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-base">Action Center</Card.Title>
            <Card.Description>Akses cepat untuk pemeliharaan akun dan navigasi kembali ke daftar user.</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-3">
            <Button variant="primary" fullWidth onPress={() => navigate(`/users/${user.id}/edit`)}>
              <Icon icon="solar:pen-linear" className="size-4" />
              Edit Profil User
            </Button>
            <Button variant="secondary" fullWidth onPress={() => navigate('/roles')}>
              <Icon icon="solar:shield-user-linear" className="size-4" />
              Tinjau Role Terkait
            </Button>
            <Button variant="ghost" fullWidth onPress={() => navigate('/users')}>
              <Icon icon="solar:list-linear" className="size-4" />
              Kembali ke Daftar User
            </Button>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title className="text-base">Identity & Access Metadata</Card.Title>
          <Card.Description>Referensi teknis untuk kebutuhan troubleshooting, audit trail, dan penelusuran hak akses.</Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="User ID" value={user.id} mono />
          <DetailField label="Role" value={user.role?.name ?? '-'} />
          <DetailField label="Role ID" value={user.role?.id ?? '-'} mono />
          <DetailField
            label="Status Akun"
            value={
              <Chip color="success" size="sm" variant="soft">
                Active
              </Chip>
            }
          />
        </Card.Content>
      </Card>
    </section>
  );
}
