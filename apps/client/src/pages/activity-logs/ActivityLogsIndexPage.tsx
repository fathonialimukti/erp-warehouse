import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Card, Chip, EmptyState, Pagination, SearchField, Spinner, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { trpcClient } from '../../lib/trpc';
import { useQuery } from '@tanstack/react-query';

type ActivityLog = {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT';
  resource: string;
  resourceId: string;
  message: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

const ACTION_COLOR_MAP: Record<ActivityLog['action'], 'accent' | 'default' | 'warning' | 'danger' | 'success'> = {
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

function ActivityLogsIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['activityLogs', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.activityLog.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const columns = useMemo<ColumnDef<ActivityLog>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: 'Date',
        cell: ({ getValue }) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {new Date(getValue<string>()).toLocaleDateString()}
            </span>
            <span className="text-xs text-muted">
              {new Date(getValue<string>()).toLocaleTimeString()}
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'user.name',
        header: 'User',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{row.original.user.name || 'Unknown'}</span>
            <span className="text-xs text-muted">{row.original.user.email}</span>
          </div>
        ),
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: ({ row }) => (
          <Chip color={ACTION_COLOR_MAP[row.original.action]} size="sm" variant="soft">
            {row.original.action}
          </Chip>
        ),
      },
      {
        accessorKey: 'resource',
        header: 'Resource',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{row.original.resource}</span>
            <span className="text-xs text-muted">ID: {row.original.resourceId}</span>
          </div>
        ),
      },
      {
        accessorKey: 'message',
        header: 'Message',
        cell: ({ row }) => <span className="text-sm text-foreground/80">{row.original.message}</span>,
      },
    ],
    []
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: data?.pagination.totalPages ?? 0,
    state: {
      pagination,
    },
  });

  const totalEntries = data?.pagination.total ?? 0;
  const totalPages = Math.max(data?.pagination.totalPages ?? 0, 1);
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageStart = totalEntries === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = totalEntries === 0 ? 0 : pageStart + (data?.data.length ?? 0) - 1;

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex items-start justify-between gap-3">
          <div>
            <Card.Title className="text-2xl">Activity Logs</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'activity_log.index.description', defaultMessage: 'Audit trail for login, logout, and system data changes.' })}</Card.Description>
          </div>
          <div className="w-80">
            <SearchField
              variant="secondary"
              fullWidth
              id="activity-log-search"
              value={searchInput}
              onChange={setSearchInput}
              aria-label={intl.formatMessage({ id: 'activity_log.index.search_placeholder', defaultMessage: 'Search activity logs (user, message, resource, etc.)' })}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={intl.formatMessage({ id: 'activity_log.index.search_placeholder', defaultMessage: 'Search activity logs (user, message, resource, etc.)' })} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>
        </Card.Header>

        <Card.Content className="space-y-4">

          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Activity logs table"
                className="min-w-full"
                onRowAction={(key) => navigate(`/activity-logs/${String(key)}`)}
              >
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column key={header.id} isRowHeader={header.id === 'createdAt'}>
                        <span className="font-semibold">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      </Table.Column>
                    ))
                  )}
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <Icon icon="solar:clipboard-list-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">
                        {intl.formatMessage({ id: 'activity_log.index.empty_state', defaultMessage: 'No activity logs found.' })}
                      </span>
                    </EmptyState>
                  )}
                >
                  {isLoading ? (
                    <Table.Row id="loading-row">
                      <Table.Cell className="py-10 text-center" colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({ id: 'activity_log.index.loading', defaultMessage: 'Loading activity logs...' })}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.original.id} id={row.original.id} className="cursor-pointer">
                        {row.getVisibleCells().map((cell) => (
                          <Table.Cell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer>
              <Pagination size="sm">
                <Pagination.Summary>
                  {pageStart} to {pageEnd} of {totalEntries} results
                </Pagination.Summary>
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous isDisabled={!table.getCanPreviousPage()} onPress={() => table.previousPage()}>
                      <Pagination.PreviousIcon />
                      Prev
                    </Pagination.Previous>
                  </Pagination.Item>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <Pagination.Item key={page}>
                      <Pagination.Link isActive={page === currentPage} onPress={() => table.setPageIndex(page - 1)}>
                        {page}
                      </Pagination.Link>
                    </Pagination.Item>
                  ))}
                  <Pagination.Item>
                    <Pagination.Next isDisabled={!table.getCanNextPage()} onPress={() => table.nextPage()}>
                      Next
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>
    </section>
  );
}

export { ActivityLogsIndexPage };