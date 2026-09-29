import { useState } from "react";
import { useIntl } from "react-intl";
import { useQuery } from "@tanstack/react-query";
import { Card, ListBox, Select, Spinner } from "@heroui/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { trpcClient } from "../../lib/trpc";

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

function ApprovalCyclePage() {
  const intl = useIntl();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number | undefined>(currentYear);

  const { data, isLoading } = useQuery({
    queryKey: ["reportApprovalCycle", year],
    queryFn: () => trpcClient.report.approvalCycle.query({ year }),
  });

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const chartData =
    data?.map((item) => ({
      name: TYPE_LABELS[item.transactionType] ?? item.transactionType,
      avgDays: item.avgDays ?? 0,
      count: item.count,
      color: TYPE_COLORS[item.transactionType] ?? "#3b82f6",
    })) ?? [];

  const avgOverall =
    chartData.length > 0
      ? Math.round(
          (chartData.reduce((s, i) => s + i.avgDays, 0) / chartData.length) *
            10,
        ) / 10
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {intl.formatMessage({
            id: "report.approval_cycle.title",
            defaultMessage: "Approval Cycle Time",
          })}
        </h1>
        <p className="text-sm text-muted">
          {intl.formatMessage({
            id: "report.approval_cycle.description",
            defaultMessage:
              "Average days from created to approved per transaction type. Longer bars = approval bottleneck.",
          })}
        </p>
      </header>

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
      </div>

      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <div>
              <Card.Title>
                {intl.formatMessage({
                  id: "report.approval_cycle.chart_title",
                  defaultMessage: "Average Days to Approve",
                })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({
                  id: "report.approval_cycle.chart_subtitle",
                  defaultMessage:
                    "Horizontal bars. Color intensity = urgency (red = slowest).",
                })}
              </Card.Description>
            </div>
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
        </Card.Header>
        <Card.Content>
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
            <ResponsiveContainer
              width="100%"
              height={chartData.length * 50 + 60}
            >
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
                    const p = payload[0]?.payload;
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
        </Card.Content>
      </Card>
    </div>
  );
}

export { ApprovalCyclePage };
