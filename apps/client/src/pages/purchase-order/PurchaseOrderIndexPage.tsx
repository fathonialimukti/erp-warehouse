import { useIntl } from "react-intl";
import { useAtomValue } from "jotai";

import { Button, Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { DataTable } from "../../components/DataTable";
import { hasPermissionAtom } from "../../lib/atoms";
import { trpcClient } from "../../lib/trpc";
import { useListPage } from "../../lib/useListPage";
import type { ColumnDef } from "@tanstack/react-table";

interface PurchaseOrderRow {
  id: string;
  documentNumber: string | null;
  status: string;
  supplier: { id: string; code: string | null; name: string };
  warehouse: { id: string; code: string | null; name: string };
  expectedDate: string | null;
  createdAt: string;
  orderedQty: number;
  receivedQty: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "text-default-500",
  PROPOSED: "text-warning",
  APPROVED: "text-primary",
  REJECTED: "text-danger",
  RECEIVING: "text-warning",
  CLOSED: "text-success",
  CANCELLED: "text-default-500",
};

export function PurchaseOrderIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canRead = hasPermission("purchase_order@read");
  const canCreate = hasPermission("purchase_order@create");

  const columns: ColumnDef<PurchaseOrderRow>[] = [
    {
      id: "documentNumber",
      header: intl.formatMessage({
        id: "po.column_document",
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
      id: "supplier",
      header: intl.formatMessage({
        id: "po.column_supplier",
        defaultMessage: "Supplier",
      }),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.supplier.name}</span>
      ),
    },
    {
      id: "warehouse",
      header: intl.formatMessage({
        id: "po.column_warehouse",
        defaultMessage: "Warehouse",
      }),
      cell: ({ row }) => (
        <span className="text-sm">{row.original.warehouse.name}</span>
      ),
    },
    {
      id: "status",
      header: intl.formatMessage({
        id: "po.column_status",
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
        id: "po.column_received",
        defaultMessage: "Received / Ordered",
      }),
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.receivedQty} / {row.original.orderedQty}
        </span>
      ),
    },
  ];

  const list = useListPage<PurchaseOrderRow>({
    queryKey: ["purchaseOrderList"],
    queryFn: async (input) => {
      const result = await trpcClient.purchaseOrder.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search || undefined,
      });
      return {
        data: result.data as PurchaseOrderRow[],
        meta: result.pagination,
      };
    },
    columns,
  });

  if (!canRead) {
    return (
      <Card>
        <Card.Content>
          <p className="text-sm text-danger">
            {intl.formatMessage({
              id: "po.permission_denied",
              defaultMessage:
                "You do not have permission to view purchase orders.",
            })}
          </p>
        </Card.Content>
      </Card>
    );
  }

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({ section: "purchase-order-list" })}
    >
      <PageHeader
        title={intl.formatMessage({
          id: "po.title",
          defaultMessage: "Purchase Orders",
        })}
        onBack={() => window.history.back()}
      >
        {canCreate ? (
          <Button
            variant="primary"
            onPress={() => navigate("/purchase-order/new")}
          >
            <Icon icon="mdi:plus" />
            {intl.formatMessage({ id: "po.new", defaultMessage: "New Order" })}
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
                id: "po.search_placeholder",
                defaultMessage: "Search document number…",
              })}
              aria-label={intl.formatMessage({
                id: "po.search_placeholder",
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
                      id: "po.error_load",
                      defaultMessage: "Failed to load purchase orders.",
                    }),
                    onRetry: () => void list.query.refetch(),
                  }
                : undefined
            }
            emptyState={{
              icon: "solar:cart-linear",
              message: intl.formatMessage({
                id: "po.empty",
                defaultMessage: "No purchase orders yet.",
              }),
            }}
            loadingMessage={intl.formatMessage({
              id: "common.loading",
              defaultMessage: "Loading…",
            })}
            ariaLabel={intl.formatMessage({
              id: "po.table_aria",
              defaultMessage: "Purchase orders",
            })}
            rowHeaderId="documentNumber"
            onRowAction={(id) => navigate(`/purchase-order/${id}`)}
            totalEntries={list.totalEntries}
            pageStart={list.pageStart}
            pageEnd={list.pageEnd}
          />
        </Card.Content>
      </Card>
    </section>
  );
}
