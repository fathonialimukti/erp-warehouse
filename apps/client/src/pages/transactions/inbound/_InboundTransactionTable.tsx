import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Dropdown, Pagination, Separator, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef, type PaginationState, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { ApprovalStatusChip, TableEmptyStateContent, TableLoadingRow, TransactionDeleteModal, TransactionListLayout } from '../shared';

interface InboundTransactionRowItem {
  skuId: string;
  sku?: {
    id?: string;
  };
}

interface InboundTransactionRow {
  approvalStatus: string;
  createdBy?: {
    name?: string | null;
  } | null;
  approvedBy?: {
    name?: string | null;
  } | null;
  date: string;
  id: string;
  incomingLocation?: {
    id?: string | null;
  } | null;
  items?: InboundTransactionRowItem[];
}

interface InboundTransactionListResult {
  data: InboundTransactionRow[];
  meta: {
    total: number;
    totalPages: number;
  };
}

export const InboundTransactionTable = () => {
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
  const canCreate = hasPermission('warehouse_transaction_create');
  const canUpdate = hasPermission('warehouse_transaction_update');
  const canDelete = hasPermission('warehouse_transaction_delete');

  const { data, isLoading, isFetching } = useQuery<InboundTransactionListResult>({
    queryKey: ['inboundTransactionList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.inboundTransaction.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const rows = data?.data ?? [];

  const columns = useMemo<ColumnDef<InboundTransactionRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: intl.formatMessage({ id: 'inbound_transaction.id', defaultMessage: 'Transaction Code' }),
      },
      {
        accessorKey: 'date',
        header: intl.formatMessage({ id: 'inbound_transaction.date', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date)),
      },
      {
        accessorKey: 'approvalStatus',
        header: intl.formatMessage({ id: 'inbound_transaction.status', defaultMessage: 'Status' }),
        cell: ({ row }) => <ApprovalStatusChip status={row.original.approvalStatus} />,
      },
      {
        accessorKey: 'createdBy',
        header: intl.formatMessage({ id: 'inbound_transaction.createdBy', defaultMessage: 'Created By' }),
        cell: ({ row }) => row.original.createdBy?.name ?? '-',
      },
      {
        accessorKey: 'approvedBy',
        header: intl.formatMessage({ id: 'inbound_transaction.approvedBy', defaultMessage: 'Approved By' }),
        cell: ({ row }) => row.original.approvedBy?.name ?? intl.formatMessage({ id: 'inbound_transaction.pending', defaultMessage: 'Pending' }),
      },

      {
        accessorKey: 'skus',
        header: intl.formatMessage({ id: 'inbound_transaction.skus', defaultMessage: 'SKUs' }),
        cell: ({ row }) => {
          const skuIds = row.original.items?.map((item) => item.sku?.id ?? item.skuId) ?? [];
          const uniqueSkuIds = Array.from(new Set(skuIds.filter(Boolean)));
          return uniqueSkuIds.length > 0 ? uniqueSkuIds.join(', ') : '-';
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="ghost" isIconOnly aria-label={intl.formatMessage({ id: 'transaction_incominglist_actionstriggeraria', defaultMessage: 'Actions' })}>
                <Icon icon="solar:menu-dots-bold" className="size-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label={intl.formatMessage({ id: 'transaction_incominglist_actionsmenuaria', defaultMessage: 'Inbound transaction actions' })}>
                <Dropdown.Item onPress={() => navigate(`/transactions/inbound/detail/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'transaction_incominglist_actiondetail', defaultMessage: 'Detail' })}
                </Dropdown.Item>
                {canUpdate ? (
                  <Dropdown.Item
                    onPress={() => navigate(`/transactions/inbound/form/${row.original.id}`)}
                    className="text-warning"
                  >
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({ id: 'transaction_incominglist_actionedit', defaultMessage: 'Edit' })}
                  </Dropdown.Item>
                ) : null}
                {canDelete ? (
                  <>
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
                      {intl.formatMessage({ id: 'transaction_incominglist_actiondelete', defaultMessage: 'Delete' })}
                    </Dropdown.Item>
                  </>
                ) : null}
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
      await trpcClient.inboundTransaction.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ['inboundTransactionList'] });
      setDeleteModalOpen(false);
      setDeletingRowId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      <TransactionListLayout
        createLabel={intl.formatMessage({ id: 'transaction_incominglist_createbutton', defaultMessage: 'Create' })}
        description={intl.formatMessage({ id: 'transaction_incominglist_description', defaultMessage: 'Manage all inbound transactions and approval statuses.' })}
        onCreate={canCreate ? () => navigate('/transactions/inbound/form') : undefined}
        onSearchChange={setSearchInput}
        searchPlaceholder={intl.formatMessage({ id: 'transaction_incominglist_searchplaceholder', defaultMessage: 'Search inbound transactions...' })}
        searchValue={searchInput}
        title={intl.formatMessage({ id: 'transaction_incominglist_title', defaultMessage: 'Inbound Transactions' })}
      >
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={intl.formatMessage({ id: 'transaction_incominglist_tablearialabel', defaultMessage: 'Inbound transactions table' })} onRowAction={(key) => navigate(`/transactions/inbound/${String(key)}`)}>
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
                    icon="solar:download-linear"
                    message={intl.formatMessage({ id: 'transaction_incominglist_emptystate', defaultMessage: 'No inbound transactions found.' })}
                  />
                )}
              >
                {isLoading || isFetching ? (
                  <TableLoadingRow colSpan={columns.length} message={intl.formatMessage({ id: 'transaction_incominglist_loading', defaultMessage: 'Loading inbound transactions...' })} />
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
                    {intl.formatMessage({ id: 'transaction_incominglist_paginationprev', defaultMessage: 'Prev' })}
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
                    {intl.formatMessage({ id: 'transaction_incominglist_paginationnext', defaultMessage: 'Next' })}
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
          { id: 'transaction_incominglist_deletemodalbody', defaultMessage: 'Are you sure you want to delete inbound transaction {transactionId}? This will only work when the status is still DRAFT.' },
          { transactionId: deletingRowId ?? '' },
        )}
        confirmLabel={intl.formatMessage({ id: 'transaction_incominglist_delete', defaultMessage: 'Delete' })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={() => void handleDelete()}
        onOpenChange={setDeleteModalOpen}
        title={intl.formatMessage({ id: 'transaction_incominglist_deletemodaltitle', defaultMessage: 'Delete Inbound Transaction' })}
      />
    </section>
  );
}
