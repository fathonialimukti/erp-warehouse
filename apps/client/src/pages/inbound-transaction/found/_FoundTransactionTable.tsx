import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Dropdown, Pagination, Separator, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
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
  STATUS_FILTER_ALL_VALUE,
  TableEmptyStateContent,
  TableLoadingRow,
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

interface FoundTransactionListResult {
  data: FoundTransactionRow[];
  meta: { total: number; totalPages: number };
}

export const FoundTransactionTable = () => {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_FILTER_ALL_VALUE);
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

  // Reset to first page when sort or status filter changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [sorting, statusFilter]);

  const hasPermission = useAtomValue(hasPermissionAtom);
  const canUpdate = hasPermission('found@update');
  const canDelete = hasPermission('found@delete');

  const activeSort = sorting[0];
  const sortBy = activeSort?.id as 'documentNumber' | 'date' | 'approvalStatus' | undefined;
  const sortOrder = activeSort ? (activeSort.desc ? 'desc' : 'asc') : undefined;
  const statusValue = statusFilter === STATUS_FILTER_ALL_VALUE ? undefined : (statusFilter as 'DRAFT' | 'PROPOSED' | 'APPROVED' | 'REJECTED');

  const { data, isLoading, isFetching } = useQuery<FoundTransactionListResult>({
    queryKey: ['foundTransactionList', pagination.pageIndex, pagination.pageSize, search, sortBy, sortOrder, statusFilter],
    queryFn: () =>
      trpcClient.foundTransaction.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
        sortBy,
        sortOrder,
        approvalStatus: statusValue,
      }),
  });

  const rows = data?.data ?? [];

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

  const table = useReactTable({
    data: rows,
    columns,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
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
        totalRecords: totalEntries,
        currentPage,
        totalPages,
        visibleRows: rows.map((row) => ({ id: row.id, date: row.date, status: row.approvalStatus, createdBy: row.createdBy?.name ?? 'Unknown' })),
      })}
    >
      <TableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={intl.formatMessage({ id: 'found_transaction.search_placeholder', defaultMessage: 'Search...' })}
        createLabel={intl.formatMessage({ id: 'found_transaction.create_button', defaultMessage: 'Create' })}
        onCreate={hasPermission('found@create') ? () => navigate('/inbound-transaction/found/new') : undefined}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterAriaLabel={intl.formatMessage({ id: 'found_transaction.filter_status_aria', defaultMessage: 'Filter by approval status' })}
      />
      <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Found transactions"
              sortDescriptor={sorting[0] ? { column: sorting[0].id, direction: sorting[0].desc ? 'descending' : 'ascending' } : undefined}
              onSortChange={(descriptor) => setSorting([{ id: descriptor.column as string, desc: descriptor.direction === 'descending' }])}
              onRowAction={(key) => navigate(`/inbound-transaction/found/${String(key)}`)}
            >
              <Table.Header>
                {table.getHeaderGroups().map((headerGroup) =>
                  headerGroup.headers.map((header) => (
                    <Table.Column
                      key={header.id}
                      id={header.id}
                      isRowHeader={header.column.id === 'id'}
                      allowsSorting={header.column.getCanSort()}
                    >
                      {({ sortDirection }) => (
                        <span className="inline-flex items-center gap-1 font-semibold">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() ? (
                            <Icon
                              icon="solar:alt-arrow-up-linear"
                              className={`size-3 transition-transform ${sortDirection === 'descending' ? 'rotate-180' : sortDirection === 'ascending' ? '' : 'opacity-30'}`}
                            />
                          ) : null}
                        </span>
                      )}
                    </Table.Column>
                  )),
                )}
              </Table.Header>
              <Table.Body
                renderEmptyState={() => (
                  <TableEmptyStateContent
                    icon="solar:magnifer-linear"
                    message={intl.formatMessage({ id: 'found_transaction.empty_state', defaultMessage: 'No found transactions found.' })}
                  />
                )}
              >
                {isLoading || isFetching ? (
                  <TableLoadingRow colSpan={table.getAllColumns().length} message={intl.formatMessage({ id: 'found_transaction.loading', defaultMessage: 'Loading...' })} />
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
                    {intl.formatMessage({ id: 'found_transaction.pagination_prev', defaultMessage: 'Prev' })}
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
                    {intl.formatMessage({ id: 'found_transaction.pagination_next', defaultMessage: 'Next' })}
                    <Pagination.NextIcon />
                  </Pagination.Next>
                </Pagination.Item>
              </Pagination.Content>
            </Pagination>
          </Table.Footer>
        </Table>

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
