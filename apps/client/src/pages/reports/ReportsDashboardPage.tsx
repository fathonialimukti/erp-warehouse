import { useState } from "react";
import { useIntl } from "react-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, ListBox, Select, Spinner, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Line,
  Cell,
} from "recharts";
import { trpcClient } from "../../lib/trpc";
import { PageTitle } from "../../components/PageTitle";

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

const IDR_FORMAT = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const formatIdr = (n: number) => IDR_FORMAT.format(n);

function formatQty(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
  name?: string;
  color?: string;
  payload?: {
    label?: string;
    fullName?: string;
    skuName?: string;
    skuCode?: string;
    name?: string;
    avgDays?: number;
    count?: number;
  };
}

// ---------------------------------------------------------------------------
// 1. Transaction Velocity Tab
// ---------------------------------------------------------------------------

function TransactionVelocityChart() {
  const intl = useIntl();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouseListForFilter"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["reportTransactionVelocity", year, warehouseId],
    queryFn: () =>
      trpcClient.report.transactionVelocity.query({ year, warehouseId }),
  });

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          variant="secondary"
          selectedKey={String(year)}
          onSelectionChange={(key) => {
            if (key) setYear(Number(key));
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {years.map((y) => (
                <ListBox.Item
                  key={String(y)}
                  id={String(y)}
                  textValue={String(y)}
                >
                  {String(y)}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          variant="secondary"
          selectedKey={warehouseId ?? "__all__"}
          onSelectionChange={(key) =>
            setWarehouseId(
              key === "__all__"
                ? undefined
                : (String(key) as string | undefined),
            )
          }
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item
                id="__all__"
                textValue={intl.formatMessage({
                  id: "report.velocity.all_warehouses",
                  defaultMessage: "All Warehouses",
                })}
              >
                {intl.formatMessage({
                  id: "report.velocity.all_warehouses",
                  defaultMessage: "All Warehouses",
                })}
              </ListBox.Item>
              {(warehouses?.data ?? []).map((w) => (
                <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                  {w.name}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex h-80 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart
              data={data?.months ?? []}
              margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-default-200"
              />
              <XAxis dataKey="label" className="text-xs text-muted" />
              <YAxis tickFormatter={formatQty} className="text-xs text-muted" />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const _p = payload as unknown as TooltipPayloadEntry[];
                  return (
                    <div className="rounded-lg border border-default-200 bg-background p-3 shadow-lg">
                      <p className="mb-1 text-sm font-semibold text-foreground">
                        {payload[0]?.payload?.label}
                      </p>
                      {_p.map((e, i) => (
                        <p
                          key={i}
                          className="text-xs"
                          style={{ color: e.color }}
                        >
                          {e.name}:{" "}
                          {typeof e.value === "number"
                            ? formatQty(e.value)
                            : e.value}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="#9ca3af" />
              <Bar
                dataKey="inbound"
                name={intl.formatMessage({
                  id: "report.velocity.inbound",
                  defaultMessage: "Inbound",
                })}
                fill="#10b981"
                stackId="a"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="outbound"
                name={intl.formatMessage({
                  id: "report.velocity.outbound",
                  defaultMessage: "Outbound",
                })}
                fill="#ef4444"
                stackId="b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          {data && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-success-soft p-3">
                <p className="text-xs text-muted">
                  {intl.formatMessage({
                    id: "report.velocity.total_inbound",
                    defaultMessage: "Total Inbound",
                  })}
                </p>
                <p className="text-lg font-bold text-success">
                  {formatQty(data.totals.inbound)}
                </p>
              </div>
              <div className="rounded-lg bg-danger-soft p-3">
                <p className="text-xs text-muted">
                  {intl.formatMessage({
                    id: "report.velocity.total_outbound",
                    defaultMessage: "Total Outbound",
                  })}
                </p>
                <p className="text-lg font-bold text-danger">
                  {formatQty(data.totals.outbound)}
                </p>
              </div>
              <div className="rounded-lg bg-default-soft p-3">
                <p className="text-xs text-muted">
                  {intl.formatMessage({
                    id: "report.velocity.avg_monthly_inbound",
                    defaultMessage: "Avg Inbound/Month",
                  })}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {formatQty(Math.round(data.totals.inbound / 12))}
                </p>
              </div>
              <div className="rounded-lg bg-default-soft p-3">
                <p className="text-xs text-muted">
                  {intl.formatMessage({
                    id: "report.velocity.avg_monthly_outbound",
                    defaultMessage: "Avg Outbound/Month",
                  })}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {formatQty(Math.round(data.totals.outbound / 12))}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. ABC Pareto Analysis Tab
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  RECEIVING: "#10b981",
  WIP_COMPLETION: "#6366f1",
  RMA_RECEIPT: "#f59e0b",
  FOUND: "#14b8a6",
  WIP_ISSUE: "#ef4444",
  SHIPMENT: "#f97316",
  RETURN_TO_SUPPLIER: "#8b5cf6",
  DISPOSAL: "#6b7280",
  LOSS: "#dc2626",
  SUBTX: "#3b82f6",
};

function AbcAnalysisChart() {
  const intl = useIntl();
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined);
  const [type, setType] = useState<string | undefined>(undefined);

  const { data: warehouses } = useQuery({
    queryKey: ["warehouseListForFilter"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["reportAbcAnalysis", warehouseId, type],
    queryFn: () =>
      trpcClient.report.abcAnalysis.query({ warehouseId, type: type as any }),
  });

  const chartData = (data?.items ?? []).slice(0, 30).map((item) => ({
    name: item.skuCode ?? item.skuId.slice(0, 6),
    fullName: item.skuName ?? "",
    value: item.value,
    cumulativePercent: item.cumulativePercent,
  }));

  const abcCounts = {
    A: data?.items.filter((i) => i.abcClass === "A").length ?? 0,
    B: data?.items.filter((i) => i.abcClass === "B").length ?? 0,
    C: data?.items.filter((i) => i.abcClass === "C").length ?? 0,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          variant="secondary"
          selectedKey={warehouseId ?? "__all__"}
          onSelectionChange={(key) =>
            setWarehouseId(
              key === "__all__"
                ? undefined
                : (String(key) as string | undefined),
            )
          }
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item
                id="__all__"
                textValue={intl.formatMessage({
                  id: "report.abc.all_warehouses",
                  defaultMessage: "All Warehouses",
                })}
              >
                {intl.formatMessage({
                  id: "report.abc.all_warehouses",
                  defaultMessage: "All Warehouses",
                })}
              </ListBox.Item>
              {(warehouses?.data ?? []).map((w) => (
                <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                  {w.name}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select
          variant="secondary"
          selectedKey={type ?? "__all__"}
          onSelectionChange={(key) =>
            setType(
              key === "__all__"
                ? undefined
                : (String(key) as string | undefined),
            )
          }
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item
                id="__all__"
                textValue={intl.formatMessage({
                  id: "report.abc.all_types",
                  defaultMessage: "All Types",
                })}
              >
                {intl.formatMessage({
                  id: "report.abc.all_types",
                  defaultMessage: "All Types",
                })}
              </ListBox.Item>
              <ListBox.Item id="RAW_MATERIAL" textValue="Raw Material">
                Raw Material
              </ListBox.Item>
              <ListBox.Item id="FINISHED_GOOD" textValue="Finished Good">
                Finished Good
              </ListBox.Item>
              <ListBox.Item
                id="PACKAGING_MATERIAL"
                textValue="Packaging Material"
              >
                Packaging Material
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-default-soft p-3">
            <p className="text-xs text-muted">
              {intl.formatMessage({
                id: "report.abc.total_value",
                defaultMessage: "Total Value",
              })}
            </p>
            <p className="text-lg font-bold text-foreground">
              {formatIdr(data.grandTotal)}
            </p>
          </div>
          <div className="rounded-lg bg-primary-soft p-3">
            <p className="text-xs text-muted">
              {intl.formatMessage({
                id: "report.abc.class_a",
                defaultMessage: "Class A (80%)",
              })}
            </p>
            <p className="text-lg font-bold text-primary">{abcCounts.A} SKUs</p>
          </div>
          <div className="rounded-lg bg-warning-soft p-3">
            <p className="text-xs text-muted">
              {intl.formatMessage({
                id: "report.abc.class_b",
                defaultMessage: "Class B (15%)",
              })}
            </p>
            <p className="text-lg font-bold text-warning">{abcCounts.B} SKUs</p>
          </div>
          <div className="rounded-lg bg-danger-soft p-3">
            <p className="text-xs text-muted">
              {intl.formatMessage({
                id: "report.abc.class_c",
                defaultMessage: "Class C (5%)",
              })}
            </p>
            <p className="text-lg font-bold text-danger">{abcCounts.C} SKUs</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-80 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 40, left: 40, bottom: 30 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-default-200"
              />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                fontSize={10}
                height={60}
                className="text-xs text-muted"
              />
              <YAxis
                yAxisId="left"
                tickFormatter={(v: number) => formatIdr(v)}
                className="text-xs text-muted"
                width={80}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
                className="text-xs text-muted"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload as unknown as TooltipPayloadEntry[];
                  return (
                    <div className="rounded-lg border border-default-200 bg-background p-3 shadow-lg">
                      <p className="mb-1 text-sm font-semibold text-foreground">
                        {p[0]?.payload?.fullName ?? p[0]?.payload?.name}
                      </p>
                      {p.map((e, i) => (
                        <p
                          key={i}
                          className="text-xs"
                          style={{ color: e.color }}
                        >
                          {e.name}:{" "}
                          {e.name === "cumulativePercent"
                            ? `${e.value}%`
                            : formatIdr(Number(e.value))}
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="value"
                name={intl.formatMessage({
                  id: "report.abc.bar_value",
                  defaultMessage: "Value",
                })}
                fill="#3b82f6"
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulativePercent"
                name={intl.formatMessage({
                  id: "report.abc.line_cumulative",
                  defaultMessage: "Cumulative %",
                })}
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-primary" /> Class A (≤80%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-warning" /> Class B (80-95%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-danger" /> Class C (&gt;95%)
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Approval Cycle Time Tab
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  RECEIVING: "Receiving",
  WIP_COMPLETION: "WIP Completion",
  RMA_RECEIPT: "RMA Receipt",
  FOUND: "Found",
  WIP_ISSUE: "WIP Issue",
  SHIPMENT: "Shipment",
  RETURN_TO_SUPPLIER: "Return to Supplier",
  DISPOSAL: "Disposal",
  LOSS: "Loss",
  SUBTX: "Subinventory Transfer",
};

function ApprovalCycleChart() {
  const intl = useIntl();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number | undefined>(currentYear);

  const { data, isLoading } = useQuery({
    queryKey: ["reportApprovalCycle", year],
    queryFn: () => trpcClient.report.approvalCycle.query({ year }),
  });

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const chartData = (data ?? []).map((item) => ({
    name: TYPE_LABELS[item.transactionType] ?? item.transactionType,
    avgDays: item.avgDays ?? 0,
    count: item.count,
    color: TYPE_COLORS[item.transactionType] ?? "#3b82f6",
  }));
  const avgOverall =
    chartData.length > 0
      ? Math.round(
          (chartData.reduce((s, i) => s + i.avgDays, 0) / chartData.length) *
            10,
        ) / 10
      : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          variant="secondary"
          selectedKey={year != null ? String(year) : "__all__"}
          onSelectionChange={(key) =>
            setYear(key === "__all__" ? undefined : Number(key))
          }
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item
                id="__all__"
                textValue={intl.formatMessage({
                  id: "report.approval_cycle.all_years",
                  defaultMessage: "All",
                })}
              >
                {intl.formatMessage({
                  id: "report.approval_cycle.all_years",
                  defaultMessage: "All",
                })}
              </ListBox.Item>
              {years.map((y) => (
                <ListBox.Item
                  key={String(y)}
                  id={String(y)}
                  textValue={String(y)}
                >
                  {String(y)}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <div className="rounded-lg bg-primary-soft px-3 py-1.5 text-center">
          <p className="text-xs text-muted">
            {intl.formatMessage({
              id: "report.approval_cycle.overall_avg",
              defaultMessage: "Overall Avg",
            })}
          </p>
          <p className="text-lg font-bold text-primary">{avgOverall}d</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-80 items-center justify-center">
          <Spinner />
        </div>
      ) : chartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          {intl.formatMessage({
            id: "report.approval_cycle.empty",
            defaultMessage: "No approved transactions found.",
          })}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={chartData.length * 50 + 60}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 140, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-default-200"
              horizontal={false}
            />
            <XAxis type="number" unit="d" className="text-xs text-muted" />
            <YAxis
              type="category"
              dataKey="name"
              className="text-xs text-foreground"
              width={130}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]?.payload as any;
                return (
                  <div className="rounded-lg border border-default-200 bg-background p-3 shadow-lg">
                    <p className="mb-1 text-sm font-semibold text-foreground">
                      {p?.name}
                    </p>
                    <p className="text-xs text-muted">
                      {intl.formatMessage(
                        {
                          id: "report.approval_cycle.tooltip_avg",
                          defaultMessage: "Avg: {days} days",
                        },
                        { days: p?.avgDays },
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {intl.formatMessage(
                        {
                          id: "report.approval_cycle.tooltip_count",
                          defaultMessage: "{count} transactions",
                        },
                        { count: p?.count },
                      )}
                    </p>
                  </div>
                );
              }}
            />
            <Legend />
            <Bar
              dataKey="avgDays"
              name={intl.formatMessage({
                id: "report.approval_cycle.bar_avg_days",
                defaultMessage: "Avg Days to Approve",
              })}
              radius={[0, 4, 4, 0]}
            >
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

function ReportsDashboardPage() {
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState("velocity");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <PageTitle
          title={intl.formatMessage({
            id: "report.charts.title",
            defaultMessage: "Reports & Analytics",
          })}
        />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {intl.formatMessage({
            id: "report.charts.title",
            defaultMessage: "Reports & Analytics",
          })}
        </h1>
        <p className="text-sm text-muted">
          {intl.formatMessage({
            id: "report.charts.description",
            defaultMessage:
              "Transactional and inventory analytics. Switch tabs to explore different perspectives.",
          })}
        </p>
      </header>

      <Card>
        <Card.Content>
          <Tabs
            variant="secondary"
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(String(key))}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Report charts">
                <Tabs.Tab id="velocity">
                  <Icon icon="solar:graph-up-linear" />
                  {intl.formatMessage({
                    id: "report.charts.tab_velocity",
                    defaultMessage: "Transaction Velocity",
                  })}
                </Tabs.Tab>
                <Tabs.Separator />
                <Tabs.Tab id="abc">
                  <Icon icon="solar:chart-linear" />
                  {intl.formatMessage({
                    id: "report.charts.tab_abc",
                    defaultMessage: "ABC Pareto",
                  })}
                </Tabs.Tab>
                <Tabs.Separator />
                <Tabs.Tab id="approval">
                  <Icon icon="solar:clock-circle-linear" />
                  {intl.formatMessage({
                    id: "report.charts.tab_approval",
                    defaultMessage: "Approval Cycle",
                  })}
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="velocity">
              <div className="pt-4">
                <TransactionVelocityChart />
              </div>
            </Tabs.Panel>
            <Tabs.Panel id="abc">
              <div className="pt-4">
                <AbcAnalysisChart />
              </div>
            </Tabs.Panel>
            <Tabs.Panel id="approval">
              <div className="pt-4">
                <ApprovalCycleChart />
              </div>
            </Tabs.Panel>
          </Tabs>
        </Card.Content>
      </Card>
    </div>
  );
}

export { ReportsDashboardPage };
