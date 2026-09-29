import { useIntl } from "react-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Chip,
  Spinner,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  SearchField,
  Select,
  Label,
  ListBox,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useState, useEffect, useMemo } from "react";
import { useAtomValue } from "jotai";
import { trpcClient } from "../../lib/trpc";
import { hasPermissionAtom } from "../../lib/atoms";
import { WarehouseScene } from "../warehouse/warehouse-layout-3d/_WarehouseScene";
import { DetailModal } from "../warehouse/warehouse-layout-3d/_DetailModal";
import { PageTitle } from "../../components/PageTitle";
import {
  AGING_CATEGORY_COLORS,
  type PalletInteractionInfo,
} from "../warehouse/warehouse-layout-3d/_WarehouseModel";

type AgingCategory = "active" | "slow_moving" | "dead_stock" | "no_data";

type Summary = {
  totalSkuCount: number;
  totalInventoryValue: number;
  deadStockValue: number;
  deadStockSkuCount: number;
  deadStockPercentage: number;
  slowMovingValue: number;
  slowMovingSkuCount: number;
  slowMovingPercentage: number;
  activeValue: number;
  activeSkuCount: number;
  activePercentage: number;
  noDataValue: number;
  zoneBreakdown: Array<{
    warehouseId: string;
    warehouseName: string;
    deadValue: number;
    slowValue: number;
    activeValue: number;
    totalPallets: number;
  }>;
};

type AgingRow = {
  id: string;
  code: string | null;
  name: string;
  type: "RAW_MATERIAL" | "FINISHED_GOOD" | "PACKAGING_MATERIAL";
  standardCost: number | null;
  warehouseId: string;
  warehouseName: string;
  palletCount: number;
  totalValue: number;
  lastMovementDate: string | null;
  daysSinceMovement: number | null;
  agingCategory: AgingCategory;
};

const IDR_FORMAT = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const formatIdr = (n: number) => IDR_FORMAT.format(n);

const AGING_COLOR_MAP: Record<
  AgingCategory,
  { bg: string; text: string; label: string }
> = {
  active: {
    bg: "bg-success-soft",
    text: "text-success",
    label: "inventory_aging.category.active",
  },
  slow_moving: {
    bg: "bg-warning-soft",
    text: "text-warning",
    label: "inventory_aging.category.slow_moving",
  },
  dead_stock: {
    bg: "bg-danger-soft",
    text: "text-danger",
    label: "inventory_aging.category.dead_stock",
  },
  no_data: {
    bg: "bg-default-soft",
    text: "text-muted",
    label: "inventory_aging.category.no_data",
  },
};

function InventoryAgingPage() {
  const intl = useIntl();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canViewWarehouseScene = hasPermission("warehouse@read");
  const [activeTab, setActiveTab] = useState<AgingCategory>("dead_stock");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(
    null,
  );
  const [detailModal, setDetailModal] = useState<{
    x: number;
    y: number;
    info: PalletInteractionInfo;
  } | null>(null);
  const [palletAgingMap, setPalletAgingMap] = useState<
    Record<string, { daysSinceMovement: number | null; agingCategory: string }>
  >({});

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Warehouse list for the 3D scene selector
  const { data: warehouseListData } = useQuery({
    queryKey: ["warehouseOptions"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const warehouses = useMemo(
    () => warehouseListData?.data ?? [],
    [warehouseListData],
  );

  // Default the selector to the first warehouse once the list loads
  useEffect(() => {
    if (!selectedWarehouseId && warehouses.length > 0) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId]);

  // Summary query (no pagination)
  const summaryQuery = useQuery({
    queryKey: ["inventoryAgingSummary"],
    queryFn: () => trpcClient.inventoryAging.summary.query(),
    staleTime: 60 * 1000,
  });

  // List query (paginated, filtered)
  const listQuery = useQuery({
    queryKey: ["inventoryAgingList", activeTab, search],
    queryFn: () =>
      trpcClient.inventoryAging.list.query({
        page: 1,
        limit: 50,
        search: search || undefined,
        agingCategory: activeTab,
        sortBy: "value",
        sortDir: "desc",
      }),
  });

  const summary: Summary | undefined = summaryQuery.data;
  const rows: AgingRow[] = (listQuery.data?.data ?? []) as AgingRow[];

  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      {
        key: "total_sku",
        label: intl.formatMessage({
          id: "inventory_aging.kpi.total_sku",
          defaultMessage: "Total SKU",
        }),
        value: summary.totalSkuCount.toLocaleString("id-ID"),
        sub: intl.formatMessage({
          id: "inventory_aging.kpi.total_sku_sub",
          defaultMessage: "Available inventory SKUs",
        }),
        icon: "solar:box-minimalistic-linear",
        color: "blue" as const,
      },
      {
        key: "total_value",
        label: intl.formatMessage({
          id: "inventory_aging.kpi.total_value",
          defaultMessage: "Total Inventory Value",
        }),
        value: formatIdr(summary.totalInventoryValue),
        sub: intl.formatMessage({
          id: "inventory_aging.kpi.total_value_sub",
          defaultMessage: "Sum of qty × standard cost",
        }),
        icon: "solar:wallet-money-linear",
        color: "purple" as const,
      },
      {
        key: "dead_stock",
        label: intl.formatMessage({
          id: "inventory_aging.kpi.dead_stock",
          defaultMessage: "Dead Stock Value",
        }),
        value: formatIdr(summary.deadStockValue),
        sub: `${summary.deadStockPercentage}% · ${summary.deadStockSkuCount} SKUs`,
        icon: "solar:danger-triangle-linear",
        color: "red" as const,
      },
      {
        key: "slow_moving",
        label: intl.formatMessage({
          id: "inventory_aging.kpi.slow_moving",
          defaultMessage: "Slow Moving Value",
        }),
        value: formatIdr(summary.slowMovingValue),
        sub: `${summary.slowMovingPercentage}% · ${summary.slowMovingSkuCount} SKUs`,
        icon: "solar:clock-circle-linear",
        color: "orange" as const,
      },
    ];
  }, [summary, intl]);

  const isLoading = summaryQuery.isLoading || listQuery.isLoading;
  const isFetching = summaryQuery.isFetching || listQuery.isFetching;

  // Aging category counts for the 3D scene legend (driven by onAgingMapChange)
  const agingCounts = useMemo(() => {
    const counts = { active: 0, slow_moving: 0, dead_stock: 0, no_data: 0 };
    for (const d of Object.values(palletAgingMap)) {
      if (d.agingCategory in counts) {
        counts[d.agingCategory as keyof typeof counts] += 1;
      }
    }
    return counts;
  }, [palletAgingMap]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── In-progress banner ────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-2xl border border-warning-soft-hover bg-warning-soft p-4">
        <Icon
          icon="solar:info-circle-bold"
          className="mt-0.5 size-5 shrink-0 text-warning"
        />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {intl.formatMessage({
              id: "inventory_aging.in_progress_banner.title",
              defaultMessage: "This page is under active development",
            })}
          </p>
          <p className="mt-1 text-sm text-muted">
            {intl.formatMessage({
              id: "inventory_aging.in_progress_banner.description",
              defaultMessage:
                "Inventory aging data, filters, and visualisations are being refined. Some numbers may change as the feature is completed.",
            })}
          </p>
        </div>
      </div>

      {/* ── Page header ────────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <PageTitle
            title={intl.formatMessage({
              id: "inventory_aging.page_title",
              defaultMessage: "Inventory Aging Analyzer",
            })}
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {intl.formatMessage({
              id: "inventory_aging.page_title",
              defaultMessage: "Inventory Aging Analyzer",
            })}
          </h1>
          {isFetching && <Spinner size="sm" />}
        </div>
        <p className="text-sm text-muted">
          {intl.formatMessage({
            id: "inventory_aging.page_description",
            defaultMessage:
              "Identify dead stock and slow-moving inventory. Capital tied up in non-moving goods is highlighted in red.",
          })}
        </p>
      </header>

      {/* ── KPI cards ─────────────────────────────────────────────── */}
      <section
        aria-label="KPI summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} loading={summaryQuery.isLoading} />
        ))}
      </section>

      {/* ── 3D warehouse scene + zone breakdown ───────────────────── */}
      <section
        aria-label="Warehouse 3D view"
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      >
        <Card className="lg:col-span-2">
          <Card.Header>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Card.Title>
                  {intl.formatMessage({
                    id: "inventory_aging.scene.title",
                    defaultMessage: "Warehouse 3D View",
                  })}
                </Card.Title>
                <Card.Description>
                  {intl.formatMessage({
                    id: "inventory_aging.scene.subtitle",
                    defaultMessage:
                      "Pallets colored by aging. Red = dead stock, yellow = slow moving, green = active. Click a pallet for details.",
                  })}
                </Card.Description>
              </div>
              {canViewWarehouseScene && (
                <Select
                  value={selectedWarehouseId ?? ""}
                  onChange={(key) =>
                    setSelectedWarehouseId(String(key) || null)
                  }
                  variant="secondary"
                  className="w-full sm:w-56"
                >
                  <Label>
                    {intl.formatMessage({
                      id: "inventory_aging.warehouse_selector.label",
                      defaultMessage: "Warehouse",
                    })}
                  </Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {warehouses.map((wh) => (
                        <ListBox.Item key={wh.id} id={wh.id}>
                          {wh.name}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              )}
            </div>
          </Card.Header>
          <Card.Content>
            <div className="h-[420px] w-full overflow-hidden rounded-xl bg-default-50">
              {!canViewWarehouseScene ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <Icon
                    icon="solar:lock-linear"
                    className="size-8 text-muted"
                  />
                  <p className="max-w-xs text-sm text-muted">
                    {intl.formatMessage({
                      id: "inventory_aging.scene.permission_required",
                      defaultMessage:
                        "The 3D warehouse view requires warehouse read permission.",
                    })}
                  </p>
                </div>
              ) : !selectedWarehouseId ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              ) : (
                <WarehouseScene
                  warehouseId={selectedWarehouseId}
                  agingMode
                  showGrid={false}
                  onPalletClick={(info) => {
                    const modalW = 340;
                    const modalH = 300;
                    const x =
                      info.screenX + modalW > window.innerWidth
                        ? info.screenX - modalW
                        : info.screenX + 4;
                    const y =
                      info.screenY + modalH > window.innerHeight
                        ? info.screenY - modalH
                        : info.screenY + 4;
                    setDetailModal({ x, y, info });
                  }}
                  onAgingMapChange={setPalletAgingMap}
                />
              )}
            </div>
            {/* Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: AGING_CATEGORY_COLORS.active }}
                />
                {intl.formatMessage({
                  id: "inventory_aging.legend.active",
                  defaultMessage: "Active (< 30d)",
                })}
                <span className="font-mono text-foreground">
                  {agingCounts.active}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: AGING_CATEGORY_COLORS.slow_moving }}
                />
                {intl.formatMessage({
                  id: "inventory_aging.legend.slow_moving",
                  defaultMessage: "Slow Moving (30-180d)",
                })}
                <span className="font-mono text-foreground">
                  {agingCounts.slow_moving}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: AGING_CATEGORY_COLORS.dead_stock }}
                />
                {intl.formatMessage({
                  id: "inventory_aging.legend.dead_stock",
                  defaultMessage: "Dead Stock (> 180d)",
                })}
                <span className="font-mono text-foreground">
                  {agingCounts.dead_stock}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: AGING_CATEGORY_COLORS.no_data }}
                />
                {intl.formatMessage({
                  id: "inventory_aging.category.no_data",
                  defaultMessage: "No Movement Data",
                })}
                <span className="font-mono text-foreground">
                  {agingCounts.no_data}
                </span>
              </span>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>
              {intl.formatMessage({
                id: "inventory_aging.zone_breakdown.title",
                defaultMessage: "By Zone",
              })}
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({
                id: "inventory_aging.zone_breakdown.subtitle",
                defaultMessage: "Top zones ranked by dead stock value",
              })}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <ul className="space-y-3">
              {(summary?.zoneBreakdown ?? [])
                .slice()
                .sort((a, b) => b.deadValue - a.deadValue)
                .slice(0, 6)
                .map((zone) => (
                  <li key={zone.warehouseId} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">
                        {zone.warehouseName}
                      </span>
                      <span className="text-xs text-muted">
                        {zone.totalPallets} pallets
                      </span>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-default-soft">
                      <div
                        className="bg-danger"
                        style={{
                          width: `${pct(zone.deadValue, zone.deadValue + zone.slowValue + zone.activeValue)}%`,
                        }}
                        title={intl.formatMessage({
                          id: "inventory_aging.legend.dead_stock",
                          defaultMessage: "Dead Stock",
                        })}
                      />
                      <div
                        className="bg-warning"
                        style={{
                          width: `${pct(zone.slowValue, zone.deadValue + zone.slowValue + zone.activeValue)}%`,
                        }}
                      />
                      <div
                        className="bg-success"
                        style={{
                          width: `${pct(zone.activeValue, zone.deadValue + zone.slowValue + zone.activeValue)}%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>🔴 {formatIdr(zone.deadValue)}</span>
                      <span>🟡 {formatIdr(zone.slowValue)}</span>
                    </div>
                  </li>
                ))}
              {summary && summary.zoneBreakdown.length === 0 && (
                <li className="text-sm text-muted">
                  {intl.formatMessage({
                    id: "inventory_aging.zone_breakdown.empty",
                    defaultMessage: "No data available.",
                  })}
                </li>
              )}
            </ul>
          </Card.Content>
        </Card>
      </section>

      {/* ── Tabs + table ──────────────────────────────────────────── */}
      <Card>
        <Card.Header>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Card.Title>
                {intl.formatMessage({
                  id: "inventory_aging.list.title",
                  defaultMessage: "Aging Breakdown",
                })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({
                  id: "inventory_aging.list.subtitle",
                  defaultMessage:
                    "Filter by category. Items are sorted by value (highest first).",
                })}
              </Card.Description>
            </div>
            <SearchField
              variant="secondary"
              fullWidth
              id="aging-search"
              value={searchInput}
              onChange={setSearchInput}
              aria-label={intl.formatMessage({
                id: "inventory_aging.list.search_placeholder",
                defaultMessage: "Search SKU name or code...",
              })}
              className="w-full sm:max-w-xs"
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                  placeholder={intl.formatMessage({
                    id: "inventory_aging.list.search_placeholder",
                    defaultMessage: "Search SKU name or code...",
                  })}
                />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </div>
        </Card.Header>
        <Card.Content>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as AgingCategory)}
            variant="primary"
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Aging category">
                <Tabs.Tab id="dead_stock">
                  <span className="flex items-center gap-2">
                    <Icon icon="solar:danger-triangle-linear" />
                    {intl.formatMessage({
                      id: "inventory_aging.category.dead_stock",
                      defaultMessage: "Dead Stock",
                    })}
                    <Chip size="sm" variant="soft" color="danger">
                      {summary?.deadStockSkuCount ?? 0}
                    </Chip>
                  </span>
                </Tabs.Tab>
                <Tabs.Tab id="slow_moving">
                  <span className="flex items-center gap-2">
                    <Icon icon="solar:clock-circle-linear" />
                    {intl.formatMessage({
                      id: "inventory_aging.category.slow_moving",
                      defaultMessage: "Slow Moving",
                    })}
                    <Chip size="sm" variant="soft" color="warning">
                      {summary?.slowMovingSkuCount ?? 0}
                    </Chip>
                  </span>
                </Tabs.Tab>
                <Tabs.Tab id="active">
                  <span className="flex items-center gap-2">
                    <Icon icon="solar:check-circle-linear" />
                    {intl.formatMessage({
                      id: "inventory_aging.category.active",
                      defaultMessage: "Active",
                    })}
                    <Chip size="sm" variant="soft" color="success">
                      {summary?.activeSkuCount ?? 0}
                    </Chip>
                  </span>
                </Tabs.Tab>
                <Tabs.Tab id="no_data">
                  <span className="flex items-center gap-2">
                    <Icon icon="solar:question-circle-linear" />
                    {intl.formatMessage({
                      id: "inventory_aging.category.no_data",
                      defaultMessage: "No Movement Data",
                    })}
                  </span>
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id={activeTab}>
              {isLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <Spinner />
                </div>
              ) : rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  {intl.formatMessage({
                    id: "inventory_aging.list.empty",
                    defaultMessage: "No items in this category.",
                  })}
                </p>
              ) : (
                <Table aria-label="Aging items table">
                  <TableHeader>
                    <TableColumn>
                      {intl.formatMessage({
                        id: "inventory_aging.list.header_sku",
                        defaultMessage: "SKU",
                      })}
                    </TableColumn>
                    <TableColumn>
                      {intl.formatMessage({
                        id: "inventory_aging.list.header_warehouse",
                        defaultMessage: "Warehouse",
                      })}
                    </TableColumn>
                    <TableColumn className="text-right">
                      {intl.formatMessage({
                        id: "inventory_aging.list.header_pallets",
                        defaultMessage: "Pallets",
                      })}
                    </TableColumn>
                    <TableColumn className="text-right">
                      {intl.formatMessage({
                        id: "inventory_aging.list.header_value",
                        defaultMessage: "Tied-up Value",
                      })}
                    </TableColumn>
                    <TableColumn>
                      {intl.formatMessage({
                        id: "inventory_aging.list.header_last_movement",
                        defaultMessage: "Last Movement",
                      })}
                    </TableColumn>
                    <TableColumn>
                      {intl.formatMessage({
                        id: "inventory_aging.list.header_category",
                        defaultMessage: "Status",
                      })}
                    </TableColumn>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => {
                      const colors = AGING_COLOR_MAP[row.agingCategory];
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {row.name}
                              </p>
                              <p className="text-xs text-muted">
                                {row.code ?? row.id.slice(0, 8)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{row.warehouseName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.palletCount}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatIdr(row.totalValue)}
                          </TableCell>
                          <TableCell>
                            {row.lastMovementDate ? (
                              <div>
                                <p className="text-sm text-foreground">
                                  {new Date(
                                    row.lastMovementDate,
                                  ).toLocaleDateString("id-ID")}
                                </p>
                                {row.daysSinceMovement !== null && (
                                  <p className="text-xs text-muted">
                                    {intl.formatMessage(
                                      {
                                        id: "inventory_aging.days_ago",
                                        defaultMessage: "{days} days ago",
                                      },
                                      { days: row.daysSinceMovement },
                                    )}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="sm"
                              variant="soft"
                              className={colors.bg}
                            >
                              <span className={colors.text}>
                                {intl.formatMessage({
                                  id: colors.label,
                                  defaultMessage: row.agingCategory,
                                })}
                              </span>
                            </Chip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Tabs.Panel>
          </Tabs>
        </Card.Content>
      </Card>

      {detailModal && (
        <DetailModal data={detailModal} onClose={() => setDetailModal(null)} />
      )}
    </div>
  );
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

type KpiDef = {
  key: string;
  label: string;
  value: string;
  sub: string;
  icon: string;
  color: "blue" | "green" | "orange" | "purple" | "red" | "teal";
};

const kpiStyles: Record<
  KpiDef["color"],
  { bg: string; icon: string; value: string }
> = {
  blue: { bg: "bg-primary-soft", icon: "text-primary", value: "text-primary" },
  green: { bg: "bg-success-soft", icon: "text-success", value: "text-success" },
  orange: {
    bg: "bg-warning-soft",
    icon: "text-warning",
    value: "text-warning",
  },
  teal: {
    bg: "bg-tertiary-soft",
    icon: "text-tertiary",
    value: "text-tertiary",
  },
  purple: {
    bg: "bg-secondary-soft",
    icon: "text-secondary",
    value: "text-secondary",
  },
  red: { bg: "bg-danger-soft", icon: "text-danger", value: "text-danger" },
};

function KpiCard({ kpi, loading }: { kpi: KpiDef; loading: boolean }) {
  const style = kpiStyles[kpi.color];
  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${style.bg}`}
          >
            <Icon icon={kpi.icon} className={`size-5 ${style.icon}`} />
          </div>
          <span className="text-sm font-medium text-muted">{kpi.label}</span>
        </div>
      </Card.Header>
      <Card.Content>
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <>
            <p className={`text-2xl font-bold tracking-tight ${style.value}`}>
              {kpi.value}
            </p>
            <p className="mt-1 text-xs text-muted">{kpi.sub}</p>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

export { InventoryAgingPage };
