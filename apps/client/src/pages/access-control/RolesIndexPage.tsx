import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Input, Table, Tooltip } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../lib/trpc';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAtomValue } from 'jotai';

export default function RolesIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const { data: rolesResponse } = useQuery({
    queryKey: ['roleList', { search }],
    queryFn: () => trpcClient.role.list.query({ search, page: 1, limit: 100 }),
  });

  const roles = rolesResponse?.data ?? [];

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const canCreate = hasPermission('role_create');
  const canUpdate = hasPermission('role_update');
  const canDelete = hasPermission('role_delete');

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this role?')) {
      await trpcClient.role.delete.mutate({ id });
      queryClient.invalidateQueries({ queryKey: ['roleList'] });
    }
  };

  const columns = useMemo(
    () => [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'description', header: 'Description' },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }: { row: any }) => (
          <div className="flex items-center gap-1">
            {canUpdate && (
              <Tooltip delay={0}>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  onPress={() => navigate(`/access-control/roles/${row.original.id}/edit`)}
                  aria-label="Edit role"
                >
                  <Icon icon="solar:pen-linear" className="size-4" />
                </Button>
                <Tooltip.Content>
                  <p>Edit role</p>
                </Tooltip.Content>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip delay={0}>
                <Button
                  size="sm"
                  variant="danger"
                  isIconOnly
                  onPress={() => handleDelete(row.original.id)}
                  aria-label="Delete role"
                >
                  <Icon icon="solar:trash-bin-minimalistic-linear" className="size-4" />
                </Button>
                <Tooltip.Content>
                  <p>Delete role</p>
                </Tooltip.Content>
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    [navigate, canUpdate, canDelete],
  );

  const table = useReactTable({
    data: roles,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header>
          <div className="flex w-full items-start justify-between gap-3">
            <div>
              <Card.Title>Access Control</Card.Title>
              <Card.Description>Manage roles and their permission assignments.</Card.Description>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-80">
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={intl.formatMessage({ id: 'roles.index.search_placeholder', defaultMessage: 'Search role name or description' })}
                  variant="secondary"
                  fullWidth
                />
              </div>
              <Button onPress={() => navigate('/access-control/roles/new')} isDisabled={!canCreate}>
                {intl.formatMessage({ id: 'roles.index.create_button', defaultMessage: 'Create Role' })}
              </Button>
            </div>
          </div>
        </Card.Header>

        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Roles table">
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column key={header.id}>
                        <span className="font-semibold">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      </Table.Column>
                    )),
                  )}
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <Icon icon="solar:shield-user-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">
                        {search ? 'Tidak ada role yang cocok dengan pencarian.' : 'Belum ada data role.'}
                      </span>
                    </div>
                  )}
                >
                  {table.getRowModel().rows.map((row) => (
                    <Table.Row key={row.id} id={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <Table.Cell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>
    </section>
  );
}
