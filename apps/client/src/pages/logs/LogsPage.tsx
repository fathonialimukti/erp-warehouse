import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useAtomValue } from 'jotai';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Label, ListBox, Modal, Select, Tag, TagGroup, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient, apiBaseUrl } from '../../lib/trpc';
import { useListPage } from '../../lib/useListPage';
import type { ColumnDef } from '@tanstack/react-table';

interface SystemLogRow {
  id: string;
  level: string;
  source: string;
  message: string;
  requestId: string | null;
  userId: string | null;
  path: string | null;
  method: string | null;
  statusCode: number | null;
  durationMs: number | null;
  meta: unknown;
  createdAt: string;
}

interface LiveLogEntry {
  level: string;
  source: string;
  message: string;
  path: string | null;
  method: string | null;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string;
}

const LEVEL_COLORS: Record<string, string> = {
  ERROR: 'text-danger',
  WARN: 'text-warning',
  INFO: 'text-accent',
  DEBUG: 'text-default-foreground',
};

const LEVEL_TAG_CLASSES: Record<string, string> = {
  ERROR: 'data-[selected=true]:bg-danger data-[selected=true]:text-danger-foreground',
  WARN: 'data-[selected=true]:bg-warning data-[selected=true]:text-warning-foreground',
  INFO: 'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
  DEBUG: 'data-[selected=true]:bg-default-foreground data-[selected=true]:text-default',
};

const SOURCES = ['http', 'trpc', 'app', 'ai', 'db', 'mail', 'rate-limit'] as const;

function levelDot(level: string): string {
  switch (level) {
    case 'ERROR':
      return 'bg-danger';
    case 'WARN':
      return 'bg-warning';
    case 'INFO':
      return 'bg-accent';
    default:
      return 'bg-default';
  }
}

function LogDetailModal({ log, onClose }: { log: SystemLogRow | null; onClose: () => void }) {
  const intl = useIntl();
  return (
    <Modal isOpen={log !== null} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {intl.formatMessage({ id: 'logs.detail_title', defaultMessage: 'Log Detail' })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
          {log ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className={`inline-block size-2.5 rounded-full ${levelDot(log.level)}`} />
                <span className={`font-mono font-semibold ${LEVEL_COLORS[log.level] ?? ''}`}>{log.level}</span>
                <span className="text-muted">· {log.source}</span>
              </div>
              <p className="whitespace-pre-wrap break-words font-medium">{log.message}</p>
              <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
                <div>
                  <dt className="font-semibold">Time</dt>
                  <dd>{new Date(log.createdAt).toLocaleString()}</dd>
                </div>
                {log.path ? (
                  <div>
                    <dt className="font-semibold">Path</dt>
                    <dd className="break-all font-mono">{log.method} {log.path}</dd>
                  </div>
                ) : null}
                {log.statusCode !== null ? (
                  <div>
                    <dt className="font-semibold">Status</dt>
                    <dd>{log.statusCode}</dd>
                  </div>
                ) : null}
                {log.durationMs !== null ? (
                  <div>
                    <dt className="font-semibold">Duration</dt>
                    <dd>{log.durationMs}ms</dd>
                  </div>
                ) : null}
                {log.requestId ? (
                  <div>
                    <dt className="font-semibold">Request ID</dt>
                    <dd className="break-all font-mono">{log.requestId}</dd>
                  </div>
                ) : null}
                {log.userId ? (
                  <div>
                    <dt className="font-semibold">User ID</dt>
                    <dd className="break-all font-mono">{log.userId}</dd>
                  </div>
                ) : null}
              </dl>
              {log.meta ? (
                <div>
                  <p className="mb-1 text-xs font-semibold">
                    {intl.formatMessage({ id: 'logs.meta', defaultMessage: 'Metadata' })}
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-xl bg-default-100 p-3 font-mono text-xs">
                    {JSON.stringify(log.meta, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onPress={onClose}>
            {intl.formatMessage({ id: 'action_close', defaultMessage: 'Close' })}
          </Button>
        </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function LiveTailFeed({ enabled, entries }: { enabled: boolean; entries: LiveLogEntry[] }) {
  const intl = useIntl();
  const feedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0 });
  }, [entries.length]);

  if (!enabled) return null;
  return (
    <Card>
      <Card.Content>
        <div className="mb-2 flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <p className="text-sm font-semibold">
            {intl.formatMessage({ id: 'logs.live_tail', defaultMessage: 'Live tail' })}
          </p>
        </div>
        <div ref={feedRef} className="max-h-64 space-y-1 overflow-auto font-mono text-xs">
          {entries.length === 0 ? (
            <p className="text-muted">{intl.formatMessage({ id: 'logs.live_waiting', defaultMessage: 'Waiting for events…' })}</p>
          ) : (
            entries.map((entry, index) => (
              <p key={`${entry.createdAt}-${index}`} className="flex gap-2 break-all">
                <span className="shrink-0 text-muted">{new Date(entry.createdAt).toLocaleTimeString()}</span>
                <span className={`shrink-0 font-semibold ${LEVEL_COLORS[entry.level] ?? ''}`}>{entry.level}</span>
                <span>{entry.message}</span>
              </p>
            ))
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

export function LogsPage() {
  const intl = useIntl();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canRead = hasPermission('log@read');

  const [level, setLevel] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [liveTail, setLiveTail] = useState(false);
  const [liveEntries, setLiveEntries] = useState<LiveLogEntry[]>([]);
  const [selected, setSelected] = useState<SystemLogRow | null>(null);

  // Live tail SSE
  useEffect(() => {
    if (!liveTail || !canRead) return;
    const eventSource = new EventSource(`${apiBaseUrl}/logs/stream`, { withCredentials: true });
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as { type: string; payload?: LiveLogEntry };
        if (parsed.type === 'log' && parsed.payload) {
          setLiveEntries((prev) => [parsed.payload as LiveLogEntry, ...prev].slice(0, 200));
        }
      } catch {
        // ignore malformed frames
      }
    };
    return () => eventSource.close();
  }, [liveTail, canRead]);

  const columns: ColumnDef<SystemLogRow>[] = [
    {
      accessorKey: 'level',
      header: intl.formatMessage({ id: 'logs.column_level', defaultMessage: 'Level' }),
      cell: ({ row }) => (
        <span className={`inline-flex items-center gap-1.5 font-mono text-xs font-semibold ${LEVEL_COLORS[row.original.level] ?? ''}`}>
          <span className={`inline-block size-2 rounded-full ${levelDot(row.original.level)}`} />
          {row.original.level}
        </span>
      ),
    },
    {
      accessorKey: 'source',
      header: intl.formatMessage({ id: 'logs.column_source', defaultMessage: 'Source' }),
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.source}</span>,
    },
    {
      accessorKey: 'message',
      header: intl.formatMessage({ id: 'logs.column_message', defaultMessage: 'Message' }),
      cell: ({ row }) => (
        <span className="block max-w-[420px] truncate font-mono text-xs" title={row.original.message}>
          {row.original.message}
        </span>
      ),
    },
    {
      accessorKey: 'statusCode',
      header: intl.formatMessage({ id: 'logs.column_status', defaultMessage: 'Status' }),
      cell: ({ row }) => (row.original.statusCode !== null ? <span className="font-mono text-xs">{row.original.statusCode}</span> : null),
    },
    {
      accessorKey: 'createdAt',
      header: intl.formatMessage({ id: 'logs.column_time', defaultMessage: 'Time' }),
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  const list = useListPage<SystemLogRow>({
    queryKey: ['systemLogList'],
    queryFn: async (input) => {
      const result = await trpcClient.systemLog.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search || undefined,
        level: (level || undefined) as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | undefined,
        source: (source || undefined) as (typeof SOURCES)[number] | undefined,
      });
      return { data: result.data, meta: result.pagination };
    },
    columns,
    resetDeps: [level, source],
    initialSorting: [],
  });

  const { data: stats } = useQuery({
    queryKey: ['systemLogStats'],
    queryFn: () => trpcClient.systemLog.stats.query(),
  });

  if (!canRead) {
    return (
      <Card>
        <Card.Content>
          <p className="text-sm text-danger">
            {intl.formatMessage({ id: 'logs.permission_denied', defaultMessage: 'You do not have permission to view system logs.' })}
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <section className="space-y-4" data-ai-context={JSON.stringify({ section: 'system-logs' })}>
      <PageHeader
        title={intl.formatMessage({ id: 'logs.title', defaultMessage: 'System Logs' })}
        onBack={() => window.history.back()}
      >
        <Button variant={liveTail ? 'primary' : 'secondary'} onPress={() => setLiveTail((prev) => !prev)}>
          <Icon icon={liveTail ? 'solar:pause-linear' : 'solar:play-linear'} className="size-4" />
          {liveTail
            ? intl.formatMessage({ id: 'logs.stop_tail', defaultMessage: 'Stop live tail' })
            : intl.formatMessage({ id: 'logs.start_tail', defaultMessage: 'Live tail' })}
        </Button>
      </PageHeader>

      {stats ? (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-xl border px-3 py-1.5">
            {intl.formatMessage({ id: 'logs.stats_total', defaultMessage: 'Total' })}: <strong>{stats.total}</strong>
          </span>
          <span className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-1.5">
            {intl.formatMessage({ id: 'logs.stats_warn', defaultMessage: 'Warnings' })}: <strong>{stats.warnCount}</strong>
          </span>
          <span className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1.5">
            {intl.formatMessage({ id: 'logs.stats_error', defaultMessage: 'Errors' })}: <strong>{stats.errorCount}</strong>
          </span>
        </div>
      ) : null}

      <LiveTailFeed enabled={liveTail} entries={liveEntries} />

      <Card>
        <Card.Content>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <TextField fullWidth className="max-w-xs" name="log-search">
              <Label>{intl.formatMessage({ id: 'logs.search_aria', defaultMessage: 'Search logs' })}</Label>
              <Input
                fullWidth
                value={list.searchInput}
                onChange={(e) => list.setSearchInput(e.target.value)}
                placeholder={intl.formatMessage({ id: 'logs.search_placeholder', defaultMessage: 'Search messages…' })}
                variant="secondary"
                aria-label={intl.formatMessage({ id: 'logs.search_aria', defaultMessage: 'Search logs' })}
              />
            </TextField>

            <TagGroup
              aria-label={intl.formatMessage({ id: 'logs.filter_level_aria', defaultMessage: 'Filter by level' })}
              selectionMode="single"
              size="sm"
              selectedKeys={level ? new Set([level]) : new Set(['__all'])}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                setLevel(selected === '__all' ? '' : typeof selected === 'string' ? selected : '');
              }}
            >
              <Label>{intl.formatMessage({ id: 'logs.column_level', defaultMessage: 'Level' })}</Label>
              <TagGroup.List>
                <Tag id="__all" className="data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground">
                  {intl.formatMessage({ id: 'logs.filter_all', defaultMessage: 'All' })}
                </Tag>
                {(['ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map((lv) => (
                  <Tag key={lv} id={lv} className={LEVEL_TAG_CLASSES[lv]}>
                    {lv}
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>

            <TextField fullWidth className="max-w-40" name="source">
              <Label>{intl.formatMessage({ id: 'logs.column_source', defaultMessage: 'Source' })}</Label>
              <Select
                selectedKey={source || null}
                onSelectionChange={(key) => setSource(typeof key === 'string' ? key : '')}
                variant="secondary"
                aria-label={intl.formatMessage({ id: 'logs.filter_source_aria', defaultMessage: 'Filter by source' })}
              >
                <Select.Trigger>
                  <Select.Value>{source || intl.formatMessage({ id: 'logs.filter_all_sources', defaultMessage: 'All sources' })}</Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="__all" textValue="__all">
                      <Label>{intl.formatMessage({ id: 'logs.filter_all_sources', defaultMessage: 'All sources' })}</Label>
                    </ListBox.Item>
                    {SOURCES.map((src) => (
                      <ListBox.Item key={src} id={src} textValue={src}>
                        <Label>{src}</Label>
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </TextField>
          </div>

          <DataTable
            table={list.table}
            columns={columns}
            isLoading={list.isLoading || list.isFetching}
            emptyState={{ icon: 'solar:document-linear', message: intl.formatMessage({ id: 'logs.empty', defaultMessage: 'No log entries found.' }) }}
            loadingMessage={intl.formatMessage({ id: 'logs.loading', defaultMessage: 'Loading logs…' })}
            ariaLabel={intl.formatMessage({ id: 'logs.table_aria', defaultMessage: 'System logs' })}
            onRowAction={(id) => {
              const row = list.query.data?.data.find((entry) => entry.id === id);
              if (row) setSelected(row);
            }}
            totalEntries={list.totalEntries}
            pageStart={list.pageStart}
            pageEnd={list.pageEnd}
          />

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              isDisabled={list.currentPage <= 1}
              onPress={() => list.table.previousPage()}
              aria-label={intl.formatMessage({ id: 'action_previous_page', defaultMessage: 'Previous page' })}
            >
              <Icon icon="mdi:chevron-left" />
            </Button>
            <span className="self-center font-mono text-xs text-muted">
              {list.currentPage} / {list.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              isDisabled={list.currentPage >= list.totalPages}
              onPress={() => list.table.nextPage()}
              aria-label={intl.formatMessage({ id: 'action_next_page', defaultMessage: 'Next page' })}
            >
              <Icon icon="mdi:chevron-right" />
            </Button>
          </div>
        </Card.Content>
      </Card>

      <LogDetailModal log={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
