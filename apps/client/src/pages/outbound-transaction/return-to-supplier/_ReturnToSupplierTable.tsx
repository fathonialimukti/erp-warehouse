import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Dropdown, Pagination, Separator, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import {
  ApprovalStatusChip,
  TableEmptyStateContent,
  TableLoadingRow,
  TransactionDeleteModal,
  TransactionListLayout,
} from '../../transactions/shared';

interface ReturnToSupplierRow {
  id: string;
  date: string;
  approvalStatus: string;
  createdBy?: { name?: string | null } | null;
  approvedBy?: { name?: string | null } | null;
}

interface ReturnToSupplierListResult {
  data: ReturnToSupplierRow[];
  meta: { total: number; totalPages: number };
}

export const ReturnToSupplierTable = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdate = hasPermission('return-to-supplier@update');
  const canDelete = hasPermission('return-to-supplier@delete');

  const { data, isLoading, isFetching } = useQuery<ReturnToSupplierListResult>({
    queryKey: ['returnToSupplierList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.returnToSupplier.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const rows = data?.data ?? [];

  const columns = useMemo<ColumnDef<ReturnToSupplierRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: intl.formatMessage({ id: 'return_to_supplier.col_id', defaultMessage: 'Transaction Code' }),
      },
      {
        accessorKey: 'date',
        header: intl.formatMessage({ id: 'return_to_supplier.col_date', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date)),
      },
      {
        accessorKey: 'approvalStatus',
        header: intl.formatMessage({ id: 'return_to_supplier.col_status', defaultMessage: 'Status' }),
        cell: ({ row }) => <ApprovalStatusChip status={row.original.approvalStatus} />,
      },
      {
        accessorKey: 'createdBy',
        header: intl.formatMessage({ id: 'return_to_supplier.col_created_by', defaultMessage: 'Created By' }),
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
              <Dropdown.Menu aria-label="Return to supplier actions">
                <Dropdown.Item onPress={() => navigate(`/outbound-transaction/return-to-supplier/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'return_to_supplier.action_detail', defaultMessage: 'Detail' })}
                </Dropdown.Item>
                {canUpdate && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <Dropdown.Item onPress={() => navigate(`/outbound-transaction/return-to-supplier/${row.original.id}/edit`)}>
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({ id: 'return_to_supplier.action_edit', defaultMessage: 'Edit' })}
                  </Dropdown.Item>
                ) : null}
                {canDelete && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <>
                    <Separator />
                    <Dropdown.Item variant="danger" onPress={() => { setDeletingRowId(row.original.id); setDeleteModalOpen(true); }}>
                      <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                      {intl.formatMessage({ id: 'return_to_supplier.action_delete', defaultMessage: 'Delete' })}
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

  const table = useReactTable({
    data: rows,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: data?.meta.totalPages ?? 0,
  });

  const totalEntries = data?.meta.total ?? 0;
  const totalPages = Math.max(data?.meta.totalPages ?? 0, 1);
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageStart = totalEntries === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = totalEntries === 0 ? 0 : pageStart + rows.length - 1;

  const handleDelete = async () => {
    if (!deletingRowId || isDeleting) return;
    setIsDeleting(true);
    try {
      await trpcClient.returnToSupplier.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ['returnToSupplierList'] });
      setDeleteModalOpen(false);
      setDeletingRowId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      <TransactionListLayout
        title={intl.formatMessage({ id: 'return_to_supplier.list_title', defaultMessage: 'Return to Supplier' })}
        description={intl.formatMessage({ id: 'return_to_supplier.list_description', defaultMessage: 'Manage return-to-supplier transactions.' })}
        createLabel={intl.formatMessage({ id: 'return_to_supplier.create_button', defaultMessage: 'Create' })}
        onCreate={hasPermission('return-to-supplier@create') ? () => navigate('/outbound-transaction/return-to-supplier/new') : undefined}
        onSearchChange={setSearchInput}
        searchPlaceholder={intl.formatMessage({ id: 'return_to_supplier.search_placeholder', defaultMessage: 'Search...' })}
        searchValue={searchInput}
      >
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Return to Supplier"
              onRowAction={(key) => navigate(`/outbound-transaction/return-to-supplier/${String(key)}`)}
            >
              <Table.Header>
                {table.getHeaderGroups().map((headerGroup) =>
                  headerGroup.headers.map((header) => (
                    <Table.Column key={header.id} isRowHeader={header.id === 'id'}>
                      <span className="font-semibold">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
                    </Table.Column>
                  )),
                )}
              </Table.Header>
              <Table.Body
                renderEmptyState={() => (
                  <TableEmptyStateContent
                    icon="solar:undo-left-linear"
                    message={intl.formatMessage({ id: 'return_to_supplier.empty_state', defaultMessage: 'No return to supplier records found.' })}
                  />
                )}
              >
                {isLoading || isFetching ? (
                  <TableLoadingRow colSpan={table.getAllColumns().length} message={intl.formatMessage({ id: 'return_to_supplier.loading', defaultMessage: 'Loading...' })} />
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <Table.Row key={row.original.id} id={row.original.id} className="cursor-pointer">
                      {row.getVisibleCells().map((cell) => (
                        <Table.Cell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>
                      ))}
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
          <Table.Footer>
            <Pagination size="sm">
              <Pagination.Summary>
                {pageStart} to {pageEnd} of {totalEntries} results
              </Pagination.Summary>
              <Pagination.Content>
                <Pagination.Item>
                  <Pagination.Previous isDisabled={!table.getCanPreviousPage()} onPress={() => table.previousPage()}>
                    <Pagination.PreviousIcon />
                    {intl.formatMessage({ id: 'return_to_supplier.pagination_prev', defaultMessage: 'Prev' })}
                  </Pagination.Previous>
                </Pagination.Item>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <Pagination.Item key={page}>
                    <Pagination.Link isActive={page === currentPage} onPress={() => table.setPageIndex(page - 1)}>
                      {page}
                    </Pagination.Link>
                  </Pagination.Item>
                ))}
                <Pagination.Item>
                  <Pagination.Next isDisabled={!table.getCanNextPage()} onPress={() => table.nextPage()}>
                    {intl.formatMessage({ id: 'return_to_supplier.pagination_next', defaultMessage: 'Next' })}
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          </Table.Footer>
        </Table>
      </TransactionListLayout>
      <TransactionDeleteModal
        body={intl.formatMessage(
          { id: 'return_to_supplier.delete_modal_body', defaultMessage: 'Are you sure you want to delete this record?' },
        )}
        confirmLabel={intl.formatMessage({ id: 'return_to_supplier.delete_confirm', defaultMessage: 'Delete' })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => { setDeleteModalOpen(open); if (!open) setDeletingRowId(null); }}
        title={intl.formatMessage({ id: 'return_to_supplier.delete_modal_title', defaultMessage: 'Delete return to supplier records' })}
      />
    </section>
  );
};
