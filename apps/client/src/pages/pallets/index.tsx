import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Card, Chip, Pagination, SearchField, Spinner, Table, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '../../lib/trpc';
import { EntityPhoto } from '../../components/EntityPhoto';

type PalletRow = {
  id: string;
  palletNumber?: string | null;
  status: 'AVAILABLE' | 'NOT_AVAILABLE';
  sku?: { id: string; name: string; code?: string | null; photo?: string | null } | null;
  storageLocation?: { id: string; warehouse?: { id: string; name: string } | null } | null;
  sourceType?: string | null;
  createdAt: string;
};

type PalletListResult = {
  data: PalletRow[];
  meta: { total: number; totalPages: number };
};

function PalletIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'NOT_AVAILABLE'>('ALL');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [statusFilter]);

  const { data, isLoading, isFetching } = useQuery<PalletListResult>({
    queryKey: ['palletList', statusFilter, pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.warehouse.pallet.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      }),
  });

  const columns = useMemo<ColumnDef<PalletRow>[]>(
    () => [
      {
        accessorKey: 'palletNumber',
        header: intl.formatMessage({ id: 'pallet.index.header_number', defaultMessage: 'Pallet No.' }),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">
            {row.original.palletNumber ?? row.original.id}
          </span>
        ),
      },
      {
        id: 'sku',
        header: intl.formatMessage({ id: 'pallet.index.header_sku', defaultMessage: 'SKU' }),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <EntityPhoto src={row.original.sku?.photo} alt={row.original.sku?.name ?? ''} />
            <div>
              <p className="text-sm font-medium text-foreground">{row.original.sku?.name ?? '-'}</p>
              {row.original.sku?.code && <p className="text-xs text-muted">{row.original.sku.code}</p>}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: intl.formatMessage({ id: 'pallet.index.header_status', defaultMessage: 'Status' }),
        cell: ({ row }) => (
          <Chip color={row.original.status === 'AVAILABLE' ? 'success' : 'warning'} size="sm" variant="soft">
            {row.original.status}
          </Chip>
        ),
      },
      {
        id: 'location',
        header: intl.formatMessage({ id: 'pallet.index.header_location', defaultMessage: 'Location' }),
        cell: ({ row }) => {
          const loc = row.original.storageLocation;
          return (
            <div>
              <p className="text-sm font-mono">{loc?.id ?? '-'}</p>
              {loc?.warehouse?.name && <p className="text-xs text-muted">{loc.warehouse.name}</p>}
            </div>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: intl.formatMessage({ id: 'pallet.index.header_created', defaultMessage: 'Created' }),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('id-ID'),
      },
    ],
    [intl],
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: data?.meta.totalPages ?? 0,
    state: { pagination },
  });

  const totalEntries = data?.meta.total ?? 0;
  const totalPages = Math.max(data?.meta.totalPages ?? 0, 1);
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageStart = totalEntries === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = totalEntries === 0 ? 0 : pageStart + (data?.data.length ?? 0) - 1;

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: 'pallet-index',
        statusFilter,
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        searchQuery: search,
        totalItems: totalEntries,
      })}
    >
      <Card>
        <Card.Header>
          <div className="flex w-full flex-col gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {intl.formatMessage({ id: 'pallet.index.title', defaultMessage: 'Pallets' })}
              </h1>
              <Card.Description>
                {intl.formatMessage({ id: 'pallet.index.description', defaultMessage: 'View all pallets across warehouses. Pallets are the atomic inventory unit created when inbound transactions are approved.' })}
              </Card.Description>
            </div>

            <Tabs
              selectedKey={statusFilter}
              onSelectionChange={(key) => setStatusFilter(key as typeof statusFilter)}
            >
              <Tabs.List>
                <Tabs.Tab id="ALL">
                  {intl.formatMessage({ id: 'pallet.index.tab_all', defaultMessage: 'All' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="AVAILABLE">
                  {intl.formatMessage({ id: 'pallet.index.tab_available', defaultMessage: 'Available' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="NOT_AVAILABLE">
                  {intl.formatMessage({ id: 'pallet.index.tab_not_available', defaultMessage: 'Not Available' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:items-center">
              <div className="w-full sm:w-80">
                <SearchField
                  variant="secondary"
                  fullWidth
                  value={searchInput}
                  onChange={setSearchInput}
                  aria-label={intl.formatMessage({ id: 'pallet.index.search_placeholder', defaultMessage: 'Search pallet number' })}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={intl.formatMessage({ id: 'pallet.index.search_placeholder', defaultMessage: 'Search pallet number' })} />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
            </div>
          </div>
        </Card.Header>

        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Pallets table" onRowAction={(key) => navigate(`/pallets/${String(key)}`)}>
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column key={header.id} isRowHeader={header.id === 'id'}>
                        <span className="font-semibold">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      </Table.Column>
                    ))
                  )}
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <Icon icon="solar:palette-round-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">{intl.formatMessage({ id: 'pallet.index.empty_state', defaultMessage: 'No pallets found.' })}</span>
                    </div>
                  )}
                >
                  {isLoading || isFetching ? (
                    <Table.Row id="loading-row">
                      <Table.Cell colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({ id: 'pallet.index.loading', defaultMessage: 'Loading pallets...' })}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.original.id} id={row.original.id} className="cursor-pointer">
                        {row.getVisibleCells().map((cell) => (
                          <Table.Cell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>
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

export { PalletIndexPage };