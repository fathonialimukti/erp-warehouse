import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Dropdown, EmptyState, Input, Modal, Pagination, Separator, Spinner, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef, type PaginationState, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../../lib/trpc';

type TransaksiKehilanganRow = {
  id: string;
  tanggal: string;
  statusApproval: string;
  alasanKehilangan?: string | null;
  nilaiEstimasi?: string | number | null;
  paletPivots?: Array<any>;
};

export default function TransaksiKehilanganTable() {
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

  const { data, isLoading, isFetching } = useQuery<{ data: TransaksiKehilanganRow[]; meta: { page: number; limit: number; total: number; totalPages: number } }>({
    queryKey: ['transaksiKehilanganList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.transaksiKehilangan.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const rows = data?.data ?? [];

  const columns = useMemo<ColumnDef<TransaksiKehilanganRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: intl.formatMessage({ id: 'transaction.lossList.headerTransactionCode', defaultMessage: 'Transaction Code' }),
      },
      {
        accessorKey: 'alasanKehilangan',
        header: intl.formatMessage({ id: 'transaction.lossList.headerLossReason', defaultMessage: 'Loss Reason' }),
      },
      {
        accessorKey: 'nilaiEstimasi',
        header: intl.formatMessage({ id: 'transaction.lossList.headerEstimatedValue', defaultMessage: 'Estimated Value' }),
        cell: ({ row }) => {
          const value = row.original.nilaiEstimasi;
          return value != null ? `Rp ${Number(value).toLocaleString('id-ID')}` : '-';
        },
      },
      {
        id: 'jumlahPalet',
        header: intl.formatMessage({ id: 'transaction.lossList.headerPalletCount', defaultMessage: 'Pallet Count' }),
        cell: ({ row }) => String(row.original.paletPivots?.length ?? '-'),
      },
      {
        accessorKey: 'tanggal',
        header: intl.formatMessage({ id: 'transaction.lossList.headerDate', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.tanggal), { year: 'numeric', month: 'short', day: 'numeric' }),
      },
      {
        accessorKey: 'statusApproval',
        header: intl.formatMessage({ id: 'transaction.lossList.headerStatus', defaultMessage: 'Status' }),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="ghost" isIconOnly aria-label={intl.formatMessage({ id: 'transaction.lossList.actionsTriggerAria', defaultMessage: 'Actions' })}>
                <Icon icon="solar:menu-dots-bold" className="size-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label={intl.formatMessage({ id: 'transaction.lossList.actionsMenuAria', defaultMessage: 'Loss transaction actions' })}>
                <Dropdown.Item onPress={() => navigate(`/transaksi/kehilangan/detail/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'transaction.lossList.actionDetail', defaultMessage: 'Detail' })}
                </Dropdown.Item>
                <Dropdown.Item onPress={() => navigate(`/transaksi/kehilangan/form/${row.original.id}`)} className="text-warning">
                  <Icon icon="solar:pen-linear" className="size-4" />
                  {intl.formatMessage({ id: 'transaction.lossList.actionEdit', defaultMessage: 'Edit' })}
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
                  {intl.formatMessage({ id: 'transaction.lossList.actionDelete', defaultMessage: 'Delete' })}
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
      await trpcClient.transaksiKehilangan.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ['transaksiKehilanganList'] });
      setDeleteModalOpen(false);
      setDeletingRowId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Card.Title className="text-2xl">
              {intl.formatMessage({ id: 'transaction.lossList.title', defaultMessage: 'Loss Transactions' })}
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({ id: 'transaction.lossList.description', defaultMessage: 'Manage loss transactions and estimated values.' })}
            </Card.Description>
          </div>
          <Button variant="secondary" onPress={() => navigate('/transaksi/kehilangan/form')}>
            <Icon icon="material-symbols:add-2-rounded" className="size-4" />
            {intl.formatMessage({ id: 'transaction.lossList.createButton', defaultMessage: 'Create' })}
          </Button>
        </Card.Header>

        <Card.Content className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={intl.formatMessage({ id: 'transaction.lossList.searchPlaceholder', defaultMessage: 'Search loss transactions...' })}
              variant="secondary"
              className="w-full sm:w-80"
            />
          </div>

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={intl.formatMessage({ id: 'transaction.lossList.tableAriaLabel', defaultMessage: 'Loss transactions table' })} className="min-w-full">
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
                    <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <Icon icon="solar:warning-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">
                        {intl.formatMessage({ id: 'transaction.lossList.emptyState', defaultMessage: 'No loss transactions found.' })}
                      </span>
                    </EmptyState>
                  )}
                >
                  {isLoading || isFetching ? (
                    <Table.Row id="loading-row">
                      <Table.Cell className="py-10 text-center" colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({ id: 'transaction.lossList.loading', defaultMessage: 'Loading loss transactions...' })}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.original.id} id={row.original.id} className="hover:bg-surface/50 cursor-default">
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
        </Card.Content>
      </Card>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-90">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{intl.formatMessage({ id: 'transaction.lostList.deleteModalTitle', defaultMessage: 'Delete Loss Transaction' })}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  {intl.formatMessage({ id: 'transaction.lostList.deleteModalBody', defaultMessage: 'Are you sure you want to delete loss transaction {transactionId}? This will only work when the status is still DRAFT.' }, { transactionId: deletingRowId })}
                </p>
              </Modal.Body>
              <Modal.Footer className="flex items-center justify-end gap-2">
                <Button variant="secondary" onPress={() => setDeleteModalOpen(false)}>
                  {intl.formatMessage({ id: 'transaction.lostList.cancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button variant="danger" onPress={handleDelete} isDisabled={isDeleting}>
                  {isDeleting ? intl.formatMessage({ id: 'transaction.lostList.deleting', defaultMessage: 'Deleting...' }) : intl.formatMessage({ id: 'transaction.lostList.delete', defaultMessage: 'Delete' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
