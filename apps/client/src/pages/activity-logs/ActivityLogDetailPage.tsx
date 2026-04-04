import { useMemo } from 'react';
import { Button, Card, Chip, EmptyState, Spinner, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
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

function describeDetailPayload(detail: unknown) {
  if (detail == null) return 'Tidak ada payload tambahan untuk aktivitas ini.';
  if (Array.isArray(detail)) return `Payload berisi array dengan ${detail.length} item.`;
  if (isPlainObject(detail)) return `Payload berisi ${Object.keys(detail).length} field JSON.`;
  return 'Payload disimpan sebagai nilai tunggal.';
}

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

function PayloadPanel({ title, description, content }: { title: string; description: string; content: React.ReactNode }) {
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
        <span className="text-sm text-muted">Tidak ada data.</span>
      </EmptyState>
    );
  }

  return (
    <Table variant="secondary">
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

function DetailPayload({ action, detail }: { action: string; detail: unknown }) {
  if (detail == null) {
    return (
      <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
        <Icon icon="solar:shield-check-linear" className="size-6 text-muted" />
        <span className="text-sm text-muted">Tidak ada detail JSON.</span>
      </EmptyState>
    );
  }

  if (action === 'UPDATE' && isPlainObject(detail)) {
    const oldData = detail.old;
    const newData = detail.new;

    return (
      <div className="grid gap-4 md:grid-cols-2">
        <PayloadPanel
          title="Before (old)"
          description="Snapshot data sebelum perubahan dilakukan."
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
          title="After (new)"
          description="Snapshot data setelah perubahan berhasil disimpan."
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
  const clientAny = trpcClient as any;

  const { data, isLoading, isError, error } = useQuery<ActivityLogDetail>({
    queryKey: ['activityLogDetail', id],
    queryFn: () => clientAny.activityLog.detail.query({ id: id ?? '' }) as Promise<ActivityLogDetail>,
    enabled: Boolean(id),
  });

  const createdAt = useMemo(() => {
    if (!data?.createdAt) return '-';
    return new Date(data.createdAt).toLocaleString();
  }, [data?.createdAt]);

  const createdAtDate = useMemo(() => {
    if (!data?.createdAt) return '-';
    return new Date(data.createdAt).toLocaleDateString();
  }, [data?.createdAt]);

  const createdAtTime = useMemo(() => {
    if (!data?.createdAt) return '-';
    return new Date(data.createdAt).toLocaleTimeString();
  }, [data?.createdAt]);

  const detailPayload: unknown = data?.detail as unknown;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            
            <div>
              <Card.Title className="text-2xl">Activity Log Detail</Card.Title>
              <Card.Description>Informasi lengkap aktivitas, pelaku, target resource, dan payload perubahan.</Card.Description>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" onPress={() => navigate('/activity-logs')}>
              <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
              Back
            </Button>
          </div>
      </div>

      <div className="space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-default-200 bg-default-50 px-4 py-6 text-sm text-muted">
            <Spinner size="sm" />
            Memuat detail activity log...
          </div>
        ) : null}

        {isError ? (
          <Card variant="transparent" className="border border-danger-soft-hover bg-danger/5">
            <Card.Content className="flex items-center gap-3 py-5 text-danger-600">
              <Icon icon="solar:danger-triangle-linear" className="size-5" />
              <p className="text-sm">{error?.message ?? 'Gagal memuat detail activity log.'}</p>
            </Card.Content>
          </Card>
        ) : null}

        {!isLoading && !isError && !data ? (
          <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-16 text-center">
            <Icon icon="solar:file-search-linear" className="size-8 text-muted" />
            <span className="text-sm text-muted">Data activity log tidak ditemukan.</span>
          </EmptyState>
        ) : null}

        {!isLoading && !isError && data ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
              <Card>
                <Card.Header>
                  <Card.Title className="text-base">Ringkasan Aktivitas</Card.Title>
                  <Card.Description>Pesan utama dan konteks singkat dari log yang dipilih.</Card.Description>
                </Card.Header>
                <Card.Content className="space-y-4">
                  <div className="rounded-2xl bg-default-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Message</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{data.message}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <DetailField label="Tanggal" value={createdAtDate} />
                    <DetailField label="Jam" value={createdAtTime} />
                    <DetailField label="Payload" value={describeDetailPayload(detailPayload)} />
                  </div>
                </Card.Content>
              </Card>

              <Card>
                <Card.Header>
                  <Card.Title className="text-base">Pelaku & Target</Card.Title>
                  <Card.Description>Siapa yang melakukan aksi dan resource yang terdampak.</Card.Description>
                </Card.Header>
                <Card.Content className="space-y-3">
                  <DetailField
                    label="User"
                    value={
                      <div className="space-y-1">
                        <p className="font-medium">{data.user?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-muted">{data.user?.email ?? '-'}</p>
                      </div>
                    }
                  />
                  <DetailField label="Resource" value={data.resource} />
                  <DetailField label="Resource ID" value={data.resourceId} mono />
                </Card.Content>
              </Card>
            </div>

            <Card>
              <Card.Header>
                <Card.Title className="text-base">Metadata</Card.Title>
                <Card.Description>Referensi teknis untuk audit trail dan penelusuran data.</Card.Description>
              </Card.Header>
              <Card.Content className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailField label="Activity ID" value={data.id} mono />
                <DetailField label="Action" value={<Chip color={ACTION_COLOR_MAP[data.action]} size="sm" variant="soft">{data.action}</Chip>} />
                <DetailField label="Timestamp" value={createdAt} mono />
                <DetailField label="User ID" value={data.user?.id ?? '-'} mono />
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title className="text-base">Detail JSON</Card.Title>
                <Card.Description>Payload mentah atau hasil perubahan yang direkam untuk aktivitas ini.</Card.Description>
              </Card.Header>
              <Card.Content>
                <DetailPayload action={data.action} detail={detailPayload} />
              </Card.Content>
            </Card>
          </>
        ) : null}
      </div>
    </section>
  );
}
