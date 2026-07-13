import { useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { Button, Card, Dropdown, SearchField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAiFillForm } from '../../components/AiAssistant/useAiFillForm';
import { DataTable } from '../../components/DataTable';
import { useListPage } from '../../lib/useListPage';
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
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // AI fill form — set the search box; the hook debounces + resets pagination.
  useAiFillForm({
    search: (v) => list.setSearchInput(String(v ?? '')),
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

  const list = useListPage<Product>({
    queryKey: ['productList'],
    queryFn: (input) =>
      trpcClient.product.list.query({
        page: input.page,
        limit: input.limit,
        search: input.search,
      }),
    columns,
  });

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
        totalRecords: list.totalEntries,
        currentPage: list.currentPage,
        totalPages: list.totalPages,
        visibleRows: list.query.data?.data.map(p => ({ id: p.id, name: p.name, code: p.code })) ?? [],
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
                  value={list.searchInput}
                  onChange={list.setSearchInput}
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
          <DataTable<Product>
            table={list.table}
            columns={columns}
            isLoading={list.isLoading || list.isFetching}
            emptyState={{
              icon: 'solar:box-minimalistic-linear',
              message: intl.formatMessage({ id: 'product.index.empty_state', defaultMessage: 'No products available.' }),
            }}
            loadingMessage={intl.formatMessage({ id: 'product.index.loading', defaultMessage: 'Loading product data...' })}
            ariaLabel="Product table"
            rowHeaderId="code"
            onRowAction={(id) => navigate(`/products/${id}`)}
            totalEntries={list.totalEntries}
            pageStart={list.pageStart}
            pageEnd={list.pageEnd}
          />
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
