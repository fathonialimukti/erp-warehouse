import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Button, Dropdown, Separator } from "@heroui/react";
import { Icon } from "@iconify/react";
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

interface DisposalRow {
  id: string;
  documentNumber?: string | null;
  date: string;
  approvalStatus: string;
  createdBy?: { name?: string | null } | null;
  approvedBy?: { name?: string | null } | null;
}

// Sortable column keys — must match DISPOSAL_SORTABLE_FIELDS on the server.
export const SORTABLE_COLUMNS = [
  "documentNumber",
  "date",
  "approvalStatus",
] as const;
type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const DisposalTable = () => {
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
  const canCreate = hasPermission("disposal@create");
  const canUpdate = hasPermission("disposal@update");
  const canDelete = hasPermission("disposal@delete");

  const statusValue =
    statusFilter === STATUS_FILTER_ALL_VALUE
      ? undefined
      : (statusFilter as "DRAFT" | "PROPOSED" | "APPROVED" | "REJECTED");

  const columns = useMemo<ColumnDef<DisposalRow>[]>(
    () => [
      {
        accessorKey: "documentNumber",
        header: intl.formatMessage({
          id: "disposal.col_document_number",
          defaultMessage: "Document Number",
        }),
        cell: ({ row }) => row.original.documentNumber ?? "-",
      },
      {
        accessorKey: "date",
        header: intl.formatMessage({
          id: "disposal.col_date",
          defaultMessage: "Date",
        }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date)),
      },
      {
        accessorKey: "approvalStatus",
        header: intl.formatMessage({
          id: "disposal.col_status",
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
          id: "disposal.col_created_by",
          defaultMessage: "Created By",
        }),
        cell: ({ row }) => row.original.createdBy?.name ?? "-",
      },
      {
        accessorKey: "approvedBy",
        enableSorting: false,
        header: intl.formatMessage({
          id: "disposal.col_approved_by",
          defaultMessage: "Approved By",
        }),
        cell: ({ row }) =>
          row.original.approvedBy?.name ??
          intl.formatMessage({
            id: "disposal.col_pending",
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
                id: "disposal.actions_aria",
                defaultMessage: "Actions",
              })}
            >
              <Icon icon="solar:menu-dots-bold" className="size-4" />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label={intl.formatMessage({
                  id: "disposal.actions_menu_aria",
                  defaultMessage: "Disposal actions",
                })}
              >
                <Dropdown.Item
                  onPress={() =>
                    navigate(
                      `/outbound-transaction/disposal/${row.original.id}`,
                    )
                  }
                >
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({
                    id: "disposal.action_detail",
                    defaultMessage: "Detail",
                  })}
                </Dropdown.Item>
                {canUpdate &&
                ["DRAFT", "REJECTED"].includes(row.original.approvalStatus) ? (
                  <Dropdown.Item
                    onPress={() =>
                      navigate(
                        `/outbound-transaction/disposal/${row.original.id}/edit`,
                      )
                    }
                  >
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({
                      id: "disposal.action_edit",
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
                      <Icon
                        icon="solar:trash-bin-trash-linear"
                        className="size-4"
                      />
                      {intl.formatMessage({
                        id: "disposal.action_delete",
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

  const list = useListPage<DisposalRow>({
    queryKey: ["disposalList"],
    initialSorting: [{ id: "date", desc: true }],
    queryFn: (input) =>
      trpcClient.disposal.list.query({
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
      await trpcClient.disposal.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ["disposalList"] });
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
        section: "disposal-list",
        totalRecords: list.totalEntries,
        currentPage: list.currentPage,
        totalPages: list.totalPages,
        visibleRows: rows.map((row) => ({
          id: row.id,
          documentNumber: row.documentNumber,
          status: row.approvalStatus,
        })),
      })}
    >
      <TableToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder={intl.formatMessage({
          id: "disposal.search_placeholder",
          defaultMessage: "Search...",
        })}
        createLabel={intl.formatMessage({
          id: "disposal.create_button",
          defaultMessage: "Create",
        })}
        onCreate={
          canCreate
            ? () => navigate("/outbound-transaction/disposal/new")
            : undefined
        }
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterAriaLabel={intl.formatMessage({
          id: "disposal.filter_status_aria",
          defaultMessage: "Filter by approval status",
        })}
      />
      <DataTable<DisposalRow>
        table={list.table}
        columns={columns}
        isLoading={list.isLoading || list.isFetching}
        error={
          list.query.isError
            ? {
                message: intl.formatMessage({
                  id: "disposal.error_load",
                  defaultMessage: "Failed to load disposal records.",
                }),
                onRetry: () => void list.query.refetch(),
              }
            : undefined
        }
        enableSorting
        emptyState={{
          icon: "solar:trash-bin-trash-linear",
          message: intl.formatMessage({
            id: "disposal.empty_state",
            defaultMessage: "No disposal records found.",
          }),
        }}
        loadingMessage={intl.formatMessage({
          id: "disposal.loading",
          defaultMessage: "Loading...",
        })}
        ariaLabel={intl.formatMessage({
          id: "disposal.table_aria",
          defaultMessage: "Disposals",
        })}
        rowHeaderId="documentNumber"
        onRowAction={(id) => navigate(`/outbound-transaction/disposal/${id}`)}
        totalEntries={list.totalEntries}
        pageStart={list.pageStart}
        pageEnd={list.pageEnd}
      />
      <TransactionDeleteModal
        title={intl.formatMessage({
          id: "disposal.delete_modal_title",
          defaultMessage: "Delete disposal records",
        })}
        body={intl.formatMessage(
          {
            id: "disposal.delete_modal_body",
            defaultMessage: "Are you sure you want to delete this record?",
          },
          { id: deletingRowId ?? "" },
        )}
        confirmLabel={intl.formatMessage({
          id: "disposal.delete_confirm",
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
