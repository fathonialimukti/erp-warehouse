import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Dropdown, Pagination, Separator, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef, type PaginationState, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';
import { ApprovalStatusChip, TableEmptyStateContent, TableLoadingRow, TransactionDeleteModal, TransactionListLayout } from '../shared';

interface LostTransactionRow {
  approvalStatus: string;
  date: string;
  estimatedValue: number | string | null;
  id: string;
  lossReason: string | null;
  paletPivots?: unknown[];
}

interface LostTransactionListResult {
  data: LostTransactionRow[];
  meta: {
    total: number;
    totalPages: number;
  };
}

export default function LostTransactionTable() {
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

  const { data: queryData, isLoading, isFetching } = useQuery({
    queryKey: ['lossTransactionList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.lossTransaction.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const data = queryData as LostTransactionListResult | undefined;
  const rows = data?.data ?? [];

  const columns = useMemo<ColumnDef<LostTransactionRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: intl.formatMessage({ id: 'transaction.loss_list.header_transaction_code', defaultMessage: 'Transaction Code' }),
      },
      {
        accessorKey: 'lossReason',
        header: intl.formatMessage({ id: 'transaction.loss_list.header_loss_reason', defaultMessage: 'Loss Reason' }),
      },
      {
        accessorKey: 'estimatedValue',
        header: intl.formatMessage({ id: 'transaction.loss_list.header_estimated_value', defaultMessage: 'Estimated Value' }),
        cell: ({ row }) => {
          const value = row.original.estimatedValue;
          return value != null ? `Rp ${Number(value).toLocaleString('id-ID')}` : '-';
        },
      },
      {
        id: 'jumlahPalet',
        header: intl.formatMessage({ id: 'transaction.loss_list.header_pallet_count', defaultMessage: 'Pallet Count' }),
        cell: ({ row }) => String(row.original.paletPivots?.length ?? '-'),
      },
      {
        accessorKey: 'date',
        header: intl.formatMessage({ id: 'transaction.loss_list.header_date', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date), { year: 'numeric', month: 'short', day: 'numeric' }),
      },
      {
        accessorKey: 'approvalStatus',
        header: intl.formatMessage({ id: 'transaction.loss_list.header_status', defaultMessage: 'Status' }),
        cell: ({ row }) => <ApprovalStatusChip status={row.original.approvalStatus} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="ghost" isIconOnly aria-label={intl.formatMessage({ id: 'transaction.loss_list.actions_trigger_aria', defaultMessage: 'Actions' })}>
                <Icon icon="solar:menu-dots-bold" className="size-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label={intl.formatMessage({ id: 'transaction.loss_list.actions_menu_aria', defaultMessage: 'Loss transaction actions' })}>
                <Dropdown.Item onPress={() => navigate(`/transactions/loss/detail/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'transaction.loss_list.action_detail', defaultMessage: 'Detail' })}
                </Dropdown.Item>
                <Dropdown.Item onPress={() => navigate(`/transactions/loss/form/${row.original.id}`)} className="text-warning">
                  <Icon icon="solar:pen-linear" className="size-4" />
                  {intl.formatMessage({ id: 'transaction.loss_list.action_edit', defaultMessage: 'Edit' })}
                </Dropdown.Item>
                <Separator />
                <Dropdown.Item
                  variant="danger"
                  className="text-danger"
                  onPress={() => {
                    setDeletingRowId(row.original.id);
                    setDeleteModalOpen(true);
                  }}
                >
                  <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                  {intl.formatMessage({ id: 'transaction.loss_list.action_delete', defaultMessage: 'Delete' })}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [navigate, intl],
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
      await trpcClient.lossTransaction.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ['lossTransactionList'] });
      setDeleteModalOpen(false);
      setDeletingRowId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      <TransactionListLayout
        createLabel={intl.formatMessage({ id: 'transaction.loss_list.create_button', defaultMessage: 'Create' })}
        description={intl.formatMessage({ id: 'transaction.loss_list.description', defaultMessage: 'Manage loss transactions and estimated values.' })}
        onCreate={() => navigate('/transactions/loss/form')}
        onSearchChange={setSearchInput}
        searchPlaceholder={intl.formatMessage({ id: 'transaction.loss_list.search_placeholder', defaultMessage: 'Search loss transactions...' })}
        searchValue={searchInput}
        title={intl.formatMessage({ id: 'transaction.loss_list.title', defaultMessage: 'Loss Transactions' })}
      >
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={intl.formatMessage({ id: 'transaction.loss_list.table_aria_label', defaultMessage: 'Loss transactions table' })}>
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
                      icon="solar:warning-linear"
                      message={intl.formatMessage({ id: 'transaction.loss_list.empty_state', defaultMessage: 'No loss transactions found.' })}
                    />
                  )}
                >
                  {isLoading || isFetching ? (
                    <TableLoadingRow colSpan={columns.length} message={intl.formatMessage({ id: 'transaction.loss_list.loading', defaultMessage: 'Loading loss transactions...' })} />
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.original.id} id={row.original.id}>
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
                      Prev
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
                      Next
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </Table.Footer>
          </Table>
      </TransactionListLayout>

      <TransactionDeleteModal
        body={intl.formatMessage({ id: 'transaction.lost_list.delete_modal_body', defaultMessage: 'Are you sure you want to delete loss transaction {transactionId}? This will only work when the status is still DRAFT.' }, { transactionId: deletingRowId ?? '' })}
        confirmLabel={intl.formatMessage({ id: 'transaction.lost_list.delete', defaultMessage: 'Delete' })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={() => void handleDelete()}
        onOpenChange={setDeleteModalOpen}
        title={intl.formatMessage({ id: 'transaction.lost_list.delete_modal_title', defaultMessage: 'Delete Loss Transaction' })}
      />
    </section>
  );
}
