import { useState, useMemo } from "react";
import { useIntl } from "react-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, ListBox, Select, Spinner } from "@heroui/react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { trpcClient } from "../../lib/trpc";

const IDR_FORMAT = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const formatIdr = (n: number) => IDR_FORMAT.format(n);

interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
  name?: string;
  color?: string;
  payload?: { skuName?: string; skuCode?: string; value?: number };
}

function AbcAnalysisPage() {
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
      trpcClient.report.abcAnalysis.query({
        warehouseId,
        type: type as
          "RAW_MATERIAL" | "FINISHED_GOOD" | "PACKAGING_MATERIAL" | undefined,
      }),
  });

  // Show top 30 SKUs for the chart (rest would be too crowded)
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.items.slice(0, 30).map((item) => ({
      name: item.skuCode ?? item.skuId.slice(0, 6),
      fullName: item.skuName,
      value: item.value,
      cumulativePercent: item.cumulativePercent,
      abcClass: item.abcClass,
    }));
  }, [data]);

  const abcCounts = useMemo(() => {
    if (!data) return { A: 0, B: 0, C: 0 };
    return {
      A: data.items.filter((i) => i.abcClass === "A").length,
      B: data.items.filter((i) => i.abcClass === "B").length,
      C: data.items.filter((i) => i.abcClass === "C").length,
    };
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {intl.formatMessage({
            id: "report.abc.title",
            defaultMessage: "ABC Pareto Analysis",
          })}
        </h1>
        <p className="text-sm text-muted">
          {intl.formatMessage({
            id: "report.abc.description",
            defaultMessage:
              "SKUs ranked by inventory value. Class A = top 80%, B = next 15%, C = bottom 5%. Focus management on Class A items.",
          })}
        </p>
      </header>

      {/* Filters */}
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

      {/* KPI cards */}
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

      <Card>
        <Card.Header>
          <div>
            <Card.Title>
              {intl.formatMessage({
                id: "report.abc.chart_title",
                defaultMessage: "SKU Value Ranking (Top 30)",
              })}
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({
                id: "report.abc.chart_subtitle",
                defaultMessage:
                  "Bars = individual SKU value. Blue line = cumulative % of total value.",
              })}
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content>
          {isLoading ? (
            <div className="flex h-80 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
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
                    const skuName = p[0]?.payload?.skuName ?? "";
                    return (
                      <div className="rounded-lg border border-default-200 bg-background p-3 shadow-lg">
                        <p className="mb-1 text-sm font-semibold text-foreground">
                          {skuName}
                        </p>
                        {p.map((entry, i) => (
                          <p
                            key={i}
                            className="text-xs"
                            style={{ color: entry.color }}
                          >
                            {entry.name}:{" "}
                            {entry.name === "cumulativePercent"
                              ? `${entry.value}%`
                              : formatIdr(Number(entry.value))}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                {/* Pareto reference lines */}
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
          )}

          {/* ABC legend */}
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
        </Card.Content>
      </Card>
    </div>
  );
}

export { AbcAnalysisPage };
