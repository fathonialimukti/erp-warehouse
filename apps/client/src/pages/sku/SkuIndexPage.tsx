import { useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { Button, Card, Dropdown, Input, Pagination, Separator, Spinner, Table } from '@heroui/react';
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
import { DeleteSkuDialog } from './_DeleteSku.tsx';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';

type SkuRow = {
  id: string;
  name: string;
  description: string | null;
  photo?: string | null;
  createdAt: string;
};

function SkuIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('sku@create');
  const canUpdate = hasPermission('sku@update');
  const canDelete = hasPermission('sku@delete');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [skuToDelete, setSkuToDelete] = useState<SkuRow | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['skuList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.sku.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const columns = useMemo<ColumnDef<SkuRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Kode SKU',
      },
      {
        id: 'name',
        header: 'Nama SKU',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <EntityPhoto src={row.original.photo} alt={row.original.name} />
            <div>
              <p className="text-sm font-medium text-foreground">{row.original.name}</p>
              <p className="text-xs text-muted">{row.original.id}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'description',
        header: intl.formatMessage({ id: 'sku.index.header_description', defaultMessage: 'Description' }),
        cell: ({ row }) => row.original.description ?? '-',
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
              <Dropdown.Menu aria-label="SKU actions">
                <Dropdown.Item key="view" onPress={() => navigate(`/skus/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  Lihat detail
                </Dropdown.Item>
                {canUpdate ? (
                  <Dropdown.Item key="edit" className="text-warning" onPress={() => navigate(`/skus/${row.original.id}/edit`)}>
                    <Icon icon="solar:pen-linear" className="size-4" />
                    Edit SKU
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
                        setSkuToDelete(row.original);
                        setDeleteModalOpen(true);
                      }}
                    >
                      <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                      {intl.formatMessage({ id: 'sku.index.action_delete', defaultMessage: 'Delete SKU' })}
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

  const returnToSkuList = async () => {
    if (!skuToDelete) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ['skuList'] });
    queryClient.removeQueries({ queryKey: ['skuDetail', skuToDelete.id] });
    setDeleteModalOpen(false);
    setSkuToDelete(null);
  };

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header>
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">SKU</h1>
              <Card.Description>{intl.formatMessage({ id: 'sku.index.description', defaultMessage: 'Manage SKU records. Each SKU can have multiple pallet types on the detail page.' })}</Card.Description>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <div className="w-full sm:w-80">
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={intl.formatMessage({ id: 'sku.index.search_placeholder', defaultMessage: 'Search SKU code/name/description' })}
                  variant="secondary"
                  fullWidth
                />
              </div>
              {canCreate ? (
                <Button variant="primary" onPress={() => navigate('/skus/new')}>
                  {intl.formatMessage({ id: 'sku.index.create_button', defaultMessage: 'Add SKU' })}
                </Button>
              ) : null}
            </div>
          </div>
        </Card.Header>

        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="SKU table" onRowAction={(key) => navigate(`/skus/${String(key)}`)}>
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column key={header.id} isRowHeader={header.id === 'id'}>
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
                      <Icon icon="solar:box-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">{intl.formatMessage({ id: 'sku.index.empty_state', defaultMessage: 'No SKU data available.' })}</span>
                    </div>
                  )}
                >
                  {isLoading || isFetching ? (
                    <Table.Row id="loading-row">
                      <Table.Cell colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({ id: 'sku.index.loading', defaultMessage: 'Loading SKU data...' })}
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.original.id} id={row.original.id} className="cursor-pointer" >
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

      <DeleteSkuDialog
        id={skuToDelete?.id ?? ''}
        name={skuToDelete?.name}
        isOpen={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onDeleted={returnToSkuList}
      />
    </section>
  );
}

export { SkuIndexPage };
