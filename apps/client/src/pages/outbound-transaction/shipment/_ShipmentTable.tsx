import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Dropdown, Pagination, Separator, Table } from '@heroui/react';
import type { SortDescriptor } from '@heroui/react';
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

interface ShipmentRow {
  id: string;
  documentNumber?: string | null;
  date: string;
  approvalStatus: string;
  recipient?: string | null;
  reference?: string | null;
  createdBy?: { name?: string | null } | null;
  approvedBy?: { name?: string | null } | null;
}

interface ShipmentListResult {
  data: ShipmentRow[];
  meta: { total: number; totalPages: number };
}

// Sortable column keys — must match SHIPMENT_SORTABLE_FIELDS on the server.
const SORTABLE_COLUMNS = ['documentNumber', 'date', 'recipient', 'approvalStatus'] as const;
type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

// Convert TanStack SortingState → React Aria SortDescriptor
function toSortDescriptor(sorting: SortingState): SortDescriptor | undefined {
  const first = sorting[0];
  if (!first) return undefined;
  return { column: first.id, direction: first.desc ? 'descending' : 'ascending' };
}

// Convert React Aria SortDescriptor → TanStack SortingState
function toSortingState(descriptor: SortDescriptor): SortingState {
  return [{ id: descriptor.column as string, desc: descriptor.direction === 'descending' }];
}

export const ShipmentTable = () => {
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
  const canCreate = hasPermission('shipment@create');
  const canUpdate = hasPermission('shipment@update');
  const canDelete = hasPermission('shipment@delete');

  const activeSort = sorting[0];
  const sortBy = activeSort?.id as SortableColumn | undefined;
  const sortOrder = activeSort ? (activeSort.desc ? 'desc' : 'asc') : undefined;
  const statusValue = statusFilter === STATUS_FILTER_ALL_VALUE ? undefined : (statusFilter as 'DRAFT' | 'PROPOSED' | 'APPROVED' | 'REJECTED');

  const { data, isLoading, isFetching } = useQuery<ShipmentListResult>({
    queryKey: ['shipmentList', pagination.pageIndex, pagination.pageSize, search, sortBy, sortOrder, statusFilter],
    queryFn: () =>
      trpcClient.shipment.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
        sortBy: sortBy,
        sortOrder: sortOrder,
        approvalStatus: statusValue,
      }),
  });

  const rows = data?.data ?? [];

  const columns = useMemo<ColumnDef<ShipmentRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: intl.formatMessage({ id: 'shipment.col_document_number', defaultMessage: 'Document Number' }),
        cell: ({ row }) => row.original.documentNumber ?? '-',
      },
      {
        accessorKey: 'date',
        header: intl.formatMessage({ id: 'shipment.col_date', defaultMessage: 'Date' }),
        cell: ({ row }) => intl.formatDate(new Date(row.original.date)),
      },
      {
        accessorKey: 'recipient',
        header: intl.formatMessage({ id: 'shipment.col_recipient', defaultMessage: 'Recipient' }),
        cell: ({ row }) => row.original.recipient ?? '-',
      },
      {
        accessorKey: 'reference',
        enableSorting: false,
        header: intl.formatMessage({ id: 'shipment.col_reference', defaultMessage: 'Reference' }),
        cell: ({ row }) => row.original.reference ?? '-',
      },
      {
        accessorKey: 'approvalStatus',
        header: intl.formatMessage({ id: 'shipment.col_status', defaultMessage: 'Status' }),
        cell: ({ row }) => <ApprovalStatusChip status={row.original.approvalStatus} />,
      },
      {
        accessorKey: 'createdBy',
        enableSorting: false,
        header: intl.formatMessage({ id: 'shipment.col_created_by', defaultMessage: 'Created By' }),
        cell: ({ row }) => row.original.createdBy?.name ?? '-',
      },
      {
        accessorKey: 'approvedBy',
        enableSorting: false,
        header: intl.formatMessage({ id: 'shipment.col_approved_by', defaultMessage: 'Approved By' }),
        cell: ({ row }) => row.original.approvedBy?.name ?? intl.formatMessage({ id: 'shipment.col_pending', defaultMessage: 'Pending' }),
      },
      {
        id: 'actions',
        enableSorting: false,
        header: '',
        cell: ({ row }) => (
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="ghost" isIconOnly aria-label={intl.formatMessage({ id: 'shipment.actions_aria', defaultMessage: 'Actions' })}>
                <Icon icon="solar:menu-dots-bold" className="size-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label={intl.formatMessage({ id: 'shipment.actions_menu_aria', defaultMessage: 'Shipment actions' })}>
                <Dropdown.Item onPress={() => navigate(`/outbound-transaction/shipment/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'shipment.action_detail', defaultMessage: 'Detail' })}
                </Dropdown.Item>
                {canUpdate && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <Dropdown.Item onPress={() => navigate(`/outbound-transaction/shipment/${row.original.id}/edit`)}>
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({ id: 'shipment.action_edit', defaultMessage: 'Edit' })}
                  </Dropdown.Item>
                ) : null}
                {canDelete && ['DRAFT', 'REJECTED'].includes(row.original.approvalStatus) ? (
                  <>
                    <Separator />
                    <Dropdown.Item variant="danger" onPress={() => { setDeletingRowId(row.original.id); setDeleteModalOpen(true); }}>
                      <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                      {intl.formatMessage({ id: 'shipment.action_delete', defaultMessage: 'Delete' })}
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
      await trpcClient.shipment.delete.mutate({ id: deletingRowId });
      await queryClient.invalidateQueries({ queryKey: ['shipmentList'] });
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
        section: 'shipment-list',
        totalRecords: totalEntries,
        currentPage,
        totalPages,
        visibleRows: rows.map((row) => ({ id: row.id, documentNumber: row.documentNumber, recipient: row.recipient, status: row.approvalStatus })),
      })}
    >
      <TableToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder={intl.formatMessage({ id: 'shipment.search_placeholder', defaultMessage: 'Search by ID, recipient...' })}
        createLabel={intl.formatMessage({ id: 'shipment.create_button', defaultMessage: 'Create' })}
        onCreate={canCreate ? () => navigate('/outbound-transaction/shipment/new') : undefined}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusFilterAriaLabel={intl.formatMessage({ id: 'shipment.filter_status_aria', defaultMessage: 'Filter by approval status' })}
      />
      <Table>
        <Table.ScrollContainer>
          <Table.Content
            aria-label={intl.formatMessage({ id: 'shipment.table_aria', defaultMessage: 'Shipments' })}
            sortDescriptor={toSortDescriptor(sorting)}
            onSortChange={(descriptor) => setSorting(toSortingState(descriptor))}
            onRowAction={(key) => navigate(`/outbound-transaction/shipment/${String(key)}`)}
          >
            <Table.Header>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <Table.Column
                    key={header.id}
                    id={header.id}
                    isRowHeader={header.column.id === 'documentNumber'}
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
                  icon="solar:arrow-to-top-up-bold"
                  message={intl.formatMessage({ id: 'shipment.empty_state', defaultMessage: 'No shipments found.' })}
                />
              )}
            >
              {isLoading || isFetching ? (
                <TableLoadingRow
                  colSpan={columns.length}
                  message={intl.formatMessage({ id: 'shipment.loading', defaultMessage: 'Loading shipments...' })}
                />
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
            <Pagination.Summary>{pageStart} to {pageEnd} of {totalEntries} results</Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous isDisabled={!table.getCanPreviousPage()} onPress={() => table.previousPage()}>
                  <Pagination.PreviousIcon />
                  {intl.formatMessage({ id: 'shipment.pagination_prev', defaultMessage: 'Prev' })}
                </Pagination.Previous>
              </Pagination.Item>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Pagination.Item key={page}>
                  <Pagination.Link isActive={page === currentPage} onPress={() => table.setPageIndex(page - 1)}>
                    {page}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next isDisabled={!table.getCanNextPage()} onPress={() => table.nextPage()}>
                  {intl.formatMessage({ id: 'shipment.pagination_next', defaultMessage: 'Next' })}
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </Table.Footer>
      </Table>

      <TransactionDeleteModal
        title={intl.formatMessage({ id: 'shipment.delete_modal_title', defaultMessage: 'Delete Shipment' })}
        body={intl.formatMessage({ id: 'shipment.delete_modal_body', defaultMessage: 'Are you sure you want to delete this shipment?' })}
        confirmLabel={intl.formatMessage({ id: 'shipment.delete_confirm', defaultMessage: 'Delete' })}
        isDeleting={isDeleting}
        isOpen={deleteModalOpen}
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => { setDeleteModalOpen(open); if (!open) setDeletingRowId(null); }}
      />
    </section>
  );
};
