import { useState } from "react";
import { useIntl } from "react-intl";
import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { Card, Label, TextField } from "@heroui/react";
import { useNavigate } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { hasPermissionAtom } from "../../lib/atoms";
import { trpcClient } from "../../lib/trpc";

interface ExpiryItem {
  id: string;
  palletNumber: string | null;
  lotNo: string | null;
  expiryDate: string | null;
  daysToExpiry: number | null;
  bucket: string;
  skuName: string;
  skuCode: string | null;
  warehouseName: string;
}

const BUCKET_COLORS: Record<string, string> = {
  expired: "text-danger font-semibold",
  within_30: "text-danger",
  within_60: "text-warning",
  within_90: "text-warning",
  later: "text-success",
};

export function ExpiryReportPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canRead = hasPermission("stock-movement@read");
  const [warehouseId, setWarehouseId] = useState("");

  const { data: warehouses } = useQuery({
    queryKey: ["warehouseListForFilter"],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["expiryReport", warehouseId],
    enabled: canRead,
    queryFn: () =>
      trpcClient.report.expiry.query({ warehouseId: warehouseId || undefined }),
  });

  if (!canRead) {
    return (
      <Card>
        <Card.Content>
          <p className="text-sm text-danger">
            {intl.formatMessage({
              id: "report.expiry.permission_denied",
              defaultMessage: "You do not have permission to view this report.",
            })}
          </p>
        </Card.Content>
      </Card>
    );
  }

  const summary = data?.summary;

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({ section: "expiry-report" })}
    >
      <PageHeader
        title={intl.formatMessage({
          id: "report.expiry.title",
          defaultMessage: "Expiry Report",
        })}
        onBack={() => navigate("/reports/charts")}
      />

      {summary ? (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-1.5">
            {intl.formatMessage({
              id: "report.expiry.expired",
              defaultMessage: "Expired",
            })}
            : <strong>{summary.expired}</strong>
          </span>
          <span className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-1.5">
            {intl.formatMessage({
              id: "report.expiry.within_30",
              defaultMessage: "≤ 30 days",
            })}
            : <strong>{summary.within30}</strong>
          </span>
          <span className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-1.5">
            {intl.formatMessage({
              id: "report.expiry.within_60",
              defaultMessage: "≤ 60 days",
            })}
            : <strong>{summary.within60}</strong>
          </span>
          <span className="rounded-xl border px-3 py-1.5">
            {intl.formatMessage({
              id: "report.expiry.within_90",
              defaultMessage: "≤ 90 days",
            })}
            : <strong>{summary.within90}</strong>
          </span>
        </div>
      ) : null}

      <Card>
        <Card.Content>
          <div className="mb-4 max-w-48">
            <TextField
              fullWidth
              name="warehouse-filter"
              value={warehouseId}
              onChange={setWarehouseId}
            >
              <Label>
                {intl.formatMessage({
                  id: "reorder.filter_warehouse",
                  defaultMessage: "Warehouse",
                })}
              </Label>
              <select
                className="w-full rounded-xl border bg-content1 px-3 py-2 text-sm"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                aria-label={intl.formatMessage({
                  id: "reorder.filter_warehouse",
                  defaultMessage: "Warehouse",
                })}
              >
                <option value="">
                  {intl.formatMessage({
                    id: "reorder.filter_all_warehouses",
                    defaultMessage: "All warehouses",
                  })}
                </option>
                {(warehouses?.data ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </TextField>
          </div>

          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              aria-label={intl.formatMessage({
                id: "report.expiry.table_aria",
                defaultMessage: "Expiring pallets",
              })}
            >
              <thead>
                <tr className="border-b text-left text-xs text-muted">
                  <th className="px-3 py-2">
                    {intl.formatMessage({
                      id: "stock_count.column_pallet",
                      defaultMessage: "Pallet",
                    })}
                  </th>
                  <th className="px-3 py-2">
                    {intl.formatMessage({
                      id: "po.field_sku",
                      defaultMessage: "SKU",
                    })}
                  </th>
                  <th className="px-3 py-2">
                    {intl.formatMessage({
                      id: "reorder.column_warehouse",
                      defaultMessage: "Warehouse",
                    })}
                  </th>
                  <th className="px-3 py-2">
                    {intl.formatMessage({
                      id: "report.expiry.lot",
                      defaultMessage: "Lot",
                    })}
                  </th>
                  <th className="px-3 py-2">
                    {intl.formatMessage({
                      id: "report.expiry.expiry_date",
                      defaultMessage: "Expiry",
                    })}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {intl.formatMessage({
                      id: "report.expiry.days_left",
                      defaultMessage: "Days left",
                    })}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-muted"
                    >
                      {intl.formatMessage({
                        id: "common.loading",
                        defaultMessage: "Loading…",
                      })}
                    </td>
                  </tr>
                ) : (data?.items ?? []).length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-muted"
                    >
                      {intl.formatMessage({
                        id: "report.expiry.empty",
                        defaultMessage: "No pallets with expiry dates.",
                      })}
                    </td>
                  </tr>
                ) : (
                  (data?.items ?? []).map((item: ExpiryItem) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-3 py-2 font-mono text-xs">
                        {item.palletNumber ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <p>{item.skuName}</p>
                        <p className="font-mono text-xs text-muted">
                          {item.skuCode ?? ""}
                        </p>
                      </td>
                      <td className="px-3 py-2">{item.warehouseName}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {item.lotNo ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {item.expiryDate
                          ? new Date(item.expiryDate).toLocaleDateString()
                          : "—"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${BUCKET_COLORS[item.bucket] ?? ""}`}
                      >
                        {item.daysToExpiry ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}
