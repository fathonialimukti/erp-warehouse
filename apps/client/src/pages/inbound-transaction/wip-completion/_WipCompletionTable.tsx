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

interface WipCompletionRow {
  id: string;
  documentNumber?: string | null;
  date: string;
  approvalStatus: string;
  createdBy?: { name?: string | null } | null;
  approvedBy?: { name?: string | null } | null;
}

export const WipCompletionTable = () => {
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
  const canUpdate = hasPermission("wip-completion@update");
  const canDelete = hasPermission("wip-completion@delete");

  const statusValue =
    statusFilter === STATUS_FILTER_ALL_VALUE
      ? undefined
      : (statusFilter as "DRAFT" | "PROPOSED" | "APPROVED" | "REJECTED");

  const columns = useMemo<ColumnDef<WipCompletionRow>[]>(
    () => [
      {
        accessorKey: "documentNumber",
        header: intl.formatMessage({
          id: "wip_completion.col_document_number",
          defaultMessage: "Document Number",
        }),
        cell: ({ row }) => row.original.documentNumber ?? "-",
      },
      {
        accessorKey: "date",
        header: intl.formatMessage({
          id: "wip_completion.col_date",
          defaultMessage: "Date",
        }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date)),
      },
      {
        accessorKey: "approvalStatus",
        header: intl.formatMessage({
          id: "wip_completion.col_status",
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
          id: "wip_completion.col_created_by",
          defaultMessage: "Created By",
        }),
        cell: ({ row }) => row.original.createdBy?.name ?? "-",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Dropdown>
            <Button size="sm" variant="ghost" isIconOnly aria-label="Actions">
              <AppIcon name="menu-dots" className="size-4" />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="WIP Completion actions">
                <Dropdown.Item
                  onPress={() =>
                    navigate(
                      `/inbound-transaction/wip-completion/${row.original.id}`,
                    )
                  }
                >
                  <AppIcon name="eye" className="size-4" />
                  {intl.formatMessage({
                    id: "wip_completion.action_detail",
                    defaultMessage: "Detail",
                  })}
                </Dropdown.Item>
                {canUpdate &&
                ["DRAFT", "REJECTED"].includes(row.original.approvalStatus) ? (
                  <Dropdown.Item
                    onPress={() =>
                      navigate(
                        `/inbound-transaction/wip-completion/${row.original.id}/edit`,
                      )
                    }
                  >
                    <AppIcon name="pen" className="size-4" />
                    {intl.formatMessage({
                      id: "wip_completion.action_edit",
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
                        id: "wip_completion.action_delete",
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

  const list = useListPage<WipCompletionRow>({
    queryKey: ["wipCompletionList"],
    initialSorting: [{ id: "date", desc: true }],
    queryFn: (input) =>
      trpcClient.wipCompletion.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
        sortBy: input.sortBy as
          "documentNumber" | "date" | "approvalStatus" | undefined,
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
      await trpcClient.wipCompletion.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ["wipCompletionList"] });
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
        section: "wip-completion-list",
        totalRecords: list.totalEntries,
        currentPage: list.currentPage,
        totalPages: list.totalPages,
        visibleRows: rows.map((row) => ({
          id: row.id,
          documentNumber: row.documentNumber,
          status: row.approvalStatus,
          createdBy: row.createdBy?.name ?? "Unknown",
        })),
      })}
    >
      <TableToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder={intl.formatMessage({
          id: "wip_completion.search_placeholder",
          defaultMessage: "Search...",
        })}
        createLabel={intl.formatMessage({
          id: "wip_completion.create_button",
          defaultMessage: "Create",
        })}
        onCreate={
          hasPermission("wip-completion@create")
            ? () => navigate("/inbound-transaction/wip-completion/new")
            : undefined
        }
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterAriaLabel={intl.formatMessage({
          id: "wip_completion.filter_status_aria",
          defaultMessage: "Filter by approval status",
        })}
      />
      <DataTable<WipCompletionRow>
        table={list.table}
        columns={columns}
        isLoading={list.isLoading || list.isFetching}
        error={
          list.query.isError
            ? {
                message: intl.formatMessage({
                  id: "wip_completion.error_load",
                  defaultMessage: "Failed to load WIP completions.",
                }),
                onRetry: () => void list.query.refetch(),
              }
            : undefined
        }
        enableSorting
        emptyState={{
          icon: "layers",
          message: intl.formatMessage({
            id: "wip_completion.empty_state",
            defaultMessage: "No WIP completions found.",
          }),
        }}
        loadingMessage={intl.formatMessage({
          id: "wip_completion.loading",
          defaultMessage: "Loading...",
        })}
        ariaLabel="WIP Completions"
        rowHeaderId="documentNumber"
        onRowAction={(id) =>
          navigate(`/inbound-transaction/wip-completion/${id}`)
        }
        totalEntries={list.totalEntries}
        pageStart={list.pageStart}
        pageEnd={list.pageEnd}
      />
      <TransactionDeleteModal
        body={intl.formatMessage({
          id: "wip_completion.delete_modal_body",
          defaultMessage: "Are you sure you want to delete this record?",
        })}
        confirmLabel={intl.formatMessage({
          id: "wip_completion.delete_confirm",
          defaultMessage: "Delete",
        })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => {
          setDeleteModalOpen(open);
          if (!open) setDeletingRowId(null);
        }}
        title={intl.formatMessage({
          id: "wip_completion.delete_modal_title",
          defaultMessage: "Delete WIP completions",
        })}
      />
    </section>
  );
};
