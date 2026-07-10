import { useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { Button, Card, Dropdown, Pagination, SearchField, Spinner, Table } from '@heroui/react';
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
import { hasPermissionAtom } from '../../lib/atoms';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { trpcClient } from '../../lib/trpc';
import { DeleteProductDialog } from './_DeleteProduct';

type Product = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  baseUnit: string;
  packageName: string;
  packagesPerPallet: number;
  quantityPerPackage: string | number;
  packageUnit: string;
  createdAt: string;
};

function ProductIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('product@create');
  const canUpdate = hasPermission('product@update');
  const canDelete = hasPermission('product@delete');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // AI fill form
  useAiFillForm({
    search: (v) => { const s = String(v ?? ''); setSearchInput(s); setSearch(s); setPagination((p) => ({ ...p, pageIndex: 0 })); },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['productList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.product.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        accessorKey: 'code',
        header: intl.formatMessage({ id: 'product.index.header_code', defaultMessage: 'Code' }),
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium text-primary">
            {row.original.code ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: intl.formatMessage({ id: 'product.index.header_name', defaultMessage: 'Name' }),
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-medium text-foreground">{row.original.name}</p>
            {row.original.description ? (
              <p className="text-xs text-muted line-clamp-1">{row.original.description}</p>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: 'baseUnit',
        header: intl.formatMessage({ id: 'product.index.header_base_unit', defaultMessage: 'Base Unit' }),
        cell: ({ row }) => row.original.baseUnit,
      },
      {
        accessorKey: 'packaging',
        header: intl.formatMessage({ id: 'product.index.header_packaging', defaultMessage: 'Packaging' }),
        cell: ({ row }) => (
          <span className="text-sm text-muted">
            {row.original.packagesPerPallet} {row.original.packageName} × {row.original.quantityPerPackage} {row.original.packageUnit}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: intl.formatMessage({ id: 'product.index.header_created', defaultMessage: 'Created' }),
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
              <Dropdown.Menu aria-label="Product actions">
                <Dropdown.Item key="view" onPress={() => navigate(`/products/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  {intl.formatMessage({ id: 'product.index.action_view', defaultMessage: 'View details' })}
                </Dropdown.Item>
                {canUpdate ? (
                  <Dropdown.Item key="edit" className="text-warning" onPress={() => navigate(`/products/${row.original.id}/edit`)}>
                    <Icon icon="solar:pen-linear" className="size-4" />
                    {intl.formatMessage({ id: 'product.index.action_edit', defaultMessage: 'Edit product' })}
                  </Dropdown.Item>
                ) : null}
                {canDelete ? (
                  <Dropdown.Item
                    key="delete"
                    variant="danger"
                    className="text-danger"
                    onPress={() => {
                      setProductToDelete(row.original);
                      setDeleteModalOpen(true);
                    }}
                  >
                    <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                    {intl.formatMessage({ id: 'product.index.action_delete', defaultMessage: 'Delete product' })}
                  </Dropdown.Item>
                ) : null}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [intl, navigate, canUpdate, canDelete]
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

  const handleDeleted = async () => {
    await queryClient.invalidateQueries({ queryKey: ['productList'] });
    if (productToDelete) {
      queryClient.removeQueries({ queryKey: ['productDetail', productToDelete.id] });
    }
    setDeleteModalOpen(false);
    setProductToDelete(null);
  };

  return (
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: 'product-list',
        totalRecords: totalEntries,
        currentPage,
        totalPages,
        visibleRows: data?.data.map(p => ({ id: p.id, name: p.name, code: p.code })) ?? [],
      })}
    >
      <Card>
        <Card.Header>
          <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {intl.formatMessage({ id: 'product.index.title', defaultMessage: 'Products' })}
              </h1>
              <Card.Description>
                {intl.formatMessage({ id: 'product.index.description', defaultMessage: 'Manage finished goods products.' })}
              </Card.Description>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
              <div className="w-full sm:w-80">
                <SearchField
                  variant="secondary"
                  fullWidth
                  id="product-search"
                  value={searchInput}
                  onChange={setSearchInput}
                  aria-label={intl.formatMessage({ id: 'product.index.search_placeholder', defaultMessage: 'Search product name, code, description' })}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={intl.formatMessage({ id: 'product.index.search_placeholder', defaultMessage: 'Search product name, code, description' })} />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
              {canCreate ? (
                <Button variant="primary" onPress={() => navigate('/products/new')}>
                  <Icon icon="material-symbols:add-2-rounded" className="size-4" />
                  {intl.formatMessage({ id: 'product.index.create_button', defaultMessage: 'Add Product' })}
                </Button>
              ) : null}
            </div>
          </div>
        </Card.Header>

        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Product table" onRowAction={(key) => navigate(`/products/${String(key)}`)}>
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column key={header.id} isRowHeader={header.id === 'code'}>
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
                      <Icon icon="solar:box-minimalistic-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">
                        {intl.formatMessage({ id: 'product.index.empty_state', defaultMessage: 'No products available.' })}
                      </span>
                    </div>
                  )}
                >
                  {isLoading || isFetching ? (
                    <Table.Row id="loading-row">
                      <Table.Cell colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({ id: 'product.index.loading', defaultMessage: 'Loading product data...' })}
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

      <DeleteProductDialog
        id={productToDelete?.id ?? ''}
        name={productToDelete?.name}
        isOpen={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onDeleted={handleDeleted}
      />
    </section>
  );
}

export { ProductIndexPage };
