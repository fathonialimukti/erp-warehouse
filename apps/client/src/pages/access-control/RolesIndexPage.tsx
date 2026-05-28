import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Modal, SearchField, Table, Tooltip } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../lib/trpc';
import { hasPermissionAtom } from '../../lib/atoms';
import { useAtomValue } from 'jotai';

function RolesIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<{ id: string; name: string } | null>(null);

  const { data: rolesResponse } = useQuery({
    queryKey: ['roleList', { search }],
    queryFn: () => trpcClient.accessControl.role.list.query({ search, page: 1, limit: 100 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => trpcClient.accessControl.role.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roleList'] });
      setDeleteModalOpen(false);
      setRoleToDelete(null);
    },
  });

  const roles = rolesResponse?.data ?? [];

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const canCreate = hasPermission('role@create');
  const canUpdate = hasPermission('role@update');
  const canDelete = hasPermission('role@delete');

  const handleDelete = (role: { id: string; name: string }) => {
    setRoleToDelete(role);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!roleToDelete) return;
    deleteMutation.mutate(roleToDelete.id);
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
                  onPress={() => handleDelete(row.original)}
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
    <section
      className="space-y-4"
      data-ai-context={JSON.stringify({
        section: 'role-list',
        totalRecords: roles.length,
        visibleRows: roles.map((role) => ({ id: role.id, name: role.name, description: role.description })),
      })}
    >
      <Card>
        <Card.Header>
          <div className="flex w-full items-start justify-between gap-3">
            <div>
              <Card.Title>Access Control</Card.Title>
              <Card.Description>Manage roles and their permission assignments.</Card.Description>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-80">
                <SearchField
                  variant="secondary"
                  fullWidth
                  id="role-search"
                  value={searchInput}
                  onChange={setSearchInput}
                  aria-label={intl.formatMessage({ id: 'roles.index.search_placeholder', defaultMessage: 'Search role name or description' })}
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={intl.formatMessage({ id: 'roles.index.search_placeholder', defaultMessage: 'Search role name or description' })} />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
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

      <Modal isOpen={deleteModalOpen} onOpenChange={(open) => {
        setDeleteModalOpen(open);
        if (!open) setRoleToDelete(null);
      }}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {intl.formatMessage({ id: 'roles.index.delete_modal_title', defaultMessage: 'Delete Role' })}
                </Modal.Heading>
                <p className="mt-1 text-sm text-muted">
                  {intl.formatMessage(
                    { id: 'roles.index.delete_modal_body', defaultMessage: 'Are you sure you want to delete role {roleName}? This action cannot be undone.' },
                    { roleName: roleToDelete?.name ?? '' },
                  )}
                </p>
              </Modal.Header>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {intl.formatMessage({ id: 'roles.index.delete_cancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button variant="danger" onPress={handleConfirmDelete} isDisabled={deleteMutation.isPending}>
                  {deleteMutation.isPending
                    ? intl.formatMessage({ id: 'roles.index.delete_deleting', defaultMessage: 'Deleting...' })
                    : intl.formatMessage({ id: 'roles.index.delete_confirm', defaultMessage: 'Delete' })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export { RolesIndexPage };
