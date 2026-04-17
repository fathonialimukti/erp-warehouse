import { type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Chip, Spinner } from '@heroui/react';
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
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <div className={mono ? 'break-all font-mono text-sm text-foreground' : 'text-sm text-foreground'}>{value}</div>
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
  const displayName = user?.name ?? intl.formatMessage({ id: 'users.detail.anonymous_name', defaultMessage: 'No name' });
  const roleName = user?.role?.name ?? intl.formatMessage({ id: 'users.detail.no_role', defaultMessage: 'No role' });
  const roleId = user?.role?.id ?? '-';

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
        title={displayName}
        onBack={() => navigate('/users')}
        onEdit={() => navigate(`/users/${user.id}/edit`)}
      />

      <Card className="overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(160deg,rgba(8,145,178,0.09)_0%,rgba(34,197,94,0.04)_30%,rgba(255,255,255,0.98)_65%)] p-5 shadow-[0_20px_50px_rgba(6,95,70,0.12)] dark:bg-[linear-gradient(160deg,rgba(8,145,178,0.2)_0%,rgba(34,197,94,0.08)_30%,rgba(39,39,42,0.96)_65%)] lg:p-7">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <EntityPhoto src={user.photo} alt={displayName} className="h-72 w-full rounded-[1.25rem] border border-border/50 object-cover" />

          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                {intl.formatMessage({ id: 'users.detail.hero_kicker', defaultMessage: 'User Account' })}
              </p>
              <p className="font-mono text-sm text-foreground">{user.id}</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{displayName}</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted">
                {intl.formatMessage({ id: 'users.detail.hero_description', defaultMessage: 'Account identity summary, operational email, and role authorization to keep user access managed clearly.' })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip variant="soft" color="success">
                  {intl.formatMessage({ id: 'users.detail.active_account', defaultMessage: 'Active account' })}
                </Chip>
                <Chip variant="soft" color={user.role ? 'success' : 'warning'}>
                  {roleName}
                </Chip>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DetailField
                label={intl.formatMessage({ id: 'users.detail.email_label', defaultMessage: 'Operational Email' })}
                value={user.email}
              />
              <DetailField
                label={intl.formatMessage({ id: 'users.detail.active_role_label', defaultMessage: 'Active Role' })}
                value={roleName}
              />
              <DetailField
                label={intl.formatMessage({ id: 'users.detail.created_at_label', defaultMessage: 'Created Date' })}
                value={createdAtDate}
              />
              <DetailField
                label={intl.formatMessage({ id: 'users.detail.access_status_label', defaultMessage: 'Access Status' })}
                value={intl.formatMessage({ id: 'users.detail.active_status', defaultMessage: 'Active' })}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-8">
        <div>
          <Card>
            <Card.Header className="space-y-3">
              <div>
                <Card.Title className="text-base">{intl.formatMessage({ id: 'users.detail.operational_snapshot_title', defaultMessage: 'Operational Snapshot' })}</Card.Title>
                <Card.Description>{intl.formatMessage({ id: 'users.detail.operational_snapshot_description', defaultMessage: 'Core user data commonly needed for account audits and access validation.' })}</Card.Description>
              </div>
            </Card.Header>
            <Card.Content className="grid gap-4 md:grid-cols-2">
              <DetailField label={intl.formatMessage({ id: 'users.detail.user_id_label', defaultMessage: 'User ID' })} value={user.id} mono />
              <DetailField label={intl.formatMessage({ id: 'users.detail.role_id_label', defaultMessage: 'Role ID' })} value={roleId} mono />
              <DetailField label={intl.formatMessage({ id: 'users.detail.created_at_full_label', defaultMessage: 'Created At' })} value={createdAt} mono />
              <DetailField label={intl.formatMessage({ id: 'users.detail.page_note_label', defaultMessage: 'Note' })} value={intl.formatMessage({ id: 'users.detail.redundancy_note', defaultMessage: 'Redundant details are intentionally removed to keep this page focused.' })} />
            </Card.Content>
          </Card>
        </div>
      </div>
    </section>
  );
}
