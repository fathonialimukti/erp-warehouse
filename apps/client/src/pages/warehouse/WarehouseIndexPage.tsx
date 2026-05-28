import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Dropdown, Modal, Pagination, SearchField, Separator, Spinner, Table } from '@heroui/react';
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
import { EntityPhoto } from '../../components/EntityPhoto';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';
type Warehouse = {
  id: string;
  name: string;
  address: string;
  photo?: string | null;
  totalCapacity: number | null;
  createdAt: string;
};

function WarehouseIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('warehouse@create');
  const canUpdate = hasPermission('warehouse@update');
  const canDelete = hasPermission('warehouse@delete');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['warehouseList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.warehouse.warehouse.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const columns = useMemo<ColumnDef<Warehouse>[]>(
    () => [
      {
        accessorKey: 'id',
        header: intl.formatMessage({ id: 'warehouse.index.header_warehouse_code', defaultMessage: 'Warehouse Code' }),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium text-primary">
            {row.original.id}
          </span>
        ),
      },
      {
        id: 'name',
        header: intl.formatMessage({ id: 'warehouse.index.header_warehouse_name', defaultMessage: 'Warehouse Name' }),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <EntityPhoto src={row.original.photo} alt={row.original.name} />
            <div>
              <p className="text-sm font-medium text-foreground">{row.original.name}</p>
              <p className="text-xs text-muted">{row.original.address}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'address',
        header: intl.formatMessage({ id: 'warehouse.index.header_address', defaultMessage: 'Address' }),
      },
      {
        accessorKey: 'totalCapacity',
        header: intl.formatMessage({ id: 'warehouse.index.header_capacity', defaultMessage: 'Total Capacity' }),
        cell: ({ row }) => row.original.totalCapacity?.toLocaleString('id-ID') ?? '-',
      },
      {
        accessorKey: 'createdAt',
        header: 'Dibuat',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('id-ID'),
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
              <Dropdown.Menu aria-label="Warehouse actions">
                <Dropdown.Item
                  key="view"
                  onPress={() => navigate(`/warehouse/${row.original.id}`)}
                >
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'warehouse.index.action_view', defaultMessage: 'View details' })}
                </Dropdown.Item>
                {canUpdate ? (
                  <Dropdown.Item
                    key="edit"
                    className="text-warning"
                    onPress={() => navigate(`/warehouse/${row.original.id}/edit`)}
                  >
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({ id: 'warehouse.index.action_edit', defaultMessage: 'Edit warehouse' })}
                  </Dropdown.Item>
                ) : null}
                {canDelete ? (
                  <>
                    <Separator />
                    <Dropdown.Item
                      key="delete"
                      variant="danger"
                      className="text-danger"
                      onPress={() => {
                        setWarehouseToDelete(row.original);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                      {intl.formatMessage({ id: 'warehouse.index.action_delete', defaultMessage: 'Delete warehouse' })}
                    </Dropdown.Item>
                  </>
                ) : null}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [intl, navigate]
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: data?.meta.totalPages ?? 0,
    state: {
      pagination,
    },
  });

  const totalEntries = data?.meta.total ?? 0;
  const totalPages = Math.max(data?.meta.totalPages ?? 0, 1);
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageStart = totalEntries === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = totalEntries === 0 ? 0 : pageStart + (data?.data.length ?? 0) - 1;

  const handleDelete = async () => {
    if (!warehouseToDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await trpcClient.warehouse.warehouse.delete.mutate({ id: warehouseToDelete.id });
      await queryClient.invalidateQueries({ queryKey: ['warehouseList'] });
      queryClient.removeQueries({ queryKey: ['warehouseDetail', warehouseToDelete.id] });
      queryClient.removeQueries({ queryKey: ['warehouseLokasi', warehouseToDelete.id] });
      setDeleteModalOpen(false);
      setWarehouseToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: 'warehouse-list',
        totalRecords: totalEntries,
        currentPage,
        totalPages,
        visibleRows: data?.data.map(w => ({ id: w.id, name: w.name, address: w.address })) ?? [],
      })}
    >
      <Card>
        <Card.Header>
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Warehouses</h1>
              <Card.Description>{intl.formatMessage({ id: 'warehouse.index.description', defaultMessage: 'Manage warehouses and view storage location tables on the detail page.' })}</Card.Description>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
              <div className="w-full sm:w-80">
                <SearchField
                  variant="secondary"
                  fullWidth
                  id="warehouse-search"
                  value={searchInput}
                  onChange={setSearchInput}
                  aria-label={intl.formatMessage({ id: 'warehouse.index.search_placeholder', defaultMessage: 'Search warehouse name or address' })}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={intl.formatMessage({ id: 'warehouse.index.search_placeholder', defaultMessage: 'Search warehouse name or address' })} />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
              {canCreate ? (
                <Button variant="primary" onPress={() => navigate('/warehouse/new')}>
                  <Icon icon="material-symbols:add-2-rounded" className="size-4" />
                  {intl.formatMessage({ id: 'warehouse.index.create_button', defaultMessage: 'Create Warehouse' })}
                </Button>
              ) : null}
            </div>
          </div>
        </Card.Header>

        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Warehouse table" onRowAction={(key) => navigate(`/warehouse/${String(key)}`)}>
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column key={header.id} isRowHeader={header.id === 'name'}>
                        <span className="font-semibold">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      </Table.Column>
                    ))
                  )}
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <Icon icon="solar:buildings-2-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">
                        {intl.formatMessage({ id: 'warehouse.index.empty_state', defaultMessage: 'No warehouses available.' })}
                      </span>
                    </div>
                  )}
                >
                  {isLoading || isFetching ? (
                    <Table.Row id="loading-row">
                      <Table.Cell colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({ id: 'warehouse.index.loading', defaultMessage: 'Loading warehouse data...' })}
                        </div>
                      </Table.Cell>
                    </Table.Row>
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
        </Card.Content>
      </Card>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{intl.formatMessage({ id: 'warehouse.index.delete_modal_title', defaultMessage: 'Delete Warehouse' })}</Modal.Heading>
                <p className="mt-1 text-sm text-muted">
                  {intl.formatMessage({ id: 'warehouse.index.delete_modal_body', defaultMessage: 'Are you sure you want to delete warehouse "{warehouseName}"? This action cannot be undone.' }, { warehouseName: warehouseToDelete?.name })}
                </p>
              </Modal.Header>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {intl.formatMessage({ id: 'warehouse.index.cancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button variant="danger" onPress={() => void handleDelete()} isDisabled={isDeleting}>
                  {isDeleting ? intl.formatMessage({ id: 'warehouse.index.deleting', defaultMessage: 'Deleting...' }) : intl.formatMessage({ id: 'warehouse.index.delete', defaultMessage: 'Delete' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export { WarehouseIndexPage };
