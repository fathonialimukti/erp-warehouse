import { type ReactNode } from 'react';
import { useIntl, type IntlShape } from 'react-intl';
import { Card, Chip, EmptyState, Spinner, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '../../components/PageHeader';
import { trpcClient } from '../../lib/trpc';

type JsonRecord = Record<string, unknown>;

type ActivityLogDetail = {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT';
  resource: string;
  resourceId: string;
  message: string;
  detail: unknown;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

const ACTION_COLOR_MAP: Record<ActivityLogDetail['action'], 'accent' | 'default' | 'warning' | 'danger' | 'success'> = {
  CREATE: 'success',
  UPDATE: 'accent',
  DELETE: 'danger',
  APPROVE: 'success',
  REJECT: 'danger',
  LOGIN: 'default',
  LOGOUT: 'warning',
  EXPORT: 'accent',
  IMPORT: 'default',
};

function isPlainObject(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function prettify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function describeDetailPayload(detail: unknown, intl: IntlShape) {
  if (detail == null) {
    return intl.formatMessage({
      id: 'activitylog_detail_noadditionalpayload',
      defaultMessage: 'No additional payload for this activity.',
    });
  }

  if (Array.isArray(detail)) {
    return intl.formatMessage(
      {
        id: 'activitylog_detail_arraysummary',
        defaultMessage: 'Payload contains an array with {count} items.',
      },
      { count: detail.length },
    );
  }

  if (isPlainObject(detail)) {
    return intl.formatMessage(
      {
        id: 'activitylog_detail_objectsummary',
        defaultMessage: 'Payload contains {count} JSON fields.',
      },
      { count: Object.keys(detail).length },
    );
  }

  return intl.formatMessage({
    id: 'activitylog_detail_scalarsummary',
    defaultMessage: 'Payload is stored as a single value.',
  });
}

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

function PayloadPanel({ title, description, content }: { title: string; description: string; content: ReactNode }) {
  return (
    <Card variant="secondary" className="h-full">
      <Card.Header>
        <Card.Title className="text-base">{title}</Card.Title>
        <Card.Description>{description}</Card.Description>
      </Card.Header>
      <Card.Content>{content}</Card.Content>
    </Card>
  );
}

function SimpleObjectTable({ data }: { data: JsonRecord }) {
  const entries = Object.entries(data);

  if (!entries.length) {
    return (
      <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-8 text-center">
        <Icon icon="solar:document-text-linear" className="size-6 text-muted" />
        <span className="text-sm text-muted">No data available.</span>
      </EmptyState>
    );
  }

  return (
    <Table variant="primary">
      <Table.ScrollContainer>
        <Table.Content aria-label="Activity log detail object table" className="min-w-full">
          <Table.Header>
            <Table.Column isRowHeader>Field</Table.Column>
            <Table.Column>Value</Table.Column>
          </Table.Header>
          <Table.Body>
            {entries.map(([key, value]) => (
              <Table.Row key={key} id={key}>
                <Table.Cell className="align-top font-medium text-foreground/80">{formatLabel(key)}</Table.Cell>
                <Table.Cell>
                  {isPlainObject(value) || Array.isArray(value) ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-default-100 p-3 text-xs text-foreground/80">
                      {prettify(value)}
                    </pre>
                  ) : (
                    <span className="text-sm text-foreground">{String(value ?? '-')}</span>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}

function DetailPayload({ action, detail, intl }: { action: string; detail: unknown; intl: IntlShape }) {
  if (detail == null) {
    return (
      <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
        <Icon icon="solar:shield-check-linear" className="size-6 text-muted" />
        <span className="text-sm text-muted">
          {intl.formatMessage({ id: 'activitylog_detail_nodetails', defaultMessage: 'No details available.' })}
        </span>
      </EmptyState>
    );
  }

  if (action === 'UPDATE' && isPlainObject(detail)) {
    const oldData = detail.old;
    const newData = detail.new;

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <PayloadPanel
          title={intl.formatMessage({ id: 'activitylog_beforetitle', defaultMessage: 'Before (old)' })}
          description={intl.formatMessage({ id: 'activitylog_beforedescription', defaultMessage: 'Snapshot data before the change was applied.' })}
          content={
            isPlainObject(oldData) ? (
              <SimpleObjectTable data={oldData} />
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-default-100 p-3 text-xs text-foreground/80">
                {prettify(oldData)}
              </pre>
            )
          }
        />

        <PayloadPanel
          title={intl.formatMessage({ id: 'activitylog_aftertitle', defaultMessage: 'After (new)' })}
          description={intl.formatMessage({ id: 'activitylog_afterdescription', defaultMessage: 'Snapshot data after the change was successfully saved.' })}
          content={
            isPlainObject(newData) ? (
              <SimpleObjectTable data={newData} />
            ) : (
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-default-100 p-3 text-xs text-foreground/80">
                {prettify(newData)}
              </pre>
            )
          }
        />
      </div>
    );
  }

  if ((action === 'CREATE' || action === 'DELETE') && isPlainObject(detail)) {
    return <SimpleObjectTable data={detail} />;
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-default-100 p-3 text-xs text-foreground/80">
      {prettify(detail)}
    </pre>
  );
}

export default function ActivityLogDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: queryData, isLoading, isError, error } = useQuery({
    queryKey: ['activityLogDetail', id],
    queryFn: () => trpcClient.activityLog.detail.query({ id: id ?? '' }),
    enabled: Boolean(id),
  });
  const data = queryData as ActivityLogDetail | undefined;

  const createdAtValue = data?.createdAt ? new Date(data.createdAt) : null;
  const createdAt = createdAtValue ? createdAtValue.toLocaleString() : '-';
  const createdAtDate = createdAtValue ? createdAtValue.toLocaleDateString() : '-';
  const createdAtTime = createdAtValue ? createdAtValue.toLocaleTimeString() : '-';

  const detailPayload: unknown = data?.detail as unknown;

  const intl = useIntl();

  return (
    <section className="space-y-4">
      {isLoading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-default-200 bg-default-50 px-4 py-6 text-sm text-muted">
          <Spinner size="sm" />
          {intl.formatMessage({ id: 'activitylog_loading', defaultMessage: 'Loading activity log details...' })}
        </div>
      ) : null}

      {isError ? (
        <Card variant="transparent" className="border border-danger-soft-hover bg-danger/5">
          <Card.Content className="flex items-center gap-3 py-5 text-danger-600">
            <Icon icon="solar:danger-triangle-linear" className="size-5" />
            <p className="text-sm">
              {error?.message ?? intl.formatMessage({ id: 'activitylog_errorload', defaultMessage: 'Failed to load activity log details.' })}
            </p>
          </Card.Content>
        </Card>
      ) : null}

      {!isLoading && !isError && !data ? (
        <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-16 text-center">
          <Icon icon="solar:file-search-linear" className="size-8 text-muted" />
          <span className="text-sm text-muted">
            {intl.formatMessage({ id: 'activitylog_notfound', defaultMessage: 'Activity log record not found.' })}
          </span>
        </EmptyState>
      ) : null}

      {!isLoading && !isError && data ? (
        <>
          <PageHeader
            title={intl.formatMessage({ id: 'activitylog_detail_page_title', defaultMessage: 'Activity Log Detail' })}
            onBack={() => navigate('/activity-logs')}
          />

          <Card className="overflow-hidden border border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96)_48%,rgba(14,116,144,0.9))] text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <Card.Content className="grid gap-6 p-6 md:grid-cols-[260px_1fr] md:p-8">
              <div className="space-y-4">
                <div className="flex h-64 items-center justify-center rounded-[2rem] border border-white/12 bg-white/6 backdrop-blur-sm">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/10 bg-white/10">
                    <Icon icon="solar:clipboard-list-linear" className="size-14 text-white" />
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Activity ID</p>
                  <p className="mt-2 break-all font-mono text-sm text-white">{data.id}</p>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/72">
                      <Icon icon="solar:document-add-linear" className="size-4" />
                      {intl.formatMessage({ id: 'activitylog_audittraildetail', defaultMessage: 'Audit Trail Detail' })}
                    </div>
                    <div>
                      <Card.Title className="text-3xl text-white">{data.resource}</Card.Title>
                      <Card.Description className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                        {intl.formatMessage(
                          {
                            id: 'activitylog_summarydescription',
                            defaultMessage:
                              'This activity records changes on resource {resource} with a primary message and payload ready for review.',
                          },
                          { resource: data.resource },
                        )}
                      </Card.Description>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Chip color={ACTION_COLOR_MAP[data.action]} size="sm" variant="soft">
                        {data.action}
                      </Chip>
                      <Chip color="default" size="sm" variant="soft">
                        {data.user?.name ?? intl.formatMessage({ id: 'activitylog_unknownactor', defaultMessage: 'Unknown actor' })}
                      </Chip>
                      <Chip color="accent" size="sm" variant="soft">
                        {describeDetailPayload(detailPayload, intl)}
                      </Chip>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">
                      {intl.formatMessage({ id: 'activitylog_fieldmessage', defaultMessage: 'Message' })}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white">{data.message}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">
                      {intl.formatMessage({ id: 'activitylog_fielddate', defaultMessage: 'Date' })}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">{createdAtDate}</p>
                    <p className="mt-1 text-xs text-white/60">{createdAtTime}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">
                      {intl.formatMessage({ id: 'activitylog_fieldactor', defaultMessage: 'Actor' })}
                    </p>
                    <p className="mt-2 text-sm text-white">{data.user?.name ?? intl.formatMessage({ id: 'activitylog_unknownactorshort', defaultMessage: 'Unknown' })}</p>
                    <p className="mt-1 text-xs text-white/60">{data.user?.email ?? '-'}</p>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">
                      {intl.formatMessage({ id: 'activitylog_fieldtargetresource', defaultMessage: 'Target Resource' })}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-white/88">
                      <p>{data.resource}</p>
                      <p className="truncate text-white/60">{data.resourceId}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card.Content>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card variant="secondary">
              <Card.Header>
                <Card.Title className="text-base">
                  {intl.formatMessage({ id: 'activitylog_snapshottitle', defaultMessage: 'Operational Snapshot' })}
                </Card.Title>
                <Card.Description>
                  {intl.formatMessage({
                    id: 'activitylog_snapshotdescription',
                    defaultMessage: 'Core summary for reading log context before entering the JSON payload.',
                  })}
                </Card.Description>
              </Card.Header>
              <Card.Content className="grid gap-3 md:grid-cols-2">
                <DetailField label={intl.formatMessage({ id: 'activitylog_fieldaction', defaultMessage: 'Action' })} value={<Chip color={ACTION_COLOR_MAP[data.action]} size="sm" variant="soft">{data.action}</Chip>} />
                <DetailField label={intl.formatMessage({ id: 'activitylog_fieldresource', defaultMessage: 'Resource' })} value={data.resource} />
                <DetailField label={intl.formatMessage({ id: 'activitylog_fieldtimestamp', defaultMessage: 'Timestamp' })} value={createdAt} mono />
                <DetailField label={intl.formatMessage({ id: 'activitylog_fieldpayloadsummary', defaultMessage: 'Payload Summary' })} value={describeDetailPayload(detailPayload, intl)} />
              </Card.Content>
            </Card>

            <Card variant="secondary">
              <Card.Header>
                <Card.Title className="text-base">
                  {intl.formatMessage({ id: 'activitylog_actioncontexttitle', defaultMessage: 'Action Context' })}
                </Card.Title>
                <Card.Description>
                  {intl.formatMessage({
                    id: 'activitylog_actioncontextdescription',
                    defaultMessage: 'Actor identity and main target impacted by this activity.',
                  })}
                </Card.Description>
              </Card.Header>
              <Card.Content className="space-y-3">
                <DetailField label="User" value={data.user?.name ?? 'Unknown'} />
                <DetailField label="Email" value={data.user?.email ?? '-'} />
                <DetailField label="Resource ID" value={data.resourceId} mono />
              </Card.Content>
            </Card>
          </div>

          <Card>
            <Card.Header>
              <Card.Title className="text-base">
                {intl.formatMessage({ id: 'activitylog_auditmetadatatitle', defaultMessage: 'Audit Metadata' })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({
                  id: 'activitylog_auditmetadatadescription',
                  defaultMessage: 'Technical references for activity tracing and source-data correlation.',
                })}
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <DetailField label="Activity ID" value={data.id} mono />
              <DetailField label="User ID" value={data.user?.id ?? '-'} mono />
              <DetailField label="Resource" value={data.resource} />
              <DetailField label="Resource ID" value={data.resourceId} mono />
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <Card.Title className="text-base">
                {intl.formatMessage({ id: 'activitylog_detailtitle', defaultMessage: 'Detail' })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({
                  id: 'activitylog_detaildescription',
                  defaultMessage: 'Raw payload or the recorded change results for this activity.',
                })}
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <DetailPayload action={data.action} detail={detailPayload} intl={intl} />
            </Card.Content>
          </Card>
        </>
      ) : null}
    </section>
  );
}
