import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import {
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  Select,
  Separator,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { type ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "../../lib/trpc";
import { useAiFillForm } from "../../components/AiAssistant/useAiFillForm";
import { AiFillButton } from "../../components/AiFill/AiFillButton";
import { AiFillPanel } from "../../components/AiFill/AiFillPanel";
import { DataTable } from "../../components/DataTable";
import { useListPage } from "../../lib/useListPage";
import { FilterPillGroup } from "../../components/stock-movement/FilterPillGroup";
import { ActiveFilterChips } from "../../components/stock-movement/ActiveFilterChips";
import { KpiStrip } from "../../components/stock-movement/KpiStrip";
import { DateRangePresets } from "../../components/stock-movement/DateRangePresets";
import { PageTitle } from "../../components/PageTitle";

// ─── Types ───────────────────────────────────────────────────────────────────

type MovementDirection = "IN" | "OUT" | "NONE";
type TransactionType =
  | "RECEIVING"
  | "WIP_COMPLETION"
  | "RMA_RECEIPT"
  | "WIP_ISSUE"
  | "SHIPMENT"
  | "RETURN_TO_SUPPLIER"
  | "DISPOSAL"
  | "SUBINVENTORY_TRANSFER"
  | "LOSS"
  | "FOUND";

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
  warehouse?: { id: string; name: string } | null;
}

interface WarehouseOption {
  id: string;
  name: string;
}
interface SkuOption {
  id: string;
  code?: string | null;
  name: string;
}

// ─── Direction chip ───────────────────────────────────────────────────────────

const DIRECTION_COLOR_MAP: Record<
  MovementDirection,
  "success" | "danger" | "default"
> = {
  IN: "success",
  OUT: "danger",
  NONE: "default",
};

const DIRECTION_ICON_MAP: Record<MovementDirection, string> = {
  IN: "solar:alt-arrow-down-bold",
  OUT: "solar:alt-arrow-up-bold",
  NONE: "solar:transfer-horizontal-linear",
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
  RECEIVING: "Receiving (GR)",
  WIP_COMPLETION: "WIP Completion (FGR)",
  RMA_RECEIPT: "RMA Receipt (CRR)",
  WIP_ISSUE: "WIP Issue (MI)",
  SHIPMENT: "Shipment (DO)",
  RETURN_TO_SUPPLIER: "Return to Supplier (SR)",
  DISPOSAL: "Disposal (DS)",
  SUBINVENTORY_TRANSFER: "Subinventory Transfer (TO)",
  LOSS: "Loss (LO)",
  FOUND: "Found (FO)",
};

const DIRECTION_OPTIONS: MovementDirection[] = ["IN", "OUT", "NONE"];
const TX_TYPE_OPTIONS: TransactionType[] = [
  "RECEIVING",
  "WIP_COMPLETION",
  "RMA_RECEIPT",
  "WIP_ISSUE",
  "SHIPMENT",
  "RETURN_TO_SUPPLIER",
  "DISPOSAL",
  "SUBINVENTORY_TRANSFER",
  "LOSS",
  "FOUND",
];

const DIRECTION_PILL_OPTIONS = DIRECTION_OPTIONS.map((d) => ({
  value: d,
  label: d,
  color:
    d === "IN"
      ? ("success" as const)
      : d === "OUT"
        ? ("danger" as const)
        : ("accent" as const),
  icon: DIRECTION_ICON_MAP[d],
}));

const TX_TYPE_PILL_OPTIONS = TX_TYPE_OPTIONS.map((t) => ({
  value: t,
  label: TX_TYPE_LABEL[t],
}));

// ─── Page ────────────────────────────────────────────────────────────────────

function StockMovementPage() {
  const intl = useIntl();

  // Filter state
  const [filterDirection, setFilterDirection] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterWarehouseId, setFilterWarehouseId] = useState<string>("");
  const [filterSkuId, setFilterSkuId] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // SKU search inside select
  const [skuSearch, setSkuSearch] = useState("");

  const activeFilterCount = [
    filterDirection,
    filterType,
    filterWarehouseId,
    filterSkuId,
    filterDateFrom,
    filterDateTo,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFilterDirection("");
    setFilterType("");
    setFilterWarehouseId("");
    setFilterSkuId("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSkuSearch("");
  };

  // Dropdown data (using module-scoped procedures)
  const { data: warehouseData } = useQuery<{ data: WarehouseOption[] }>({
    queryKey: ["stockMovementWarehouseOptions"],
    queryFn: () => trpcClient.stockMovement.warehouseOptions.query(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: skuData } = useQuery<{ data: SkuOption[] }>({
    queryKey: ["stockMovementSkuOptions"],
    queryFn: () => trpcClient.stockMovement.skuOptions.query(),
    staleTime: 5 * 60 * 1000,
  });

  const warehouseOptions = warehouseData?.data ?? [];
  const skuOptions = skuData?.data ?? [];
  const filteredSkuOptions = useMemo(
    () =>
      skuSearch.trim()
        ? skuOptions.filter((s) =>
            `${s.code ?? ""} ${s.name}`
              .toLowerCase()
              .includes(skuSearch.toLowerCase()),
          )
        : skuOptions,
    [skuOptions, skuSearch],
  );

  // Active filter chips for the bar below filters
  const activeChips = useMemo(() => {
    const chips: { label: string; onClear: () => void }[] = [];
    if (filterDirection) {
      chips.push({
        label: `Direction: ${filterDirection}`,
        onClear: () => setFilterDirection(""),
      });
    }
    if (filterType) {
      chips.push({
        label: `Type: ${TX_TYPE_LABEL[filterType as TransactionType] ?? filterType}`,
        onClear: () => setFilterType(""),
      });
    }
    if (filterWarehouseId) {
      const w = warehouseOptions.find((x) => x.id === filterWarehouseId);
      chips.push({
        label: `Warehouse: ${w?.name ?? filterWarehouseId}`,
        onClear: () => setFilterWarehouseId(""),
      });
    }
    if (filterSkuId) {
      const s = skuOptions.find((x) => x.id === filterSkuId);
      chips.push({
        label: `SKU: ${s?.name ?? filterSkuId}`,
        onClear: () => setFilterSkuId(""),
      });
    }
    if (filterDateFrom) {
      chips.push({
        label: `From: ${filterDateFrom}`,
        onClear: () => setFilterDateFrom(""),
      });
    }
    if (filterDateTo) {
      chips.push({
        label: `To: ${filterDateTo}`,
        onClear: () => setFilterDateTo(""),
      });
    }
    return chips;
  }, [
    filterDirection,
    filterType,
    filterWarehouseId,
    filterSkuId,
    filterDateFrom,
    filterDateTo,
    warehouseOptions,
    skuOptions,
  ]);

  // Table columns
  const columns = useMemo<ColumnDef<StockMovementRow>[]>(
    () => [
      {
        accessorKey: "transactionDate",
        header: intl.formatMessage({
          id: "stock_movement.col_date",
          defaultMessage: "Date",
        }),
        cell: ({ row }) =>
          intl.formatDate(new Date(row.original.transactionDate)),
      },
      {
        id: "documentNumber",
        accessorKey: "documentNumber",
        header: intl.formatMessage({
          id: "stock_movement.col_document",
          defaultMessage: "Document",
        }),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-medium">
              {row.original.documentNumber ?? row.original.documentId}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "transactionType",
        header: intl.formatMessage({
          id: "stock_movement.col_type",
          defaultMessage: "Type",
        }),
        cell: ({ row }) => (
          <span className="text-xs">
            {TX_TYPE_LABEL[row.original.transactionType] ??
              row.original.transactionType}
          </span>
        ),
      },
      {
        accessorKey: "direction",
        header: intl.formatMessage({
          id: "stock_movement.col_direction",
          defaultMessage: "Direction",
        }),
        cell: ({ row }) => <DirectionChip direction={row.original.direction} />,
      },
      {
        accessorKey: "sku",
        header: intl.formatMessage({
          id: "stock_movement.col_sku",
          defaultMessage: "SKU",
        }),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {row.original.sku?.name ?? "-"}
            </span>
            {row.original.sku?.code && (
              <span className="font-mono text-xs text-muted">
                {row.original.sku.code}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "warehouse",
        header: intl.formatMessage({
          id: "stock_movement.col_warehouse",
          defaultMessage: "Warehouse",
        }),
        cell: ({ row }) => row.original.warehouse?.name ?? "-",
      },
      {
        accessorKey: "quantity",
        header: intl.formatMessage({
          id: "stock_movement.col_qty",
          defaultMessage: "Qty",
        }),
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {Number(row.original.quantity).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "signedQty",
        header: intl.formatMessage({
          id: "stock_movement.col_signed_qty",
          defaultMessage: "Signed Qty",
        }),
        cell: ({ row }) => {
          const val = Number(row.original.signedQty);
          return (
            <span
              className={`font-mono text-sm font-semibold ${val > 0 ? "text-success" : val < 0 ? "text-danger" : "text-muted"}`}
            >
              {val > 0 ? `+${val.toLocaleString()}` : val.toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: "notes",
        header: intl.formatMessage({
          id: "stock_movement.col_notes",
          defaultMessage: "Notes",
        }),
        cell: ({ row }) => (
          <span className="text-xs text-muted">
            {row.original.notes ?? "-"}
          </span>
        ),
      },
    ],
    [intl],
  );

  // List query (shared spine) — filters reset pagination via resetDeps.
  const list = useListPage<StockMovementRow>({
    queryKey: ["stockMovementList"],
    pageSize: 20,
    queryFn: (input) =>
      trpcClient.stockMovement.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
        direction: (filterDirection as MovementDirection) || undefined,
        transactionType: (filterType as TransactionType) || undefined,
        warehouseId: filterWarehouseId || undefined,
        skuId: filterSkuId || undefined,
        dateFrom: filterDateFrom ? new Date(filterDateFrom) : undefined,
        dateTo: filterDateTo ? new Date(filterDateTo) : undefined,
      }),
    columns,
    resetDeps: [
      filterDirection,
      filterType,
      filterWarehouseId,
      filterSkuId,
      filterDateFrom,
      filterDateTo,
    ],
  });

  const rows = list.query.data?.data ?? [];

  // AI fill form integration — allows the AI assistant to set filters
  useAiFillForm({
    search: (v) => {
      list.setSearchInput(String(v ?? ""));
    },
    direction: (v) => {
      setFilterDirection(String(v ?? ""));
    },
    transactionType: (v) => {
      setFilterType(String(v ?? ""));
    },
    warehouseId: (v) => {
      setFilterWarehouseId(String(v ?? ""));
    },
    skuId: (v) => {
      setFilterSkuId(String(v ?? ""));
    },
    dateFrom: (v) => {
      setFilterDateFrom(String(v ?? ""));
    },
    dateTo: (v) => {
      setFilterDateTo(String(v ?? ""));
    },
  });

  return (
    <div
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: "stock-movement",
        page: list.currentPage,
        pageSize: list.table.getState().pagination.pageSize,
        totalEntries: list.totalEntries,
        searchQuery: list.search,
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
          <PageTitle
            title={intl.formatMessage({
              id: "stock_movement.title",
              defaultMessage: "Stock Movements",
            })}
          />
          <h1 className="text-2xl font-semibold text-foreground">
            {intl.formatMessage({
              id: "stock_movement.title",
              defaultMessage: "Stock Movements",
            })}
          </h1>
          <p className="text-sm text-muted">
            {intl.formatMessage({
              id: "stock_movement.description",
              defaultMessage:
                "Immutable audit log of all approved inventory movements.",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AiFillButton />
          {activeFilterCount > 0 && (
            <Button size="sm" variant="secondary" onPress={resetFilters}>
              <Icon icon="solar:filter-remove-linear" />
              {intl.formatMessage({
                id: "stock_movement.clear_filters",
                defaultMessage: "Clear filters",
              })}
              <Chip size="sm" variant="primary">
                {activeFilterCount}
              </Chip>
            </Button>
          )}
        </div>
      </div>

      <AiFillPanel />

      {/* KPI strip */}
      <KpiStrip rows={rows} total={list.totalEntries} />

      {/* Filter panel */}
      <Card>
        <Card.Content className="space-y-4">
          {/* Search */}
          <Input
            fullWidth
            value={list.searchInput}
            onChange={(e) => list.setSearchInput(e.target.value)}
            placeholder={intl.formatMessage({
              id: "stock_movement.search_placeholder",
              defaultMessage: "Search document ID / number…",
            })}
            variant="secondary"
          />

          {/* Direction pills */}
          <FilterPillGroup
            options={DIRECTION_PILL_OPTIONS}
            value={filterDirection}
            onChange={(value) => setFilterDirection(String(value) || "")}
            allLabel="All"
            maxVisible={5}
          />

          {/* Date presets */}
          <DateRangePresets
            dateFrom={filterDateFrom}
            dateTo={filterDateTo}
            onChange={(from, to) => {
              setFilterDateFrom(from);
              setFilterDateTo(to);
            }}
          />

          {/* Transaction type pills */}
          <FilterPillGroup
            options={TX_TYPE_PILL_OPTIONS}
            value={filterType}
            onChange={(value) => setFilterType(String(value) || "")}
            allLabel="All"
            maxVisible={6}
          />

          {/* Advanced toggle */}
          <Button
            size="sm"
            variant="ghost"
            onPress={() => setAdvancedOpen((v) => !v)}
          >
            <Icon
              icon={
                advancedOpen
                  ? "solar:alt-arrow-up-bold"
                  : "solar:alt-arrow-down-bold"
              }
              className="size-4"
            />
            {intl.formatMessage({
              id: advancedOpen
                ? "stock_movement.filter_advanced_hide"
                : "stock_movement.filter_advanced_show",
              defaultMessage: advancedOpen ? "Hide filters" : "Show filters",
            })}
          </Button>

          {/* Advanced section */}
          {advancedOpen && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Warehouse */}
              <Select
                fullWidth
                variant="secondary"
                selectedKey={filterWarehouseId || null}
                onSelectionChange={(key) => {
                  setFilterWarehouseId(key ? String(key) : "");
                }}
                placeholder={intl.formatMessage({
                  id: "stock_movement.filter_warehouse_placeholder",
                  defaultMessage: "All warehouses",
                })}
              >
                <Select.Trigger>
                  <Select.Value>
                    {({ defaultChildren }) => {
                      const w = warehouseOptions.find(
                        (x) => x.id === filterWarehouseId,
                      );
                      return w ? w.name : defaultChildren;
                    }}
                  </Select.Value>
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox
                    renderEmptyState={() => (
                      <div className="py-4 text-center text-sm text-muted">
                        {intl.formatMessage({
                          id: "stock_movement.filter_warehouse_empty",
                          defaultMessage: "No warehouses found",
                        })}
                      </div>
                    )}
                  >
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
                  setFilterSkuId(key ? String(key) : "");
                }}
                placeholder={intl.formatMessage({
                  id: "stock_movement.filter_sku_placeholder",
                  defaultMessage: "All SKUs",
                })}
              >
                <Select.Trigger>
                  <Select.Value>
                    {({ defaultChildren }) => {
                      const s = skuOptions.find((x) => x.id === filterSkuId);
                      return s
                        ? `${s.code ?? s.id} — ${s.name}`
                        : defaultChildren;
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
                      placeholder={intl.formatMessage({
                        id: "stock_movement.filter_sku_search",
                        defaultMessage: "Search SKU…",
                      })}
                    />
                  </div>
                  <ListBox
                    renderEmptyState={() => (
                      <div className="py-4 text-center text-sm text-muted">
                        {intl.formatMessage({
                          id: "stock_movement.filter_sku_empty",
                          defaultMessage: "No SKUs found",
                        })}
                      </div>
                    )}
                  >
                    {filteredSkuOptions.map((s) => (
                      <ListBox.Item
                        key={s.id}
                        id={s.id}
                        textValue={`${s.code ?? ""} ${s.name}`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{s.name}</span>
                          {s.code && (
                            <span className="font-mono text-xs text-muted">
                              {s.code}
                            </span>
                          )}
                        </div>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              {/* Custom date inputs */}
              <Input
                fullWidth
                type="date"
                variant="secondary"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                placeholder={intl.formatMessage({
                  id: "stock_movement.filter_date_from",
                  defaultMessage: "Date from",
                })}
              />
              <Input
                fullWidth
                type="date"
                variant="secondary"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                placeholder={intl.formatMessage({
                  id: "stock_movement.filter_date_to",
                  defaultMessage: "Date to",
                })}
              />
            </div>
          )}

          {/* Active filter chips */}
          <ActiveFilterChips filters={activeChips} onClearAll={resetFilters} />
        </Card.Content>
      </Card>

      {/* Results */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Icon icon="solar:list-linear" />
              <span className="font-semibold text-sm">
                {intl.formatMessage({
                  id: "stock_movement.results_label",
                  defaultMessage: "Movements",
                })}
              </span>
            </div>
            {list.totalEntries > 0 && (
              <span className="text-xs text-muted">
                {intl.formatMessage(
                  {
                    id: "stock_movement.total_count",
                    defaultMessage: "{count, number} records",
                  },
                  { count: list.totalEntries },
                )}
              </span>
            )}
          </div>
        </Card.Header>
        <Separator />
        <Card.Content>
          <DataTable<StockMovementRow>
            table={list.table}
            columns={columns}
            isLoading={list.isLoading || list.isFetching}
            error={
              list.query.isError
                ? {
                    message: intl.formatMessage({
                      id: "stock_movement.error_load",
                      defaultMessage: "Failed to load stock movements.",
                    }),
                    onRetry: () => void list.query.refetch(),
                  }
                : undefined
            }
            emptyState={{
              icon: "solar:transfer-horizontal-linear",
              message: intl.formatMessage({
                id: "stock_movement.empty",
                defaultMessage:
                  "No stock movements found. Adjust filters or approve a transaction.",
              }),
            }}
            loadingMessage={intl.formatMessage({
              id: "stock_movement.loading",
              defaultMessage: "Loading stock movements…",
            })}
            ariaLabel={intl.formatMessage({
              id: "stock_movement.table_aria",
              defaultMessage: "Stock movements table",
            })}
            rowHeaderId="documentNumber"
            totalEntries={list.totalEntries}
            pageStart={list.pageStart}
            pageEnd={list.pageEnd}
          />
        </Card.Content>
      </Card>
    </div>
  );
}

export { StockMovementPage };
