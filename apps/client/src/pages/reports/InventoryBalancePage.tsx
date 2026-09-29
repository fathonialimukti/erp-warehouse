import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, Chip, ListBox, Select, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  Area,
} from "recharts";
import { trpcClient } from "../../lib/trpc";
import { PageTitle } from "../../components/PageTitle";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

interface MonthData {
  month: number;
  openingQty: number;
  totalInbound: number;
  totalOutbound: number;
  closingQty: number;
}

interface BalanceResult {
  year: number;
  months: MonthData[];
  totals: {
    openingQty: number;
    totalInbound: number;
    totalOutbound: number;
    closingQty: number;
  };
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <Card.Content className="py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          {label}
        </p>
        <p className={`mt-2 text-2xl font-semibold tracking-tight ${color}`}>
          {value}
        </p>
      </Card.Content>
    </Card>
  );
}

function InventoryBalancePage() {
  const intl = useIntl();
  const [year, setYear] = useState(currentYear);
  const [warehouseId, setWarehouseId] = useState<string | null>(null);

  const { data: warehouseData } = useQuery({
    queryKey: ["warehouseListForReport"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const balanceQuery = useQuery<BalanceResult>({
    queryKey: ["report", "inventoryBalance", year, warehouseId],
    queryFn: () =>
      trpcClient.report.inventoryBalanceMonthly.query({
        year,
        warehouseId: warehouseId ?? undefined,
      }),
    staleTime: 2 * 60 * 1000,
  });

  const warehouses = useMemo(
    () =>
      (warehouseData as any)?.data?.map((w: any) => ({
        id: w.id,
        name: w.name,
      })) ?? [],
    [warehouseData],
  );

  const selectedWarehouseName = warehouses.find(
    (w: any) => w.id === warehouseId,
  )?.name;
  const isLoading = balanceQuery.isFetching;
  const result = balanceQuery.data;

  const chartData = useMemo(() => {
    if (!result?.months) return [];
    return result.months.map((m) => ({
      name: MONTH_NAMES[m.month - 1],
      month: m.month,
      Inbound: m.totalInbound,
      Outbound: -m.totalOutbound,
      opening: m.openingQty,
      closing: m.closingQty,
    }));
  }, [result]);

  return (
    <div className="space-y-5">
      <div>
        <PageTitle
          title={intl.formatMessage({
            id: "report.inventory_balance.title",
            defaultMessage: "Inventory Balance",
          })}
        />
        <h1 className="text-xl font-semibold">
          {intl.formatMessage({
            id: "report.inventory_balance.title",
            defaultMessage: "Inventory Balance",
          })}
        </h1>
        <p className="text-sm text-muted">
          {intl.formatMessage({
            id: "report.inventory_balance.description",
            defaultMessage:
              "Monthly inventory snapshot with inbound/outbound flows per warehouse.",
          })}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <Card.Header>
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

            <Select
              variant="secondary"
              selectedKey={warehouseId ?? "__ALL__"}
              onSelectionChange={(key) =>
                setWarehouseId(key === "__ALL__" ? null : String(key))
              }
            >
              <Select.Trigger>
                <Select.Value>
                  {({ defaultChildren }: any) =>
                    selectedWarehouseName ?? defaultChildren
                  }
                </Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="__ALL__" textValue="All Warehouses">
                    <span className="text-muted">All Warehouses</span>
                  </ListBox.Item>
                  {warehouses.map((w: any) => (
                    <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                      {w.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            {isLoading && <Spinner size="sm" />}
          </div>
        </Card.Header>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={intl.formatMessage({
            id: "report.inventory_balance.opening",
            defaultMessage: "Opening Stock",
          })}
          value={(result?.totals?.openingQty ?? 0).toLocaleString()}
          color="text-foreground"
        />
        <KpiCard
          label={intl.formatMessage({
            id: "report.inventory_balance.inbound",
            defaultMessage: "Total Inbound",
          })}
          value={(result?.totals?.totalInbound ?? 0).toLocaleString()}
          color="text-success"
        />
        <KpiCard
          label={intl.formatMessage({
            id: "report.inventory_balance.outbound",
            defaultMessage: "Total Outbound",
          })}
          value={(result?.totals?.totalOutbound ?? 0).toLocaleString()}
          color="text-danger"
        />
        <KpiCard
          label={intl.formatMessage({
            id: "report.inventory_balance.closing",
            defaultMessage: "Closing Stock",
          })}
          value={(result?.totals?.closingQty ?? 0).toLocaleString()}
          color="text-accent"
        />
      </div>

      {/* Chart */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Icon icon="solar:chart-2-linear" className="size-4 text-muted" />
            <span className="font-medium">
              {intl.formatMessage({
                id: "report.inventory_balance.chart_title",
                defaultMessage: "Monthly Flow",
              })}
            </span>
          </div>
        </Card.Header>
        <Card.Content>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <Icon
                icon="solar:chart-2-broken"
                className="size-12 text-muted"
              />
              <p className="text-sm text-muted">
                {intl.formatMessage({
                  id: "report.inventory_balance.empty",
                  defaultMessage: "No inventory balance data for this period.",
                })}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    Math.abs(Number(value ?? 0)).toLocaleString(),
                    name,
                  ]}
                  labelFormatter={(label: any) => String(label ?? "")}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="opening"
                  stroke="#94a3b8"
                  fill="#94a3b8"
                  fillOpacity={0.1}
                  name="Opening"
                />
                <Bar
                  dataKey="Inbound"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                  name="Inbound"
                />
                <Bar
                  dataKey="Outbound"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  name="Outbound"
                />
                <Line
                  type="monotone"
                  dataKey="closing"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Closing"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card.Content>
      </Card>

      {/* Summary Table */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <Icon
              icon="solar:list-check-linear"
              className="size-4 text-muted"
            />
            <span className="font-medium">
              {intl.formatMessage({
                id: "report.inventory_balance.table_title",
                defaultMessage: "Monthly Breakdown",
              })}
            </span>
          </div>
        </Card.Header>
        <Card.Content>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-2">
                    {intl.formatMessage({
                      id: "report.inventory_balance.col_month",
                      defaultMessage: "Month",
                    })}
                  </th>
                  <th className="px-4 py-2 text-right">
                    {intl.formatMessage({
                      id: "report.inventory_balance.col_opening",
                      defaultMessage: "Opening",
                    })}
                  </th>
                  <th className="px-4 py-2 text-right">
                    {intl.formatMessage({
                      id: "report.inventory_balance.col_inbound",
                      defaultMessage: "Inbound",
                    })}
                  </th>
                  <th className="px-4 py-2 text-right">
                    {intl.formatMessage({
                      id: "report.inventory_balance.col_outbound",
                      defaultMessage: "Outbound",
                    })}
                  </th>
                  <th className="px-4 py-2 text-right">
                    {intl.formatMessage({
                      id: "report.inventory_balance.col_closing",
                      defaultMessage: "Closing",
                    })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {result?.months?.map((m) => (
                  <tr
                    key={m.month}
                    className="border-b border-border/30 hover:bg-surface/50"
                  >
                    <td className="px-4 py-3 font-medium">
                      {MONTH_NAMES[m.month - 1]}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.openingQty.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.totalInbound > 0 ? (
                        <Chip color="success" size="sm" variant="soft">
                          {m.totalInbound.toLocaleString()}
                        </Chip>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {m.totalOutbound > 0 ? (
                        <Chip color="danger" size="sm" variant="soft">
                          {m.totalOutbound.toLocaleString()}
                        </Chip>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {m.closingQty.toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface/30 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(result?.totals?.openingQty ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-success">
                    {(result?.totals?.totalInbound ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-danger">
                    {(result?.totals?.totalOutbound ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-accent">
                    {(result?.totals?.closingQty ?? 0).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

export { InventoryBalancePage };
