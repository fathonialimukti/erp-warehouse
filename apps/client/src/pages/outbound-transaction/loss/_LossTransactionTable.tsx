import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Dropdown, Separator } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { DataTable } from '../../../components/DataTable';
import { useListPage } from '../../../lib/useListPage';
import {
  ApprovalStatusChip,
  STATUS_FILTER_ALL_VALUE,
  TableToolbar,
  TransactionDeleteModal,
} from '../../_transaction-shared';

interface LossTransactionRow {
  id: string;
  documentNumber?: string | null;
  date: string;
  approvalStatus: string;
  createdBy?: { name?: string | null } | null;
  approvedBy?: { name?: string | null } | null;
}

// Sortable column keys — must match LOSS_SORTABLE_FIELDS on the server.
const SORTABLE_COLUMNS = ['documentNumber', 'date', 'approvalStatus'] as const;
type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

export const LossTransactionTable = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL_VALUE);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('loss@create');
  const canUpdate = hasPermission('loss@update');
  const canDelete = hasPermission('loss@delete');

  const statusValue = statusFilter === STATUS_FILTER_ALL_VALUE ? undefined : (statusFilter as 'DRAFT' | 'PROPOSED' | 'APPROVED' | 'REJECTED');

  const columns = useMemo<ColumnDef<LossTransactionRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: intl.formatMessage({ id: 'loss_transaction.col_document_number', defaultMessage: 'Document Number' }),
        cell: ({ row }) => row.original.documentNumber ?? '-',
      },
      {
        accessorKey: 'date',
        header: intl.formatMessage({ id: 'loss_transaction.col_date', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date)),
      },
      {
        accessorKey: 'approvalStatus',
        header: intl.formatMessage({ id: 'loss_transaction.col_status', defaultMessage: 'Status' }),
        cell: ({ row }) => <ApprovalStatusChip status={row.original.approvalStatus} />,
      },
      {
        accessorKey: 'createdBy',
        enableSorting: false,
        header: intl.formatMessage({ id: 'loss_transaction.col_created_by', defaultMessage: 'Created By' }),
        cell: ({ row }) => row.original.createdBy?.name ?? '-',
      },
      {
        accessorKey: 'approvedBy',
        enableSorting: false,
        header: intl.formatMessage({ id: 'loss_transaction.col_approved_by', defaultMessage: 'Approved By' }),
        cell: ({ row }) => row.original.approvedBy?.name ?? intl.formatMessage({ id: 'loss_transaction.col_pending', defaultMessage: 'Pending' }),
      },
      {
        id: 'actions',
        enableSorting: false,
        header: '',
        cell: ({ row }) => (
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="ghost" isIconOnly aria-label={intl.formatMessage({ id: 'loss_transaction.actions_aria', defaultMessage: 'Actions' })}>
                <Icon icon="solar:menu-dots-bold" className="size-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label={intl.formatMessage({ id: 'loss_transaction.actions_menu_aria', defaultMessage: 'Loss transaction actions' })}>
                <Dropdown.Item onPress={() => navigate(`/outbound-transaction/loss/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'loss_transaction.action_detail', defaultMessage: 'Detail' })}
                </Dropdown.Item>
                {canUpdate && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <Dropdown.Item onPress={() => navigate(`/outbound-transaction/loss/${row.original.id}/edit`)}>
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({ id: 'loss_transaction.action_edit', defaultMessage: 'Edit' })}
                  </Dropdown.Item>
                ) : null}
                {canDelete && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <>
                    <Separator />
                    <Dropdown.Item variant="danger" onPress={() => { setDeletingRowId(row.original.id); setDeleteModalOpen(true); }}>
                      <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                      {intl.formatMessage({ id: 'loss_transaction.action_delete', defaultMessage: 'Delete' })}
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


  const list = useListPage<LossTransactionRow>({
    queryKey: ['lossTransactionList'],
    initialSorting: [{ id: 'date', desc: true }],
    queryFn: (input) =>
      trpcClient.lossTransaction.list.query({
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
      await trpcClient.lossTransaction.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ['lossTransactionList'] });
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
        section: 'loss-transaction-list',
        totalRecords: list.totalEntries,
        currentPage: list.currentPage,
        totalPages: list.totalPages,
        visibleRows: rows.map((row) => ({ id: row.id, documentNumber: row.documentNumber, status: row.approvalStatus })),
      })}
    >
      <TableToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder={intl.formatMessage({ id: 'loss_transaction.search_placeholder', defaultMessage: 'Search...' })}
        createLabel={intl.formatMessage({ id: 'loss_transaction.create_button', defaultMessage: 'Create' })}
        onCreate={canCreate ? () => navigate('/outbound-transaction/loss/new') : undefined}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterAriaLabel={intl.formatMessage({ id: 'loss_transaction.filter_status_aria', defaultMessage: 'Filter by approval status' })}
      />
      <DataTable<LossTransactionRow>
        table={list.table}
        columns={columns}
        isLoading={list.isLoading || list.isFetching}
        enableSorting
        emptyState={{
          icon: 'solar:danger-square-linear',
          message: intl.formatMessage({ id: 'loss_transaction.empty_state', defaultMessage: 'No loss transactions found.' }),
        }}
        loadingMessage={intl.formatMessage({ id: 'loss_transaction.loading', defaultMessage: 'Loading...' })}
        ariaLabel={intl.formatMessage({ id: 'loss_transaction.table_aria', defaultMessage: 'Loss Transactions' })}
        rowHeaderId="documentNumber"
        onRowAction={(id) => navigate(`/outbound-transaction/loss/${id}`)}
        totalEntries={list.totalEntries}
        pageStart={list.pageStart}
        pageEnd={list.pageEnd}
      />
      <TransactionDeleteModal
        title={intl.formatMessage({ id: 'loss_transaction.delete_modal_title', defaultMessage: 'Delete loss transactions' })}
        body={intl.formatMessage(
          { id: 'loss_transaction.delete_modal_body', defaultMessage: 'Are you sure you want to delete this record?' },
          { id: deletingRowId ?? '' },
        )}
        confirmLabel={intl.formatMessage({ id: 'loss_transaction.delete_confirm', defaultMessage: 'Delete' })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => { setDeleteModalOpen(open); if (!open) setDeletingRowId(null); }}
      />
    </section>
  );
};
