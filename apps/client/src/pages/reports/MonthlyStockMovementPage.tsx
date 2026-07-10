import { useMemo, useState, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  Select,
  Separator,
  Spinner,
  Table,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { trpcClient } from '../../lib/trpc';
import { TableEmptyStateContent, TableLoadingRow } from '../_transaction-shared';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WarehouseOption {
  id: string;
  name: string;
}

type StockRow = {
  sku: { id: string; code?: string | null; name: string };
  currentStock: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer.current);
  }, [value, delay]);
  return debounced;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MonthlyStockMovementPage() {
  const intl = useIntl();
  const navigate = useNavigate();

  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const { data: warehouseData } = useQuery<{ data: WarehouseOption[]; meta: unknown }>({
    queryKey: ['warehouseListForReport'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const reportQuery = useQuery({
    queryKey: ['report', 'skuStockList', { warehouseId, search: debouncedSearch }],
    queryFn: () =>
      trpcClient.report.skuStockList.query({
        warehouseId: warehouseId ?? undefined,
        search: debouncedSearch || undefined,
      }),
    staleTime: 2 * 60 * 1000,
  });

  const warehouses: WarehouseOption[] = useMemo(
    () => warehouseData?.data?.map(w => ({ id: w.id, name: w.name })) ?? [],
    [warehouseData],
  );

  const rows: StockRow[] = reportQuery.data?.data ?? [];
  const isLoading = reportQuery.isFetching;
  const selectedWarehouseName = warehouses.find(w => w.id === warehouseId)?.name;

  // ─── Columns ────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      {
        id: 'sku',
        header: intl.formatMessage({ id: 'report.monthly_stock.col_sku', defaultMessage: 'SKU' }),
        cell: ({ row }) => (
          <div>
            {row.original.sku.code && (
              <p className="font-mono text-xs text-muted">{row.original.sku.code}</p>
            )}
            <p className="font-medium text-sm">{row.original.sku.name}</p>
          </div>
        ),
      },
      {
        id: 'currentStock',
        header: intl.formatMessage({ id: 'report.stock_list.col_stock', defaultMessage: 'Current Stock' }),
        cell: ({ row }) => (
          <Chip
            color={
              row.original.currentStock > 0
                ? 'success'
                : row.original.currentStock < 0
                  ? 'danger'
                  : 'default'
            }
            size="sm"
            variant="soft"
          >
            <span className="font-semibold tabular-nums">
              {row.original.currentStock.toLocaleString()}
            </span>
          </Chip>
        ),
      },
      {
        id: 'action',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              const params = new URLSearchParams({ year: String(new Date().getFullYear()) });
              if (warehouseId) params.set('warehouseId', warehouseId);
              void navigate(
                `/reports/monthly-stock-movement/${row.original.sku.id}?${params.toString()}`,
              );
            }}
          >
            <Icon icon="solar:chart-2-linear" className="size-4" />
            {intl.formatMessage({ id: 'action_detail', defaultMessage: 'Detail' })}
          </Button>
        ),
      },
    ],
    [intl, warehouseId, navigate],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-semibold">
          {intl.formatMessage({
            id: 'report.monthly_stock.title',
            defaultMessage: 'Stock Movement Report',
          })}
        </h1>
        <p className="text-sm text-muted">
          {intl.formatMessage({
            id: 'report.monthly_stock.description',
            defaultMessage: 'Current stock per SKU. Click a row to view monthly breakdown.',
          })}
        </p>
      </div>

      {/* ── Filters ── */}
      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              variant="secondary"
              selectedKey={warehouseId ?? '__ALL__'}
              onSelectionChange={key =>
                setWarehouseId(key === '__ALL__' ? null : String(key))
              }
            >
              <Select.Trigger>
                <Select.Value>
                  {({ defaultChildren }) => selectedWarehouseName ?? defaultChildren}
                </Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item
                    id="__ALL__"
                    textValue={intl.formatMessage({
                      id: 'report.monthly_stock.all_warehouses',
                      defaultMessage: 'All Warehouses',
                    })}
                  >
                    <span className="text-muted">
                      {intl.formatMessage({
                        id: 'report.monthly_stock.all_warehouses',
                        defaultMessage: 'All Warehouses',
                      })}
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {warehouses.map(w => (
                    <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                      {w.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Input
              variant="secondary"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={intl.formatMessage({
                id: 'report.stock_list.search_sku',
                defaultMessage: 'Search SKU…',
              })}
            />

            {isLoading && <Spinner size="sm" />}
          </div>
        </Card.Header>
      </Card>

      {/* ── Table ── */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="solar:box-linear" className="size-4 text-muted" />
              <span className="font-medium">
                {selectedWarehouseName ??
                  intl.formatMessage({
                    id: 'report.monthly_stock.all_warehouses',
                    defaultMessage: 'All Warehouses',
                  })}
              </span>
            </div>
            <span className="text-sm text-muted">
              {intl.formatMessage(
                { id: 'report.monthly_stock.sku_count', defaultMessage: '{count} SKU(s)' },
                { count: rows.length },
              )}
            </span>
          </div>
        </Card.Header>

        <Separator />

        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label={intl.formatMessage({
                  id: 'report.stock_list.table_aria',
                  defaultMessage: 'SKU stock list',
                })}
              >
                <Table.Header>
                  {table.getHeaderGroups().map(hg =>
                    hg.headers.map(h => (
                      <Table.Column key={h.id} isRowHeader={h.id === 'sku'}>
                        <span className="font-semibold">
                          {h.isPlaceholder
                            ? null
                            : flexRender(h.column.columnDef.header, h.getContext())}
                        </span>
                      </Table.Column>
                    )),
                  )}
                </Table.Header>

                <Table.Body
                  renderEmptyState={() => (
                    <TableEmptyStateContent
                      icon="solar:box-broken"
                      message={intl.formatMessage({
                        id: 'report.stock_list.empty',
                        defaultMessage:
                          'No SKUs found. Try a different warehouse or search term.',
                      })}
                    />
                  )}
                >
                  {isLoading ? (
                    <TableLoadingRow
                      colSpan={columns.length}
                      message={intl.formatMessage({
                        id: 'report.monthly_stock.loading',
                        defaultMessage: 'Loading…',
                      })}
                    />
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <Table.Row key={row.id}>
                        {row.getVisibleCells().map(cell => (
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
          </Table>
        </Card.Content>
      </Card>
    </div>
  );
}
