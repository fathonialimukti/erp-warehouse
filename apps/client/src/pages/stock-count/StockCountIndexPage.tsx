import { useIntl } from "react-intl";
import { useAtomValue } from "jotai";

import { Button, Card } from "@heroui/react";
import { AppIcon } from "../../components/AppIcon";
import { useNavigate } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { hasPermissionAtom } from "../../lib/atoms";
import { trpcClient } from "../../lib/trpc";
import { useListPage } from "../../lib/useListPage";
import type { ColumnDef } from "@tanstack/react-table";

interface StockCountRow {
  id: string;
  documentNumber: string | null;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  isBlindCount: boolean;
  warehouse: { id: string; code: string | null; name: string };
  createdBy: { id: string; name: string | null; email: string };
  createdAt: string;
  totalLines: number;
  countedLines: number;
  varianceLines: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-default-500",
  IN_PROGRESS: "text-warning",
  COMPLETED: "text-success",
  CANCELLED: "text-danger",
};

export function StockCountIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canRead = hasPermission("stock_count@read");
  const canCreate = hasPermission("stock_count@create");

  const columns: ColumnDef<StockCountRow>[] = [
    {
      id: "documentNumber",
      header: intl.formatMessage({
        id: "stock_count.column_document",
        defaultMessage: "Document",
      }),
      cell: ({ row }) => (
        <div>
          <p className="font-mono text-sm font-semibold">
            {row.original.documentNumber ?? row.original.id}
          </p>
          <p className="text-xs text-muted">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      id: "warehouse",
      header: intl.formatMessage({
        id: "stock_count.column_warehouse",
        defaultMessage: "Warehouse",
      }),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.warehouse.name}</span>
      ),
    },
    {
      id: "status",
      header: intl.formatMessage({
        id: "stock_count.column_status",
        defaultMessage: "Status",
      }),
      cell: ({ row }) => (
        <span
          className={`font-mono text-xs font-semibold ${STATUS_COLORS[row.original.status]}`}
        >
          {row.original.status}
        </span>
      ),
    },
    {
      id: "progress",
      header: intl.formatMessage({
        id: "stock_count.column_progress",
        defaultMessage: "Progress",
      }),
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.countedLines}/{row.original.totalLines}
          {row.original.varianceLines > 0 ? (
            <span className="ml-2 font-semibold text-danger">
              ({row.original.varianceLines} var)
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: "blind",
      header: intl.formatMessage({
        id: "stock_count.column_blind",
        defaultMessage: "Blind count",
      }),
      cell: ({ row }) => (
        <AppIcon
          name={row.original.isBlindCount ? "eye-off" : "eye"}
          className="size-4 text-muted"
          aria-label={String(row.original.isBlindCount)}
        />
      ),
    },
  ];

  const list = useListPage<StockCountRow>({
    queryKey: ["stockCountList"],
    queryFn: async (input) => {
      const result = await trpcClient.stockCount.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search || undefined,
      });
      return { data: result.data as StockCountRow[], meta: result.pagination };
    },
    columns,
  });

  if (!canRead) {
    return (
      <Card>
        <Card.Content>
          <p className="text-sm text-danger">
            {intl.formatMessage({
              id: "stock_count.permission_denied",
              defaultMessage:
                "You do not have permission to view stock counts.",
            })}
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({ section: "stock-count-list" })}
    >
      <PageHeader
        title={intl.formatMessage({
          id: "stock_count.title",
          defaultMessage: "Cycle Count (Stock Opname)",
        })}
        onBack={() => window.history.back()}
      >
        {canCreate ? (
          <Button
            variant="primary"
            onPress={() => navigate("/stock-count/new")}
          >
            <AppIcon name="plus" />
            {intl.formatMessage({
              id: "stock_count.new",
              defaultMessage: "New Count",
            })}
          </Button>
        ) : null}
      </PageHeader>

      <Card>
        <Card.Content>
          <div className="mb-4 max-w-xs">
            <input
              className="w-full rounded-xl border bg-content1 px-3 py-2 text-sm"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              placeholder={intl.formatMessage({
                id: "stock_count.search_placeholder",
                defaultMessage: "Search document number…",
              })}
              aria-label={intl.formatMessage({
                id: "stock_count.search_placeholder",
                defaultMessage: "Search document number",
              })}
            />
          </div>

          <DataTable
            table={list.table}
            columns={columns}
            isLoading={list.isLoading}
            error={
              list.query.isError
                ? {
                    message: intl.formatMessage({
                      id: "stock_count.error_load",
                      defaultMessage: "Failed to load stock counts.",
                    }),
                    onRetry: () => void list.query.refetch(),
                  }
                : undefined
            }
            emptyState={{
              icon: "clipboard-list",
              message: intl.formatMessage({
                id: "stock_count.empty",
                defaultMessage: "No stock counts yet.",
              }),
            }}
            loadingMessage={intl.formatMessage({
              id: "common.loading",
              defaultMessage: "Loading…",
            })}
            ariaLabel={intl.formatMessage({
              id: "stock_count.table_aria",
              defaultMessage: "Stock counts",
            })}
            rowHeaderId="documentNumber"
            onRowAction={(id) => navigate(`/stock-count/${id}`)}
            totalEntries={list.totalEntries}
            pageStart={list.pageStart}
            pageEnd={list.pageEnd}
          />
        </Card.Content>
      </Card>
    </section>
  );
}
