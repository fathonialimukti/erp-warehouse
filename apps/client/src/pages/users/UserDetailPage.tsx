import { type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Chip, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import EntityPhoto from '../../components/EntityPhoto';
import { PageHeader } from '../../components/PageHeader';
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
  const intl = useIntl();
  const navigate = useNavigate();

  const { data: user, isLoading } = useQuery({
    queryKey: ['userDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.user.detail.query({ id: id ?? '' }),
  });

  const createdAtValue = user?.createdAt ? new Date(user.createdAt) : null;
  const createdAt = createdAtValue ? createdAtValue.toLocaleString('id-ID') : '-';
  const createdAtDate = createdAtValue ? createdAtValue.toLocaleDateString('id-ID') : '-';
  const createdAtTime = createdAtValue ? createdAtValue.toLocaleTimeString('id-ID') : '-';

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <Spinner size="sm" />
        {intl.formatMessage({ id: 'users.detail.loading', defaultMessage: 'Loading user details...' })}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">{intl.formatMessage({ id: 'users.detail.not_found', defaultMessage: 'User not found.' })}</p>
        <Button variant="ghost" onPress={() => navigate('/users')}>
          {intl.formatMessage({ id: 'users.detail.back_to_list', defaultMessage: 'Back to user list' })}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={intl.formatMessage({ id: 'users.detail.page_title', defaultMessage: 'User Detail' })}
        onBack={() => navigate('/users')}
        onEdit={() => navigate(`/users/${user.id}/edit`)}
      />

      <Card className="overflow-hidden border border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96)_48%,rgba(8,145,178,0.9))] text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <Card.Content className="grid gap-6 p-6 md:grid-cols-[280px_1fr] md:p-8">
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/12 bg-white/6 p-3 backdrop-blur-sm">
              <EntityPhoto src={user.photo} alt={user.name ?? user.email} className="h-64 w-full rounded-[1.4rem] border border-white/12 object-cover" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">User ID</p>
              <p className="mt-2 font-mono text-sm text-white">{user.id}</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/72">
                  <Icon icon="solar:user-id-linear" className="size-4" />
                  Account Profile
                </div>
                <div>
                  <Card.Title className="text-3xl text-white">{user.name ?? intl.formatMessage({ id: 'users.detail.anonymous_name', defaultMessage: 'No name' })}</Card.Title>
                  <Card.Description className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                    {intl.formatMessage({ id: 'users.detail.hero_description', defaultMessage: 'Account identity summary, operational email, and role authorization to keep user access managed clearly.' })}
                  </Card.Description>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="soft" color="accent">
                    {user.role?.name ?? intl.formatMessage({ id: 'users.detail.no_role', defaultMessage: 'No role' })}
                  </Chip>
                  <Chip size="sm" variant="soft" color="success">
                    {intl.formatMessage({ id: 'users.detail.active_account', defaultMessage: 'Active account' })}
                  </Chip>
                  <Chip size="sm" variant="soft" color={user.photo ? 'success' : 'default'}>
                    {user.photo ? intl.formatMessage({ id: 'users.detail.photo_available', defaultMessage: 'Photo available' }) : intl.formatMessage({ id: 'users.detail.no_photo', defaultMessage: 'No photo' })}
                  </Chip>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'users.detail.email_label', defaultMessage: 'Operational Email' })}</p>
                <p className="mt-2 text-sm leading-6 text-white">{user.email}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'users.detail.active_role_label', defaultMessage: 'Active Role' })}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{user.role?.name ?? '-'}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'users.detail.created_at_label', defaultMessage: 'Created Date' })}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{createdAtDate}</p>
                <p className="mt-1 text-xs text-white/60">{createdAtTime}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'users.detail.access_status_label', defaultMessage: 'Access Status' })}</p>
                <div className="mt-2 space-y-1 text-sm text-white/88">
                  <p>{intl.formatMessage({ id: 'users.detail.role_id_label', defaultMessage: 'Role ID' })}: {user.role?.id ?? '-'}</p>
                  <p>{intl.formatMessage({ id: 'users.detail.photo_status_label', defaultMessage: 'Photo' })}: {user.photo ? intl.formatMessage({ id: 'users.detail.photo_stored', defaultMessage: 'Stored' }) : intl.formatMessage({ id: 'users.detail.photo_missing', defaultMessage: 'Not uploaded' })}</p>
                </div>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-base">{intl.formatMessage({ id: 'users.detail.operational_snapshot_title', defaultMessage: 'Operational Snapshot' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'users.detail.operational_snapshot_description', defaultMessage: 'Core user data commonly needed for account audits and access validation.' })}</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-3 md:grid-cols-2">
            <DetailField label="Display Name" value={user.name ?? '-'} />
            <DetailField label="Email" value={user.email} />
            <DetailField label="Created At" value={createdAt} mono />
          </Card.Content>
        </Card>

        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-base">{intl.formatMessage({ id: 'users.detail.action_center_title', defaultMessage: 'Action Center' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'users.detail.action_center_description', defaultMessage: 'Quick access for account maintenance and navigation back to the user list.' })}</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-3">
            <Button variant="primary" fullWidth onPress={() => navigate(`/users/${user.id}/edit`)}>
              <Icon icon="solar:pen-linear" className="size-4" />
              {intl.formatMessage({ id: 'users.detail.edit_profile_button', defaultMessage: 'Edit user profile' })}
            </Button>
            <Button variant="primary" fullWidth onPress={() => navigate('/roles')}>
              <Icon icon="solar:shield-user-linear" className="size-4" />
              {intl.formatMessage({ id: 'users.detail.review_roles_button', defaultMessage: 'Review related roles' })}
            </Button>
            <Button variant="ghost" fullWidth onPress={() => navigate('/users')}>
              <Icon icon="solar:list-linear" className="size-4" />
              {intl.formatMessage({ id: 'users.detail.back_to_user_list_button', defaultMessage: 'Back to user list' })}
            </Button>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title className="text-base">{intl.formatMessage({ id: 'users.detail.metadata_title', defaultMessage: 'Identity & Access Metadata' })}</Card.Title>
          <Card.Description>{intl.formatMessage({ id: 'users.detail.metadata_description', defaultMessage: 'Technical references for troubleshooting, audit trail, and access rights tracing.' })}</Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DetailField label="User ID" value={user.id} mono />
          <DetailField label="Role" value={user.role?.name ?? '-'} />
          <DetailField label="Role ID" value={user.role?.id ?? '-'} mono />
          <DetailField
            label={intl.formatMessage({ id: 'users.detail.account_status_label', defaultMessage: 'Account Status' })}
            value={
              <Chip color="success" size="sm" variant="soft">
                {intl.formatMessage({ id: 'users.detail.active_status', defaultMessage: 'Active' })}
              </Chip>
            }
          />
        </Card.Content>
      </Card>
    </section>
  );
}
