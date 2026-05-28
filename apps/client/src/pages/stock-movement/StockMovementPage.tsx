import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Chip, Input, ListBox, Pagination, Select, Separator, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { trpcClient } from '../../lib/trpc';
import { TableEmptyStateContent, TableLoadingRow } from '../_transaction-shared';

// ─── Types ───────────────────────────────────────────────────────────────────

type MovementDirection = 'IN' | 'OUT' | 'NONE';
type TransactionType =
  | 'RECEIVING'
  | 'WIP_COMPLETION'
  | 'RMA_RECEIPT'
  | 'WIP_ISSUE'
  | 'SHIPMENT'
  | 'RETURN_TO_SUPPLIER'
  | 'DISPOSAL'
  | 'SUBINVENTORY_TRANSFER'
  | 'LOSS'
  | 'FOUND';

interface StockMovementRow {
  id: string;
  transactionType: TransactionType;
  direction: MovementDirection;
  documentId: string;
  documentNumber?: string | null;
  quantity: string | number;
  signedQty: string | number;
  transactionDate: string;
  postedAt: string;
  notes?: string | null;
  sku?: { id: string; code?: string | null; name: string } | null;
  palletType?: { id: string; name: string } | null;
  warehouse?: { id: string; name: string } | null;
}

interface StockMovementListResult {
  data: StockMovementRow[];
  meta: { total: number; totalPages: number };
}

interface WarehouseOption { id: string; name: string }
interface SkuOption { id: string; code?: string | null; name: string }

// ─── Direction chip ───────────────────────────────────────────────────────────

const DIRECTION_COLOR_MAP: Record<MovementDirection, 'success' | 'danger' | 'default'> = {
  IN: 'success',
  OUT: 'danger',
  NONE: 'default',
};

const DIRECTION_ICON_MAP: Record<MovementDirection, string> = {
  IN: 'solar:arrow-to-bottom-down-bold',
  OUT: 'solar:arrow-to-top-up-bold',
  NONE: 'solar:transfer-horizontal-linear',
};

function DirectionChip({ direction }: { direction: MovementDirection }) {
  return (
    <Chip color={DIRECTION_COLOR_MAP[direction]} size="sm" variant="soft">
      <Icon icon={DIRECTION_ICON_MAP[direction]} />
      {direction}
    </Chip>
  );
}

// ─── Transaction type label map ──────────────────────────────────────────────

const TX_TYPE_LABEL: Record<TransactionType, string> = {
  RECEIVING: 'Receiving (GR)',
  WIP_COMPLETION: 'WIP Completion (FGR)',
  RMA_RECEIPT: 'RMA Receipt (CRR)',
  WIP_ISSUE: 'WIP Issue (MI)',
  SHIPMENT: 'Shipment (DO)',
  RETURN_TO_SUPPLIER: 'Return to Supplier (SR)',
  DISPOSAL: 'Disposal (DS)',
  SUBINVENTORY_TRANSFER: 'Subinventory Transfer (TO)',
  LOSS: 'Loss (LO)',
  FOUND: 'Found (FO)',
};

const DIRECTION_OPTIONS: MovementDirection[] = ['IN', 'OUT', 'NONE'];
const TX_TYPE_OPTIONS: TransactionType[] = [
  'RECEIVING',
  'WIP_COMPLETION',
  'RMA_RECEIPT',
  'WIP_ISSUE',
  'SHIPMENT',
  'RETURN_TO_SUPPLIER',
  'DISPOSAL',
  'SUBINVENTORY_TRANSFER',
  'LOSS',
  'FOUND',
];

// ─── Page ────────────────────────────────────────────────────────────────────

function StockMovementPage() {
  const intl = useIntl();

  // Pagination
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // Filter state
  const [filterDirection, setFilterDirection] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterWarehouseId, setFilterWarehouseId] = useState<string>('');
  const [filterSkuId, setFilterSkuId] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  // SKU search inside select
  const [skuSearch, setSkuSearch] = useState('');

  const activeFilterCount = [filterDirection, filterType, filterWarehouseId, filterSkuId, filterDateFrom, filterDateTo].filter(Boolean).length;

  const resetFilters = () => {
    setFilterDirection('');
    setFilterType('');
    setFilterWarehouseId('');
    setFilterSkuId('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSkuSearch('');
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  // Dropdown data
  const { data: warehouseData } = useQuery<{ data: WarehouseOption[] }>({
    queryKey: ['warehouseListForFilter'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: skuData } = useQuery<{ data: SkuOption[] }>({
    queryKey: ['skuListForFilter'],
    queryFn: () => trpcClient.sku.list.query({ page: 1, limit: 500 }),
    staleTime: 5 * 60 * 1000,
  });

  const warehouseOptions = warehouseData?.data ?? [];
  const skuOptions = skuData?.data ?? [];
  const filteredSkuOptions = useMemo(
    () =>
      skuSearch.trim()
        ? skuOptions.filter((s) =>
            `${s.code ?? ''} ${s.name}`.toLowerCase().includes(skuSearch.toLowerCase()),
          )
        : skuOptions,
    [skuOptions, skuSearch],
  );

  // List query
  const { data, isLoading, isFetching } = useQuery<StockMovementListResult>({
    queryKey: [
      'stockMovementList',
      pagination.pageIndex,
      pagination.pageSize,
      search,
      filterDirection,
      filterType,
      filterWarehouseId,
      filterSkuId,
      filterDateFrom,
      filterDateTo,
    ],
    queryFn: () =>
      trpcClient.stockMovement.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
        direction: (filterDirection as MovementDirection) || undefined,
        transactionType: (filterType as TransactionType) || undefined,
        warehouseId: filterWarehouseId || undefined,
        skuId: filterSkuId || undefined,
        dateFrom: filterDateFrom ? new Date(filterDateFrom) : undefined,
        dateTo: filterDateTo ? new Date(filterDateTo) : undefined,
      }),
  });

  const rows = data?.data ?? [];

  // Table columns
  const columns = useMemo<ColumnDef<StockMovementRow>[]>(
    () => [
      {
        accessorKey: 'transactionDate',
        header: intl.formatMessage({ id: 'stock_movement.col_date', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.transactionDate)),
      },
      {
        accessorKey: 'documentNumber',
        header: intl.formatMessage({ id: 'stock_movement.col_document', defaultMessage: 'Document' }),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-medium">{row.original.documentNumber ?? row.original.documentId}</span>
          </div>
        ),
      },
      {
        accessorKey: 'transactionType',
        header: intl.formatMessage({ id: 'stock_movement.col_type', defaultMessage: 'Type' }),
        cell: ({ row }) => (
          <span className="text-xs">{TX_TYPE_LABEL[row.original.transactionType] ?? row.original.transactionType}</span>
        ),
      },
      {
        accessorKey: 'direction',
        header: intl.formatMessage({ id: 'stock_movement.col_direction', defaultMessage: 'Direction' }),
        cell: ({ row }) => <DirectionChip direction={row.original.direction} />,
      },
      {
        accessorKey: 'sku',
        header: intl.formatMessage({ id: 'stock_movement.col_sku', defaultMessage: 'SKU' }),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{row.original.sku?.name ?? '-'}</span>
            {row.original.sku?.code && (
              <span className="font-mono text-xs text-muted">{row.original.sku.code}</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'palletType',
        header: intl.formatMessage({ id: 'stock_movement.col_pallet_type', defaultMessage: 'Pallet Type' }),
        cell: ({ row }) => row.original.palletType?.name ?? '-',
      },
      {
        accessorKey: 'warehouse',
        header: intl.formatMessage({ id: 'stock_movement.col_warehouse', defaultMessage: 'Warehouse' }),
        cell: ({ row }) => row.original.warehouse?.name ?? '-',
      },
      {
        accessorKey: 'quantity',
        header: intl.formatMessage({ id: 'stock_movement.col_qty', defaultMessage: 'Qty' }),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{Number(row.original.quantity).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: 'signedQty',
        header: intl.formatMessage({ id: 'stock_movement.col_signed_qty', defaultMessage: 'Signed Qty' }),
        cell: ({ row }) => {
          const val = Number(row.original.signedQty);
          return (
            <span className={`font-mono text-sm font-semibold ${val > 0 ? 'text-success' : val < 0 ? 'text-danger' : 'text-muted'}`}>
              {val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: 'notes',
        header: intl.formatMessage({ id: 'stock_movement.col_notes', defaultMessage: 'Notes' }),
        cell: ({ row }) => (
          <span className="text-xs text-muted">{row.original.notes ?? '-'}</span>
        ),
      },
    ],
    [intl],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: data?.meta.totalPages ?? 0,
  });

  const totalEntries = data?.meta.total ?? 0;
  const totalPages = Math.max(data?.meta.totalPages ?? 0, 1);
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageStart = totalEntries === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = totalEntries === 0 ? 0 : pageStart + rows.length - 1;

  return (
    <div
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: 'stock-movement',
        page: currentPage,
        pageSize: pagination.pageSize,
        totalEntries,
        searchQuery: search,
        filters: {
          direction: filterDirection || null,
          transactionType: filterType || null,
          warehouseId: filterWarehouseId || null,
          skuId: filterSkuId || null,
          dateFrom: filterDateFrom || null,
          dateTo: filterDateTo || null,
        },
        activeFilterCount,
      })}
    >
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {intl.formatMessage({ id: 'stock_movement.title', defaultMessage: 'Stock Movements' })}
          </h1>
          <p className="text-sm text-muted">
            {intl.formatMessage({
              id: 'stock_movement.description',
              defaultMessage: 'Immutable audit log of all approved inventory movements.',
            })}
          </p>
        </div>
        {activeFilterCount > 0 && (
          <Button size="sm" variant="secondary" onPress={resetFilters}>
            <Icon icon="solar:filter-remove-linear" />
            {intl.formatMessage({ id: 'stock_movement.clear_filters', defaultMessage: 'Clear filters' })}
            <Chip size="sm" variant="primary">{activeFilterCount}</Chip>
          </Button>
        )}
      </div>

      {/* Filter panel */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:filter-linear" />
            <span className="font-semibold text-sm">
              {intl.formatMessage({ id: 'stock_movement.filters_label', defaultMessage: 'Filters' })}
            </span>
          </div>
        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Search */}
            <Input
              fullWidth
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={intl.formatMessage({ id: 'stock_movement.search_placeholder', defaultMessage: 'Search document ID / number…' })}
              variant="secondary"
            />

            {/* Direction */}
            <Select
              fullWidth
              variant="secondary"
              selectedKey={filterDirection || null}
              onSelectionChange={(key) => {
                setFilterDirection(key ? String(key) : '');
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              placeholder={intl.formatMessage({ id: 'stock_movement.filter_direction_placeholder', defaultMessage: 'All directions' })}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {DIRECTION_OPTIONS.map((d) => (
                    <ListBox.Item key={d} id={d} textValue={d}>
                      <DirectionChip direction={d} />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {/* Transaction Type */}
            <Select
              fullWidth
              variant="secondary"
              selectedKey={filterType || null}
              onSelectionChange={(key) => {
                setFilterType(key ? String(key) : '');
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              placeholder={intl.formatMessage({ id: 'stock_movement.filter_type_placeholder', defaultMessage: 'All transaction types' })}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {TX_TYPE_OPTIONS.map((t) => (
                    <ListBox.Item key={t} id={t} textValue={TX_TYPE_LABEL[t]}>
                      {TX_TYPE_LABEL[t]}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {/* Warehouse */}
            <Select
              fullWidth
              variant="secondary"
              selectedKey={filterWarehouseId || null}
              onSelectionChange={(key) => {
                setFilterWarehouseId(key ? String(key) : '');
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              placeholder={intl.formatMessage({ id: 'stock_movement.filter_warehouse_placeholder', defaultMessage: 'All warehouses' })}
            >
              <Select.Trigger>
                <Select.Value>
                  {({ defaultChildren }) => {
                    const w = warehouseOptions.find((x) => x.id === filterWarehouseId);
                    return w ? w.name : defaultChildren;
                  }}
                </Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox renderEmptyState={() => (
                  <div className="py-4 text-center text-sm text-muted">
                    {intl.formatMessage({ id: 'stock_movement.filter_warehouse_empty', defaultMessage: 'No warehouses found' })}
                  </div>
                )}>
                  {warehouseOptions.map((w) => (
                    <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                      {w.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {/* SKU */}
            <Select
              fullWidth
              variant="secondary"
              selectedKey={filterSkuId || null}
              onSelectionChange={(key) => {
                setFilterSkuId(key ? String(key) : '');
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              placeholder={intl.formatMessage({ id: 'stock_movement.filter_sku_placeholder', defaultMessage: 'All SKUs' })}
            >
              <Select.Trigger>
                <Select.Value>
                  {({ defaultChildren }) => {
                    const s = skuOptions.find((x) => x.id === filterSkuId);
                    return s ? `${s.code ?? s.id} — ${s.name}` : defaultChildren;
                  }}
                </Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <div className="p-2 pb-0">
                  <Input
                    fullWidth
                    variant="secondary"
                    value={skuSearch}
                    onChange={(e) => setSkuSearch(e.target.value)}
                    placeholder={intl.formatMessage({ id: 'stock_movement.filter_sku_search', defaultMessage: 'Search SKU…' })}
                  />
                </div>
                <ListBox renderEmptyState={() => (
                  <div className="py-4 text-center text-sm text-muted">
                    {intl.formatMessage({ id: 'stock_movement.filter_sku_empty', defaultMessage: 'No SKUs found' })}
                  </div>
                )}>
                  {filteredSkuOptions.map((s) => (
                    <ListBox.Item key={s.id} id={s.id} textValue={`${s.code ?? ''} ${s.name}`}>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{s.name}</span>
                        {s.code && <span className="font-mono text-xs text-muted">{s.code}</span>}
                      </div>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {/* Date From */}
            <Input
              fullWidth
              type="date"
              variant="secondary"
              value={filterDateFrom}
              onChange={(e) => {
                setFilterDateFrom(e.target.value);
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              placeholder={intl.formatMessage({ id: 'stock_movement.filter_date_from', defaultMessage: 'Date from' })}
            />

            {/* Date To */}
            <Input
              fullWidth
              type="date"
              variant="secondary"
              value={filterDateTo}
              onChange={(e) => {
                setFilterDateTo(e.target.value);
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
              placeholder={intl.formatMessage({ id: 'stock_movement.filter_date_to', defaultMessage: 'Date to' })}
            />
          </div>
        </Card.Content>
      </Card>

      {/* Results */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Icon icon="solar:list-linear" />
              <span className="font-semibold text-sm">
                {intl.formatMessage({ id: 'stock_movement.results_label', defaultMessage: 'Movements' })}
              </span>
            </div>
            {totalEntries > 0 && (
              <span className="text-xs text-muted">
                {intl.formatMessage(
                  { id: 'stock_movement.total_count', defaultMessage: '{count, number} records' },
                  { count: totalEntries },
                )}
              </span>
            )}
          </div>
        </Card.Header>
        <Separator />
        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={intl.formatMessage({ id: 'stock_movement.table_aria', defaultMessage: 'Stock movements table' })}>
                <Table.Header>
                  {table.getHeaderGroups().map((hg) =>
                    hg.headers.map((h) => (
                      <Table.Column key={h.id} isRowHeader={h.id === 'id'}>
                        <span className="font-semibold">
                          {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                        </span>
                      </Table.Column>
                    )),
                  )}
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <TableEmptyStateContent
                      icon="solar:transfer-horizontal-linear"
                      message={intl.formatMessage({
                        id: 'stock_movement.empty',
                        defaultMessage: 'No stock movements found. Adjust filters or approve a transaction.',
                      })}
                    />
                  )}
                >
                  {isLoading || isFetching ? (
                    <TableLoadingRow
                      colSpan={columns.length}
                      message={intl.formatMessage({ id: 'stock_movement.loading', defaultMessage: 'Loading stock movements…' })}
                    />
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.original.id} id={row.original.id}>
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
                      {intl.formatMessage({ id: 'stock_movement.pagination_prev', defaultMessage: 'Prev' })}
                    </Pagination.Previous>
                  </Pagination.Item>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Pagination.Item key={page}>
                      <Pagination.Link isActive={page === currentPage} onPress={() => table.setPageIndex(page - 1)}>
                        {page}
                      </Pagination.Link>
                    </Pagination.Item>
                  ))}
                  <Pagination.Item>
                    <Pagination.Next isDisabled={!table.getCanNextPage()} onPress={() => table.nextPage()}>
                      {intl.formatMessage({ id: 'stock_movement.pagination_next', defaultMessage: 'Next' })}
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>
    </div>
  );
}

export { StockMovementPage };
