# Index Page Template

File: `apps/client/src/pages/{domain}/{Domain}IndexPage.tsx`

```tsx
import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Pagination, Spinner, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';

type {Domain}Row = {
  id: string;
  name: string;
  // Add other list fields here
  createdAt: string;
};

export function {Domain}IndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canCreate = hasPermission('{domain}@create');
  const canUpdate = hasPermission('{domain}@update');
  const canDelete = hasPermission('{domain}@delete');

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{Domain}Row | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['{domain}List', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.{namespace}.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const columns = useMemo<ColumnDef<{Domain}Row>[]>(
    () => [
      {
        accessorKey: 'id',
        header: intl.formatMessage({ id: '{domain}.index.header_id', defaultMessage: 'ID' }),
        cell: ({ row }) => (
          <span>{row.original.id}</span>
        ),
      },
      {
        accessorKey: 'name',
        header: intl.formatMessage({ id: '{domain}.index.header_name', defaultMessage: 'Name' }),
      },
      // Add more columns for domain-specific fields
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onPress={() => navigate(`/{domain}/${row.original.id}`)}
            >
              <Icon icon="solar:eye-linear" />
            </Button>
            {(canUpdate || canDelete) && (
              <Dropdown>
                <DropdownTrigger>
                  <Button size="sm" variant="ghost" isIconOnly>
                    <Icon icon="solar:menu-dots-bold" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu>
                  {canUpdate ? (
                    <DropdownItem
                      key="edit"
                      onPress={() => navigate(`/{domain}/${row.original.id}/edit`)}
                    >
                      {intl.formatMessage({ id: 'common.action.edit', defaultMessage: 'Edit' })}
                    </DropdownItem>
                  ) : null}
                  {canDelete ? (
                    <DropdownItem
                      key="delete"
                      color="danger"
                      onPress={() => {
                        setItemToDelete(row.original);
                        setDeleteModalOpen(true);
                      }}
                    >
                      {intl.formatMessage({ id: 'common.action.delete', defaultMessage: 'Delete' })}
                    </DropdownItem>
                  ) : null}
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
        ),
      },
    ],
    [intl, navigate, canUpdate, canDelete],
  );

  const table = useReactTable({
    data: (data?.data ?? []) as {Domain}Row[],
    columns,
    pageCount: data?.meta?.totalPages ?? 0,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const handleDelete = async () => {
    if (!itemToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await trpcClient.{namespace}.delete.mutate({ id: itemToDelete.id });
      await queryClient.invalidateQueries({ queryKey: ['{domain}List'] });
      setDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          {intl.formatMessage({ id: '{domain}.index.title', defaultMessage: '{Domain}s' })}
        </h1>
        {canCreate && (
          <Button color="primary" onPress={() => navigate('/{domain}/create')}>
            <Icon icon="solar:add-circle-linear" />
            {intl.formatMessage({ id: '{domain}.index.action_create', defaultMessage: 'Add {Domain}' })}
          </Button>
        )}
      </div>

      <Card>
        <div className="p-4">
          <Input
            placeholder={intl.formatMessage({ id: 'common.search.placeholder', defaultMessage: 'Search...' })}
            value={searchInput}
            onValueChange={setSearchInput}
            startContent={<Icon icon="solar:magnifer-linear" />}
            isClearable
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            <Table aria-label="{Domain} list">
              <TableHeader>
                {table.getHeaderGroups().map((hg) =>
                  hg.headers.map((header) => (
                    <TableColumn key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableColumn>
                  )),
                )}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {(data?.meta?.totalPages ?? 0) > 1 && (
              <div className="flex justify-center py-4">
                <Pagination
                  total={data?.meta?.totalPages ?? 1}
                  page={pagination.pageIndex + 1}
                  onChange={(page) => setPagination((prev) => ({ ...prev, pageIndex: page - 1 }))}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <ModalContent>
          <ModalHeader>
            {intl.formatMessage({ id: 'common.modal.confirm_delete_title', defaultMessage: 'Confirm Delete' })}
          </ModalHeader>
          <ModalBody>
            {intl.formatMessage(
              { id: '{domain}.index.delete_confirm_body', defaultMessage: 'Delete "{name}"? This cannot be undone.' },
              { name: itemToDelete?.name },
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onPress={() => setDeleteModalOpen(false)}>
              {intl.formatMessage({ id: 'common.action.cancel', defaultMessage: 'Cancel' })}
            </Button>
            <Button color="danger" isLoading={isDeleting} onPress={() => void handleDelete()}>
              {intl.formatMessage({ id: 'common.action.delete', defaultMessage: 'Delete' })}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  );
}

export default {Domain}IndexPage;
```

## Notes

- Replace `trpcClient.{namespace}.list.query(...)` with the correct router path. For nested routers use `trpcClient.warehouse.warehouse.list.query(...)`.
- `{Domain}Row` type should match the Prisma model fields returned by the `list` procedure.
- The `queryKey` must match what the detail and form pages invalidate.
