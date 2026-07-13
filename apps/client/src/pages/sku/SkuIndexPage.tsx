import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, SearchField, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { EntityPhoto } from '../../components/EntityPhoto';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { DataTable } from '../../components/DataTable';
import { useListPage } from '../../lib/useListPage';
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

  // AI fill form — set the search box; the hook debounces + resets pagination.
  useAiFillForm({
    search: (v) => list.setSearchInput(String(v ?? '')),
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

  const list = useListPage<SkuRow>({
    queryKey: ['skuList'],
    queryFn: (input) =>
      trpcClient.sku.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
        type: activeTab,
      }),
    columns,
    resetDeps: [activeTab],
  });

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: 'sku-index',
        activeTab,
        page: list.currentPage,
        pageSize: list.table.getState().pagination.pageSize,
        searchQuery: list.search,
        totalItems: list.totalEntries,
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
                  value={list.searchInput}
                  onChange={list.setSearchInput}
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
          <DataTable<SkuRow>
            table={list.table}
            columns={columns}
            isLoading={list.isLoading || list.isFetching}
            emptyState={{
              icon: 'solar:box-linear',
              message: intl.formatMessage({ id: 'sku.index.empty_state', defaultMessage: 'No SKU data available.' }),
            }}
            loadingMessage={intl.formatMessage({ id: 'sku.index.loading', defaultMessage: 'Loading SKU data...' })}
            ariaLabel="SKU table"
            rowHeaderId="id"
            onRowAction={(id) => navigate(`/skus/${id}`)}
            totalEntries={list.totalEntries}
            pageStart={list.pageStart}
            pageEnd={list.pageEnd}
          />
        </Card.Content>
      </Card>
    </section>
  );
}

export { SkuIndexPage };
