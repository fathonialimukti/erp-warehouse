import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Card,
  Chip,
  ListBox,
  Select,
  Separator,
  Spinner,
  Table,
} from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";
import type { IconName } from "../../components/AppIcon";
import { PageHeader } from "../../components/PageHeader";
import { trpcClient } from "../../lib/trpc";
import {
  TableEmptyStateContent,
  TableLoadingRow,
} from "../_transaction-shared";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WarehouseOption {
  id: string;
  name: string;
}

type MonthRow = {
  month: number;
  openingQty: number;
  inbound: {
    RECEIVING: number;
    WIP_COMPLETION: number;
    RMA_RECEIPT: number;
    FOUND: number;
  };
  transfer: { SUBINVENTORY_TRANSFER: number };
  outbound: {
    WIP_ISSUE: number;
    SHIPMENT: number;
    RETURN_TO_SUPPLIER: number;
    DISPOSAL: number;
    LOSS: number;
  };
  closingQty: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

function InCell({ n }: { n: number }) {
  if (n === 0) return <span className="text-muted text-xs">—</span>;
  return (
    <Chip color="success" size="sm" variant="soft">
      {n.toLocaleString()}
    </Chip>
  );
}

function OutCell({ n }: { n: number }) {
  if (n === 0) return <span className="text-muted text-xs">—</span>;
  return (
    <Chip color="danger" size="sm" variant="soft">
      {n.toLocaleString()}
    </Chip>
  );
}

function ColHeader({
  label,
  icon,
  color,
}: {
  label: string;
  icon: IconName;
  color: string;
}) {
  return (
    <div
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide ${color}`}
    >
      <AppIcon name={icon} className="size-3" />
      {label}
    </div>
  );
}

// ─── Detail page ──────────────────────────────────────────────────────────────

export function SkuStockMovementDetailPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const { skuId } = useParams<{ skuId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [year, setYear] = useState(() => {
    const y = Number(searchParams.get("year"));
    return Number.isFinite(y) && y >= 2020 ? y : new Date().getFullYear();
  });
  const [warehouseId, setWarehouseId] = useState<string | null>(
    () => searchParams.get("warehouseId") ?? null,
  );

  const updateParam = (newYear: number, newWh: string | null) => {
    const p = new URLSearchParams({ year: String(newYear) });
    if (newWh) p.set("warehouseId", newWh);
    setSearchParams(p, { replace: true });
  };

  const { data: warehouseData } = useQuery<{
    data: WarehouseOption[];
    meta: unknown;
  }>({
    queryKey: ["warehouseListForReport"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const detailQuery = useQuery({
    queryKey: ["report", "skuMonthlyDetail", { skuId, year, warehouseId }],
    queryFn: () =>
      trpcClient.report.skuMonthlyDetail.query({
        skuId: skuId!,
        year,
        warehouseId: warehouseId ?? undefined,
      }),
    enabled: Boolean(skuId),
    staleTime: 2 * 60 * 1000,
  });

  const warehouses: WarehouseOption[] = useMemo(
    () => warehouseData?.data?.map((w) => ({ id: w.id, name: w.name })) ?? [],
    [warehouseData],
  );

  const sku = detailQuery.data?.sku;
  const rows: MonthRow[] = detailQuery.data?.months ?? [];
  const isLoading = detailQuery.isFetching;
  const selectedWarehouseName = warehouses.find(
    (w) => w.id === warehouseId,
  )?.name;

  const currentMonth =
    new Date().getFullYear() === year ? new Date().getMonth() + 1 : null;

  // ─── TanStack Table columns ─────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<MonthRow>[]>(
    () => [
      {
        id: "month",
        header: intl.formatMessage({
          id: "report.sku_detail.col_month",
          defaultMessage: "Month",
        }),
        cell: ({ row }) => {
          const isCurrent = row.original.month === currentMonth;
          return (
            <div className="flex items-center gap-2">
              <span
                className={`font-medium text-sm ${isCurrent ? "text-accent" : ""}`}
              >
                {MONTH_NAMES[row.original.month - 1]}
              </span>
              {isCurrent && (
                <Chip color="default" size="sm" variant="soft">
                  {intl.formatMessage({
                    id: "report.sku_detail.current",
                    defaultMessage: "Current",
                  })}
                </Chip>
              )}
            </div>
          );
        },
      },
      {
        id: "opening",
        header: intl.formatMessage({
          id: "report.sku_detail.col_opening",
          defaultMessage: "Opening",
        }),
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold text-sm">
            {row.original.openingQty.toLocaleString()}
          </span>
        ),
      },
      {
        id: "receiving",
        header: () => (
          <ColHeader
            label={intl.formatMessage({
              id: "report.monthly_stock.col_receiving",
              defaultMessage: "Receiving",
            })}
            icon="arrow-down"
            color="text-success"
          />
        ),
        cell: ({ row }) => <InCell n={row.original.inbound.RECEIVING} />,
      },
      {
        id: "wip_completion",
        header: () => (
          <ColHeader
            label={intl.formatMessage({
              id: "report.monthly_stock.col_wip_completion",
              defaultMessage: "WIP Compl.",
            })}
            icon="arrow-down"
            color="text-success"
          />
        ),
        cell: ({ row }) => <InCell n={row.original.inbound.WIP_COMPLETION} />,
      },
      {
        id: "rma_receipt",
        header: () => (
          <ColHeader
            label={intl.formatMessage({
              id: "report.monthly_stock.col_rma_receipt",
              defaultMessage: "RMA",
            })}
            icon="arrow-down"
            color="text-success"
          />
        ),
        cell: ({ row }) => <InCell n={row.original.inbound.RMA_RECEIPT} />,
      },
      {
        id: "found",
        header: () => (
          <ColHeader
            label={intl.formatMessage({
              id: "report.monthly_stock.col_found",
              defaultMessage: "Found",
            })}
            icon="arrow-down"
            color="text-success"
          />
        ),
        cell: ({ row }) => <InCell n={row.original.inbound.FOUND} />,
      },
      {
        id: "transfer",
        header: () => (
          <ColHeader
            label={intl.formatMessage({
              id: "report.monthly_stock.col_transfer",
              defaultMessage: "Transfer",
            })}
            icon="transfer"
            color="text-secondary"
          />
        ),
        cell: ({ row }) => {
          const n = row.original.transfer.SUBINVENTORY_TRANSFER;
          return n === 0 ? (
            <span className="text-muted text-xs">—</span>
          ) : (
            <span className="tabular-nums text-sm">{n.toLocaleString()}</span>
          );
        },
      },
      {
        id: "wip_issue",
        header: () => (
          <ColHeader
            label={intl.formatMessage({
              id: "report.monthly_stock.col_wip_issue",
              defaultMessage: "WIP Issue",
            })}
            icon="arrow-up"
            color="text-danger"
          />
        ),
        cell: ({ row }) => <OutCell n={row.original.outbound.WIP_ISSUE} />,
      },
      {
        id: "shipment",
        header: () => (
          <ColHeader
            label={intl.formatMessage({
              id: "report.monthly_stock.col_shipment",
              defaultMessage: "Shipment",
            })}
            icon="arrow-up"
            color="text-danger"
          />
        ),
        cell: ({ row }) => <OutCell n={row.original.outbound.SHIPMENT} />,
      },
      {
        id: "return_to_supplier",
        header: () => (
          <ColHeader
            label={intl.formatMessage({
              id: "report.monthly_stock.col_return_to_supplier",
              defaultMessage: "Ret. Supplier",
            })}
            icon="arrow-up"
            color="text-danger"
          />
        ),
        cell: ({ row }) => (
          <OutCell n={row.original.outbound.RETURN_TO_SUPPLIER} />
        ),
      },
      {
        id: "disposal",
        header: () => (
          <ColHeader
            label={intl.formatMessage({
              id: "report.monthly_stock.col_disposal",
              defaultMessage: "Disposal",
            })}
            icon="arrow-up"
            color="text-danger"
          />
        ),
        cell: ({ row }) => <OutCell n={row.original.outbound.DISPOSAL} />,
      },
      {
        id: "loss",
        header: () => (
          <ColHeader
            label={intl.formatMessage({
              id: "report.monthly_stock.col_loss",
              defaultMessage: "Loss",
            })}
            icon="arrow-up"
            color="text-danger"
          />
        ),
        cell: ({ row }) => <OutCell n={row.original.outbound.LOSS} />,
      },
      {
        id: "closing",
        header: intl.formatMessage({
          id: "report.sku_detail.col_closing",
          defaultMessage: "Closing",
        }),
        cell: ({ row }) => (
          <Chip
            color={
              row.original.closingQty > row.original.openingQty
                ? "success"
                : row.original.closingQty < row.original.openingQty
                  ? "warning"
                  : "default"
            }
            size="sm"
            variant="soft"
          >
            <span className="font-semibold tabular-nums">
              {row.original.closingQty.toLocaleString()}
            </span>
          </Chip>
        ),
      },
    ],
    [intl, currentMonth],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ─── Render ──────────────────────────────────────────────────────────────────

  const skuLabel = sku
    ? [sku.code, sku.name].filter(Boolean).join(" · ")
    : intl.formatMessage({
        id: "report.sku_detail.title",
        defaultMessage: "Monthly Detail",
      });

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <PageHeader
        title={skuLabel}
        onBack={() => {
          const params = new URLSearchParams({ year: String(year) });
          if (warehouseId) params.set("warehouseId", warehouseId);
          void navigate(`/reports/monthly-stock-movement?${params.toString()}`);
        }}
      />

      {/* ── Filters ── */}
      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-center gap-3">
            {/* Year */}
            <Select
              variant="secondary"
              selectedKey={String(year)}
              onSelectionChange={(key) => {
                if (!key) return;
                const y = Number(key);
                setYear(y);
                updateParam(y, warehouseId);
              }}
              placeholder={intl.formatMessage({
                id: "report.monthly_stock.filter_year",
                defaultMessage: "Year",
              })}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {YEAR_OPTIONS.map((y) => (
                    <ListBox.Item
                      key={String(y)}
                      id={String(y)}
                      textValue={String(y)}
                    >
                      {y}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {/* Warehouse */}
            <Select
              variant="secondary"
              selectedKey={warehouseId ?? "__ALL__"}
              onSelectionChange={(key) => {
                const wh = key === "__ALL__" ? null : String(key);
                setWarehouseId(wh);
                updateParam(year, wh);
              }}
              placeholder={intl.formatMessage({
                id: "report.monthly_stock.filter_warehouse",
                defaultMessage: "All Warehouses",
              })}
            >
              <Select.Trigger>
                <Select.Value>
                  {({ defaultChildren }) =>
                    selectedWarehouseName ?? defaultChildren
                  }
                </Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item
                    id="__ALL__"
                    textValue={intl.formatMessage({
                      id: "report.monthly_stock.all_warehouses",
                      defaultMessage: "All Warehouses",
                    })}
                  >
                    <span className="text-muted">
                      {intl.formatMessage({
                        id: "report.monthly_stock.all_warehouses",
                        defaultMessage: "All Warehouses",
                      })}
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  {warehouses.map((w) => (
                    <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                      {w.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {isLoading && <Spinner size="sm" />}
          </div>
        </Card.Header>
      </Card>

      {/* ── Table ── */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <AppIcon name="calendar" className="size-4 text-muted" />
            <span className="font-medium">
              {intl.formatMessage(
                {
                  id: "report.sku_detail.period_label",
                  defaultMessage: "{year} — 12 months",
                },
                { year },
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
                  id: "report.sku_detail.table_aria",
                  defaultMessage: "Monthly stock movement detail table",
                })}
              >
                <Table.Header>
                  {table.getHeaderGroups().map((hg) =>
                    hg.headers.map((h) => (
                      <Table.Column key={h.id} isRowHeader={h.id === "month"}>
                        <span className="font-semibold">
                          {h.isPlaceholder
                            ? null
                            : flexRender(
                                h.column.columnDef.header,
                                h.getContext(),
                              )}
                        </span>
                      </Table.Column>
                    )),
                  )}
                </Table.Header>

                <Table.Body
                  renderEmptyState={() => (
                    <TableEmptyStateContent
                      icon="chart-line"
                      message={intl.formatMessage({
                        id: "report.sku_detail.empty",
                        defaultMessage:
                          "No stock movement data found for this SKU.",
                      })}
                    />
                  )}
                >
                  {isLoading ? (
                    <TableLoadingRow
                      colSpan={columns.length}
                      message={intl.formatMessage({
                        id: "report.monthly_stock.loading",
                        defaultMessage: "Loading report…",
                      })}
                    />
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <Table.Cell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
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
