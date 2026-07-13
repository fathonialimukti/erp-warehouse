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
  TransactionDeleteModal,
  TransactionListLayout,
} from '../../_transaction-shared';

interface WipIssueRow {
  id: string;
  date: string;
  approvalStatus: string;
  createdBy?: { name?: string | null } | null;
  approvedBy?: { name?: string | null } | null;
}

export const WipIssueTable = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdate = hasPermission('wip-issue@update');
  const canDelete = hasPermission('wip-issue@delete');

  const columns = useMemo<ColumnDef<WipIssueRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: intl.formatMessage({ id: 'wip_issue.col_id', defaultMessage: 'Transaction Code' }),
      },
      {
        accessorKey: 'date',
        header: intl.formatMessage({ id: 'wip_issue.col_date', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date)),
      },
      {
        accessorKey: 'approvalStatus',
        header: intl.formatMessage({ id: 'wip_issue.col_status', defaultMessage: 'Status' }),
        cell: ({ row }) => <ApprovalStatusChip status={row.original.approvalStatus} />,
      },
      {
        accessorKey: 'createdBy',
        header: intl.formatMessage({ id: 'wip_issue.col_created_by', defaultMessage: 'Created By' }),
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
              <Dropdown.Menu aria-label="WIP Issue actions">
                <Dropdown.Item onPress={() => navigate(`/outbound-transaction/wip-issue/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'wip_issue.action_detail', defaultMessage: 'Detail' })}
                </Dropdown.Item>
                {canUpdate && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <Dropdown.Item onPress={() => navigate(`/outbound-transaction/wip-issue/${row.original.id}/edit`)}>
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({ id: 'wip_issue.action_edit', defaultMessage: 'Edit' })}
                  </Dropdown.Item>
                ) : null}
                {canDelete && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <>
                    <Separator />
                    <Dropdown.Item variant="danger" onPress={() => { setDeletingRowId(row.original.id); setDeleteModalOpen(true); }}>
                      <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                      {intl.formatMessage({ id: 'wip_issue.action_delete', defaultMessage: 'Delete' })}
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


  const list = useListPage<WipIssueRow>({
    queryKey: ['wipIssueList'],
    queryFn: (input) =>
      trpcClient.wipIssue.list.query({
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
      await trpcClient.wipIssue.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ['wipIssueList'] });
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
        section: 'wip-issue-list',
        totalRecords: list.totalEntries,
        currentPage: list.currentPage,
        totalPages: list.totalPages,
        visibleRows: rows.map((row) => ({ id: row.id, date: row.date, status: row.approvalStatus })),
      })}
    >
      <TransactionListLayout
        title={intl.formatMessage({ id: 'wip_issue.list_title', defaultMessage: 'WIP Issues' })}
        description={intl.formatMessage({ id: 'wip_issue.list_description', defaultMessage: 'Manage WIP issue transactions.' })}
        createLabel={intl.formatMessage({ id: 'wip_issue.create_button', defaultMessage: 'Create' })}
        onCreate={hasPermission('wip-issue@create') ? () => navigate('/outbound-transaction/wip-issue/new') : undefined}
        onSearchChange={list.setSearchInput}
        searchPlaceholder={intl.formatMessage({ id: 'wip_issue.search_placeholder', defaultMessage: 'Search...' })}
        searchValue={list.searchInput}
      >
        <DataTable<WipIssueRow>
          table={list.table}
          columns={columns}
          isLoading={list.isLoading || list.isFetching}
          emptyState={{
            icon: 'solar:layers-linear',
            message: intl.formatMessage({ id: 'wip_issue.empty_state', defaultMessage: 'No WIP issues found.' }),
          }}
          loadingMessage={intl.formatMessage({ id: 'wip_issue.loading', defaultMessage: 'Loading...' })}
          ariaLabel="WIP Issues"
          rowHeaderId="id"
          onRowAction={(id) => navigate(`/outbound-transaction/wip-issue/${id}`)}
          totalEntries={list.totalEntries}
          pageStart={list.pageStart}
          pageEnd={list.pageEnd}
        />
      </TransactionListLayout>
      <TransactionDeleteModal
        body={intl.formatMessage(
          { id: 'wip_issue.delete_modal_body', defaultMessage: 'Are you sure you want to delete this record?' },
        )}
        confirmLabel={intl.formatMessage({ id: 'wip_issue.delete_confirm', defaultMessage: 'Delete' })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => { setDeleteModalOpen(open); if (!open) setDeletingRowId(null); }}
        title={intl.formatMessage({ id: 'wip_issue.delete_modal_title', defaultMessage: 'Delete WIP issues' })}
      />
    </section>
  );
};
