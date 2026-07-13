import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Dropdown, Separator } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../lib/trpc';
import { hasPermissionAtom } from '../../lib/atoms';
import { DataTable } from '../../components/DataTable';
import { useListPage } from '../../lib/useListPage';
import {
  ApprovalStatusChip,
  TransactionDeleteModal,
  TransactionListLayout,
} from '../_transaction-shared';

interface SubinventoryTransferRow {
  id: string;
  date: string;
  transferReason?: string | null;
  approvalStatus: string;
  createdBy?: { name?: string | null } | null;
  approvedBy?: { name?: string | null } | null;
}

export const SubinventoryTransferTable = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdate = hasPermission('subinventory-transfer@update');
  const canDelete = hasPermission('subinventory-transfer@delete');

  const columns = useMemo<ColumnDef<SubinventoryTransferRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: intl.formatMessage({ id: 'subinventory_transfer.col_id', defaultMessage: 'Transaction Code' }),
      },
      {
        accessorKey: 'date',
        header: intl.formatMessage({ id: 'subinventory_transfer.col_date', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date)),
      },
      {
        accessorKey: 'transferReason',
        header: intl.formatMessage({ id: 'subinventory_transfer.col_reason', defaultMessage: 'Reason' }),
        cell: ({ row }) => row.original.transferReason ?? '-',
      },
      {
        accessorKey: 'approvalStatus',
        header: intl.formatMessage({ id: 'subinventory_transfer.col_status', defaultMessage: 'Status' }),
        cell: ({ row }) => <ApprovalStatusChip status={row.original.approvalStatus} />,
      },
      {
        accessorKey: 'createdBy',
        header: intl.formatMessage({ id: 'subinventory_transfer.col_created_by', defaultMessage: 'Created By' }),
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
              <Dropdown.Menu aria-label="Subinventory transfer actions">
                <Dropdown.Item onPress={() => navigate(`/subinventory-transfer/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'subinventory_transfer.action_detail', defaultMessage: 'Detail' })}
                </Dropdown.Item>
                {canUpdate && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <Dropdown.Item onPress={() => navigate(`/subinventory-transfer/${row.original.id}/edit`)}>
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({ id: 'subinventory_transfer.action_edit', defaultMessage: 'Edit' })}
                  </Dropdown.Item>
                ) : null}
                {canDelete && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <>
                    <Separator />
                    <Dropdown.Item variant="danger" onPress={() => { setDeletingRowId(row.original.id); setDeleteModalOpen(true); }}>
                      <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                      {intl.formatMessage({ id: 'subinventory_transfer.action_delete', defaultMessage: 'Delete' })}
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


  const list = useListPage<SubinventoryTransferRow>({
    queryKey: ['subinventoryTransferList'],
    queryFn: (input) =>
      trpcClient.subinventoryTransfer.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
      }),
    columns,
  });

  const rows = list.query.data?.data ?? [];

  const handleDelete = async () => {
    if (!deletingRowId || isDeleting) return;
    setIsDeleting(true);
    try {
      await trpcClient.subinventoryTransfer.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ['subinventoryTransferList'] });
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
        section: 'subinventory-transfer-list',
        totalRecords: list.totalEntries,
        currentPage: list.currentPage,
        totalPages: list.totalPages,
        visibleRows: rows.map((row) => ({ id: row.id, date: row.date, status: row.approvalStatus })),
      })}
    >
      <TransactionListLayout
        title={intl.formatMessage({ id: 'subinventory_transfer.list_title', defaultMessage: 'Subinventory Transfers' })}
        description={intl.formatMessage({ id: 'subinventory_transfer.list_description', defaultMessage: 'Manage subinventory transfers.' })}
        createLabel={intl.formatMessage({ id: 'subinventory_transfer.create_button', defaultMessage: 'Create' })}
        onCreate={hasPermission('subinventory-transfer@create') ? () => navigate('/subinventory-transfer/new') : undefined}
        onSearchChange={list.setSearchInput}
        searchPlaceholder={intl.formatMessage({ id: 'subinventory_transfer.search_placeholder', defaultMessage: 'Search...' })}
        searchValue={list.searchInput}
      >
        <DataTable<SubinventoryTransferRow>
          table={list.table}
          columns={columns}
          isLoading={list.isLoading || list.isFetching}
          emptyState={{
            icon: 'solar:transfer-horizontal-linear',
            message: intl.formatMessage({ id: 'subinventory_transfer.empty_state', defaultMessage: 'No subinventory transfers found.' }),
          }}
          loadingMessage={intl.formatMessage({ id: 'subinventory_transfer.loading', defaultMessage: 'Loading...' })}
          ariaLabel="Subinventory transfers"
          rowHeaderId="id"
          onRowAction={(id) => navigate(`/subinventory-transfer/${id}`)}
          totalEntries={list.totalEntries}
          pageStart={list.pageStart}
          pageEnd={list.pageEnd}
        />
      </TransactionListLayout>
      <TransactionDeleteModal
        body={intl.formatMessage(
          { id: 'subinventory_transfer.delete_modal_body', defaultMessage: 'Are you sure you want to delete this record?' },
        )}
        confirmLabel={intl.formatMessage({ id: 'subinventory_transfer.delete_confirm', defaultMessage: 'Delete' })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => { setDeleteModalOpen(open); if (!open) setDeletingRowId(null); }}
        title={intl.formatMessage({ id: 'subinventory_transfer.delete_modal_title', defaultMessage: 'Delete subinventory transfer' })}
      />
    </section>
  );
};