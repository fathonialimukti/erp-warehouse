import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Button, Dropdown, Separator } from "@heroui/react";
import { AppIcon } from "../../../components/AppIcon";
import { type ColumnDef } from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { trpcClient } from "../../../lib/trpc";
import { hasPermissionAtom } from "../../../lib/atoms";
import { DataTable } from "../../../components/DataTable";
import { useListPage } from "../../../lib/useListPage";
import {
  ApprovalStatusChip,
  STATUS_FILTER_ALL_VALUE,
  TableToolbar,
  TransactionDeleteModal,
} from "../../_transaction-shared";

interface ShipmentRow {
  id: string;
  documentNumber?: string | null;
  date: string;
  approvalStatus: string;
  recipient?: string | null;
  reference?: string | null;
  createdBy?: { name?: string | null } | null;
  approvedBy?: { name?: string | null } | null;
}

// Sortable column keys — must match SHIPMENT_SORTABLE_FIELDS on the server.
export const SORTABLE_COLUMNS = [
  "documentNumber",
  "date",
  "recipient",
  "approvalStatus",
] as const;
type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const ShipmentTable = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>(
    STATUS_FILTER_ALL_VALUE,
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission("shipment@create");
  const canUpdate = hasPermission("shipment@update");
  const canDelete = hasPermission("shipment@delete");

  const statusValue =
    statusFilter === STATUS_FILTER_ALL_VALUE
      ? undefined
      : (statusFilter as "DRAFT" | "PROPOSED" | "APPROVED" | "REJECTED");

  const columns = useMemo<ColumnDef<ShipmentRow>[]>(
    () => [
      {
        accessorKey: "documentNumber",
        header: intl.formatMessage({
          id: "shipment.col_document_number",
          defaultMessage: "Document Number",
        }),
        cell: ({ row }) => row.original.documentNumber ?? "-",
      },
      {
        accessorKey: "date",
        header: intl.formatMessage({
          id: "shipment.col_date",
          defaultMessage: "Date",
        }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date)),
      },
      {
        accessorKey: "recipient",
        header: intl.formatMessage({
          id: "shipment.col_recipient",
          defaultMessage: "Recipient",
        }),
        cell: ({ row }) => row.original.recipient ?? "-",
      },
      {
        accessorKey: "reference",
        enableSorting: false,
        header: intl.formatMessage({
          id: "shipment.col_reference",
          defaultMessage: "Reference",
        }),
        cell: ({ row }) => row.original.reference ?? "-",
      },
      {
        accessorKey: "approvalStatus",
        header: intl.formatMessage({
          id: "shipment.col_status",
          defaultMessage: "Status",
        }),
        cell: ({ row }) => (
          <ApprovalStatusChip status={row.original.approvalStatus} />
        ),
      },
      {
        accessorKey: "createdBy",
        enableSorting: false,
        header: intl.formatMessage({
          id: "shipment.col_created_by",
          defaultMessage: "Created By",
        }),
        cell: ({ row }) => row.original.createdBy?.name ?? "-",
      },
      {
        accessorKey: "approvedBy",
        enableSorting: false,
        header: intl.formatMessage({
          id: "shipment.col_approved_by",
          defaultMessage: "Approved By",
        }),
        cell: ({ row }) =>
          row.original.approvedBy?.name ??
          intl.formatMessage({
            id: "shipment.col_pending",
            defaultMessage: "Pending",
          }),
      },
      {
        id: "actions",
        enableSorting: false,
        header: "",
        cell: ({ row }) => (
          <Dropdown>
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label={intl.formatMessage({
                id: "shipment.actions_aria",
                defaultMessage: "Actions",
              })}
            >
              <AppIcon name="menu-dots" className="size-4" />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label={intl.formatMessage({
                  id: "shipment.actions_menu_aria",
                  defaultMessage: "Shipment actions",
                })}
              >
                <Dropdown.Item
                  onPress={() =>
                    navigate(
                      `/outbound-transaction/shipment/${row.original.id}`,
                    )
                  }
                >
                  <AppIcon name="eye" className="size-4" />
                  {intl.formatMessage({
                    id: "shipment.action_detail",
                    defaultMessage: "Detail",
                  })}
                </Dropdown.Item>
                {canUpdate &&
                ["DRAFT", "REJECTED"].includes(row.original.approvalStatus) ? (
                  <Dropdown.Item
                    onPress={() =>
                      navigate(
                        `/outbound-transaction/shipment/${row.original.id}/edit`,
                      )
                    }
                  >
                    <AppIcon name="pen" className="size-4" />
                    {intl.formatMessage({
                      id: "shipment.action_edit",
                      defaultMessage: "Edit",
                    })}
                  </Dropdown.Item>
                ) : null}
                {canDelete &&
                ["DRAFT", "REJECTED"].includes(row.original.approvalStatus) ? (
                  <>
                    <Separator />
                    <Dropdown.Item
                      variant="danger"
                      onPress={() => {
                        setDeletingRowId(row.original.id);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <AppIcon name="trash" className="size-4" />
                      {intl.formatMessage({
                        id: "shipment.action_delete",
                        defaultMessage: "Delete",
                      })}
                    </Dropdown.Item>
                  </>
                ) : null}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [navigate, intl, canUpdate, canDelete],
  );

  const list = useListPage<ShipmentRow>({
    queryKey: ["shipmentList"],
    initialSorting: [{ id: "date", desc: true }],
    queryFn: (input) =>
      trpcClient.shipment.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
        sortBy: input.sortBy as SortableColumn | undefined,
        sortOrder: input.sortOrder,
        approvalStatus: statusValue,
      }),
    columns,
    resetDeps: [statusFilter],
  });

  const rows = list.query.data?.data ?? [];

  const handleDelete = async () => {
    if (!deletingRowId || isDeleting) return;
    setIsDeleting(true);
    try {
      await trpcClient.shipment.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ["shipmentList"] });
      setDeleteModalOpen(false);
      setDeletingRowId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: "shipment-list",
        totalRecords: list.totalEntries,
        currentPage: list.currentPage,
        totalPages: list.totalPages,
        visibleRows: rows.map((row) => ({
          id: row.id,
          documentNumber: row.documentNumber,
          recipient: row.recipient,
          status: row.approvalStatus,
        })),
      })}
    >
      <TableToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder={intl.formatMessage({
          id: "shipment.search_placeholder",
          defaultMessage: "Search by ID, recipient...",
        })}
        createLabel={intl.formatMessage({
          id: "shipment.create_button",
          defaultMessage: "Create",
        })}
        onCreate={
          canCreate
            ? () => navigate("/outbound-transaction/shipment/new")
            : undefined
        }
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterAriaLabel={intl.formatMessage({
          id: "shipment.filter_status_aria",
          defaultMessage: "Filter by approval status",
        })}
      />
      <DataTable<ShipmentRow>
        table={list.table}
        columns={columns}
        isLoading={list.isLoading || list.isFetching}
        error={
          list.query.isError
            ? {
                message: intl.formatMessage({
                  id: "shipment.error_load",
                  defaultMessage: "Failed to load shipments.",
                }),
                onRetry: () => void list.query.refetch(),
              }
            : undefined
        }
        enableSorting
        emptyState={{
          icon: "arrow-up",
          message: intl.formatMessage({
            id: "shipment.empty_state",
            defaultMessage: "No shipments found.",
          }),
        }}
        loadingMessage={intl.formatMessage({
          id: "shipment.loading",
          defaultMessage: "Loading shipments...",
        })}
        ariaLabel={intl.formatMessage({
          id: "shipment.table_aria",
          defaultMessage: "Shipments",
        })}
        rowHeaderId="documentNumber"
        onRowAction={(id) => navigate(`/outbound-transaction/shipment/${id}`)}
        totalEntries={list.totalEntries}
        pageStart={list.pageStart}
        pageEnd={list.pageEnd}
      />
      <TransactionDeleteModal
        title={intl.formatMessage({
          id: "shipment.delete_modal_title",
          defaultMessage: "Delete Shipment",
        })}
        body={intl.formatMessage({
          id: "shipment.delete_modal_body",
          defaultMessage: "Are you sure you want to delete this shipment?",
        })}
        confirmLabel={intl.formatMessage({
          id: "shipment.delete_confirm",
          defaultMessage: "Delete",
        })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) setDeletingRowId(null);
        }}
      />
    </section>
  );
};
