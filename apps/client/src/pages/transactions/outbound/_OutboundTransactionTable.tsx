import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Dropdown, Pagination, Separator, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef, type PaginationState, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { useAtomValue } from 'jotai';
import { ApprovalStatusChip, TableEmptyStateContent, TableLoadingRow, TransactionDeleteModal, TransactionListLayout } from '../shared';

interface OutboundTransactionRow {
  approvalStatus: string;
  date: string;
  id: string;
  documentNumber?: string | null;
  recipient?: string | null;
  reference?: string | null;
  notes?: string | null;
  totalQuantity?: number;
  totalPalletsGenerated?: number;
}

interface OutboundTransactionListResult {
  data: OutboundTransactionRow[];
  meta: {
    total: number;
    totalPages: number;
  };
}

export const OutboundTransactionTable = () => {
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
  const canCreate = hasPermission('outbound_transaction@create');
  const canUpdate = hasPermission('outbound_transaction@update');
  const canDelete = hasPermission('outbound_transaction@delete');

  const { data, isLoading, isFetching } = useQuery<OutboundTransactionListResult>({
    queryKey: ['outboundTransactionList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.outboundTransaction.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const rows = data?.data ?? [];

  const columns = useMemo<ColumnDef<OutboundTransactionRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: intl.formatMessage({ id: 'transaction.outbound_list.header_document_number', defaultMessage: 'Document Number' }),
        cell: ({ row }) => row.original.documentNumber ?? row.original.id,
      },
      {
        accessorKey: 'recipient',
        header: intl.formatMessage({ id: 'transaction.outbound_list.header_recipient', defaultMessage: 'Recipient' }),
        cell: ({ row }) => row.original.recipient ?? '-',
      },
      {
        accessorKey: 'reference',
        header: intl.formatMessage({ id: 'transaction.outbound_list.header_reference', defaultMessage: 'Reference' }),
        cell: ({ row }) => row.original.reference ?? '-',
      },
      {
        accessorKey: 'date',
        header: intl.formatMessage({ id: 'transaction.outbound_list.header_date', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date), { year: 'numeric', month: 'short', day: 'numeric' }),
      },
      {
        accessorKey: 'approvalStatus',
        header: intl.formatMessage({ id: 'transaction.outbound_list.header_status', defaultMessage: 'Status' }),
        cell: ({ row }) => <ApprovalStatusChip status={row.original.approvalStatus} />,
      },
      {
        id: 'items',
        header: intl.formatMessage({ id: 'transaction.outbound_list.header_items', defaultMessage: 'Pallets' }),
        cell: ({ row }) => String(row.original.totalPalletsGenerated ?? 0),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="ghost" isIconOnly aria-label={intl.formatMessage({ id: 'transaction.outbound_list.actions_trigger_aria', defaultMessage: 'Actions' })}>
                <Icon icon="solar:menu-dots-bold" className="size-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label={intl.formatMessage({ id: 'transaction.outbound_list.actions_menu_aria', defaultMessage: 'Outbound transaction actions' })}>
                <Dropdown.Item onPress={() => navigate(`/transactions/outbound/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'transaction.outbound_list.action_detail', defaultMessage: 'Detail' })}
                </Dropdown.Item>
                {canUpdate ? (
                  <Dropdown.Item onPress={() => navigate(`/transactions/outbound/form/${row.original.id}`)} className="text-warning">
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({ id: 'transaction.outbound_list.action_edit', defaultMessage: 'Edit' })}
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
                      {intl.formatMessage({ id: 'transaction.outbound_list.action_delete', defaultMessage: 'Delete' })}
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
      await trpcClient.outboundTransaction.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ['outboundTransactionList'] });
      setDeleteModalOpen(false);
      setDeletingRowId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      <TransactionListLayout
        createLabel={intl.formatMessage({ id: 'transaction.outbound_list.create_button', defaultMessage: 'Create' })}
        description={intl.formatMessage({ id: 'transaction.outbound_list.description', defaultMessage: 'Manage all outbound transactions and pallet reservations.' })}
        onCreate={canCreate ? () => navigate('/transactions/outbound/form') : undefined}
        onSearchChange={setSearchInput}
        searchPlaceholder={intl.formatMessage({ id: 'transaction.outbound_list.search_placeholder', defaultMessage: 'Search outbound transactions...' })}
        searchValue={searchInput}
        title={intl.formatMessage({ id: 'transaction.outbound_list.title', defaultMessage: 'Outbound Transactions' })}
      >
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={intl.formatMessage({ id: 'transaction.outbound_list.table_aria_label', defaultMessage: 'Outbound transactions table' })} onRowAction={(key) => navigate(`/transactions/outbound/${String(key)}`)}>
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
                    icon="solar:box-open-linear"
                    message={intl.formatMessage({ id: 'transaction.outbound_list.empty_state', defaultMessage: 'No outbound transactions found.' })}
                  />
                )}
              >
                {isLoading || isFetching ? (
                  <TableLoadingRow colSpan={columns.length} message={intl.formatMessage({ id: 'transaction.outbound_list.loading', defaultMessage: 'Loading outbound transactions...' })} />
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
        body={intl.formatMessage(
          { id: 'transaction.outbound_list.delete_modal_body', defaultMessage: 'Are you sure you want to delete outbound transaction {transactionId}? This can only be done when the transaction is still DRAFT or REJECTED.' },
          { transactionId: deletingRowId ?? '' },
        )}
        confirmLabel={intl.formatMessage({ id: 'transaction.outbound_list.delete_button', defaultMessage: 'Delete' })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={handleDelete}
        onOpenChange={setDeleteModalOpen}
        title={intl.formatMessage({ id: 'transaction.outbound_list.delete_modal_title', defaultMessage: 'Delete Outbound Transaction' })}
      />
    </section>
  );
};
