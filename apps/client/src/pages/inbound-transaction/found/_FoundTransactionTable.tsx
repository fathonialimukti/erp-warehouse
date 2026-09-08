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

interface FoundTransactionRow {
  id: string;
  date: string;
  approvalStatus: string;
  createdBy?: { name?: string | null } | null;
  approvedBy?: { name?: string | null } | null;
}

export const FoundTransactionTable = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL_VALUE);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdate = hasPermission('found@update');
  const canDelete = hasPermission('found@delete');

  const statusValue = statusFilter === STATUS_FILTER_ALL_VALUE ? undefined : (statusFilter as 'DRAFT' | 'PROPOSED' | 'APPROVED' | 'REJECTED');

  const columns = useMemo<ColumnDef<FoundTransactionRow>[]>(
    () => [
      {
        accessorKey: 'id',
        enableSorting: false,
        header: intl.formatMessage({ id: 'found_transaction.col_id', defaultMessage: 'Transaction Code' }),
      },
      {
        accessorKey: 'date',
        header: intl.formatMessage({ id: 'found_transaction.col_date', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date)),
      },
      {
        accessorKey: 'approvalStatus',
        header: intl.formatMessage({ id: 'found_transaction.col_status', defaultMessage: 'Status' }),
        cell: ({ row }) => <ApprovalStatusChip status={row.original.approvalStatus} />,
      },
      {
        accessorKey: 'createdBy',
        enableSorting: false,
        header: intl.formatMessage({ id: 'found_transaction.col_created_by', defaultMessage: 'Created By' }),
        cell: ({ row }) => row.original.createdBy?.name ?? '-',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="ghost" isIconOnly aria-label="Actions">
                <Icon icon="solar:menu-dots-bold" className="size-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Found transaction actions">
                <Dropdown.Item onPress={() => navigate(`/inbound-transaction/found/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'found_transaction.action_detail', defaultMessage: 'Detail' })}
                </Dropdown.Item>
                {canUpdate && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <Dropdown.Item onPress={() => navigate(`/inbound-transaction/found/${row.original.id}/edit`)}>
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({ id: 'found_transaction.action_edit', defaultMessage: 'Edit' })}
                  </Dropdown.Item>
                ) : null}
                {canDelete && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <>
                    <Separator />
                    <Dropdown.Item variant="danger" onPress={() => { setDeletingRowId(row.original.id); setDeleteModalOpen(true); }}>
                      <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                      {intl.formatMessage({ id: 'found_transaction.action_delete', defaultMessage: 'Delete' })}
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

  const list = useListPage<FoundTransactionRow>({
    queryKey: ['foundTransactionList'],
    initialSorting: [{ id: 'date', desc: true }],
    queryFn: (input) =>
      trpcClient.foundTransaction.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
        sortBy: input.sortBy as 'documentNumber' | 'date' | 'approvalStatus' | undefined,
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
      await trpcClient.foundTransaction.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ['foundTransactionList'] });
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
        section: 'found-transaction-list',
        totalRecords: list.totalEntries,
        currentPage: list.currentPage,
        totalPages: list.totalPages,
        visibleRows: rows.map((row) => ({ id: row.id, date: row.date, status: row.approvalStatus, createdBy: row.createdBy?.name ?? 'Unknown' })),
      })}
    >
      <TableToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        searchPlaceholder={intl.formatMessage({ id: 'found_transaction.search_placeholder', defaultMessage: 'Search...' })}
        createLabel={intl.formatMessage({ id: 'found_transaction.create_button', defaultMessage: 'Create' })}
        onCreate={hasPermission('found@create') ? () => navigate('/inbound-transaction/found/new') : undefined}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterAriaLabel={intl.formatMessage({ id: 'found_transaction.filter_status_aria', defaultMessage: 'Filter by approval status' })}
      />
      <DataTable<FoundTransactionRow>
        table={list.table}
        columns={columns}
        isLoading={list.isLoading || list.isFetching}
        enableSorting
        emptyState={{
          icon: 'solar:magnifer-linear',
          message: intl.formatMessage({ id: 'found_transaction.empty_state', defaultMessage: 'No found transactions found.' }),
        }}
        loadingMessage={intl.formatMessage({ id: 'found_transaction.loading', defaultMessage: 'Loading...' })}
        ariaLabel="Found transactions"
        rowHeaderId="id"
        onRowAction={(id) => navigate(`/inbound-transaction/found/${id}`)}
        totalEntries={list.totalEntries}
        pageStart={list.pageStart}
        pageEnd={list.pageEnd}
      />
      <TransactionDeleteModal
        body={intl.formatMessage(
          { id: 'found_transaction.delete_modal_body', defaultMessage: 'Are you sure you want to delete this record?' },
        )}
        confirmLabel={intl.formatMessage({ id: 'found_transaction.delete_confirm', defaultMessage: 'Delete' })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => { setDeleteModalOpen(open); if (!open) setDeletingRowId(null); }}
        title={intl.formatMessage({ id: 'found_transaction.delete_modal_title', defaultMessage: 'Delete found transactions' })}
      />
    </section>
  );
};
