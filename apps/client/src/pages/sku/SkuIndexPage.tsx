import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Pagination, SearchField, Spinner, Table, Tabs } from '@heroui/react';
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
import { EntityPhoto } from '../../components/EntityPhoto';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { trpcClient } from '../../lib/trpc';

type SkuType = 'RAW_MATERIAL' | 'PACKAGING_MATERIAL' | 'FINISHED_GOOD';

type SkuRow = {
  id: string;
  code?: string | null;
  name: string;
  description: string | null;
  photo?: string | null;
  type: SkuType;
  createdAt: string;
};

function SkuIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SkuType>('RAW_MATERIAL');
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

  // Reset pagination when tab changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [activeTab]);

  // AI fill form — allows the AI assistant to set the search filter
  useAiFillForm({
    search: (v) => { const s = String(v ?? ''); setSearchInput(s); setSearch(s); setPagination((p) => ({ ...p, pageIndex: 0 })); },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['skuList', activeTab, pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.sku.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
        type: activeTab,
      }),
  });

  const columns = useMemo<ColumnDef<SkuRow>[]>(
    () => [
      {
        accessorKey: 'code',
        header: intl.formatMessage({ id: 'sku.index.header_code', defaultMessage: 'Code' }),
        cell: ({ row }) => row.original.code ?? '-',
      },
      {
        id: 'name',
        header: intl.formatMessage({ id: 'sku.index.header_name', defaultMessage: 'Name' }),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <EntityPhoto src={row.original.photo} alt={row.original.name} />
            <div>
              <p className="text-sm font-medium text-foreground">{row.original.name}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'description',
        header: intl.formatMessage({ id: 'sku.index.header_description', defaultMessage: 'Description' }),
        cell: ({ row }) => row.original.description ?? '-',
      },
      {
        accessorKey: 'createdAt',
        header: intl.formatMessage({ id: 'sku.index.header_created', defaultMessage: 'Created' }),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('id-ID'),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => navigate(`/skus/${row.original.id}`)}
            aria-label={intl.formatMessage({ id: 'sku.index.action_view', defaultMessage: 'View details' })}
          >
            <Icon icon="solar:eye-linear" className="size-4" />
            {intl.formatMessage({ id: 'sku.index.action_view', defaultMessage: 'View' })}
          </Button>
        ),
      },
    ],
    [intl, navigate]
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: data?.meta.totalPages ?? 0,
    state: {
      pagination,
    },
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
        section: 'sku-index',
        activeTab,
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
                {intl.formatMessage({ id: 'sku.index.title', defaultMessage: 'SKU Catalog' })}
              </h1>
              <Card.Description>
                {intl.formatMessage({ id: 'sku.index.description', defaultMessage: 'View SKU records organized by type. Raw materials and packaging materials are managed via suppliers, while finished goods are managed as products.' })}
              </Card.Description>
            </div>

            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => setActiveTab(key as SkuType)}
            >
              <Tabs.List>
                <Tabs.Tab id="RAW_MATERIAL">
                  {intl.formatMessage({ id: 'sku.index.tab_raw_material', defaultMessage: 'Raw Materials' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="PACKAGING_MATERIAL">
                  {intl.formatMessage({ id: 'sku.index.tab_packaging_material', defaultMessage: 'Packaging Materials' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="FINISHED_GOOD">
                  {intl.formatMessage({ id: 'sku.index.tab_finished_good', defaultMessage: 'Finished Goods' })}
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:items-center">
              <div className="w-full sm:w-80">
                <SearchField
                  variant="secondary"
                  fullWidth
                  id="sku-search"
                  value={searchInput}
                  onChange={setSearchInput}
                  aria-label={intl.formatMessage({ id: 'sku.index.search_placeholder', defaultMessage: 'Search SKU code/name/description' })}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={intl.formatMessage({ id: 'sku.index.search_placeholder', defaultMessage: 'Search SKU code/name/description' })} />
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
              <Table.Content aria-label="SKU table" onRowAction={(key) => navigate(`/skus/${String(key)}`)}>
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
                      <Icon icon="solar:box-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">{intl.formatMessage({ id: 'sku.index.empty_state', defaultMessage: 'No SKU data available.' })}</span>
                    </div>
                  )}
                >
                  {isLoading || isFetching ? (
                    <Table.Row id="loading-row">
                      <Table.Cell colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({ id: 'sku.index.loading', defaultMessage: 'Loading SKU data...' })}
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

export { SkuIndexPage };
