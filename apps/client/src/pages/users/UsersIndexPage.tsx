import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Dropdown, EmptyState, Input, Modal, Pagination, Separator, Spinner, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef, type PaginationState, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EntityPhoto from '../../components/EntityPhoto';
import { trpcClient } from '../../lib/trpc';

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  photo?: string | null;
  role: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
};

export default function UsersIndexPage() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserRow | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['userList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.user.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <EntityPhoto src={row.original.photo} alt={row.original.name ?? row.original.email} />
            <div>
              <p className="text-sm font-medium text-foreground">{row.original.name ?? '-'}</p>
              <p className="text-xs text-muted">{row.original.email}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        cell: ({ row }) => row.original.role?.name ?? '-',
      },
      {
        accessorKey: 'createdAt',
        header: 'Created At',
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
              <Dropdown.Menu aria-label="User actions">
                <Dropdown.Item key="view" onPress={() => navigate(`/users/${row.original.id}`)}>
                  <Icon icon="solar:eye-linear" className="size-4" />
                  View
                </Dropdown.Item>
                <Dropdown.Item key="edit" className="text-warning" onPress={() => navigate(`/users/${row.original.id}/edit`)}>
                  <Icon icon="solar:pen-linear" className="size-4" />
                  Edit
                </Dropdown.Item>
                <Separator />
                <Dropdown.Item
                  key="delete"
                  variant="danger"
                  className="text-danger"
                  onPress={() => {
                    setUserToDelete(row.original);
                    setDeleteModalOpen(true);
                  }}
                >
                  <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                  Delete
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [navigate],
  );

  const table = useReactTable({
    data: data?.data ?? [],
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
  const pageEnd = totalEntries === 0 ? 0 : pageStart + (data?.data.length ?? 0) - 1;

  const handleDelete = async () => {
    if (!userToDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await trpcClient.user.delete.mutate({ id: userToDelete.id });
      await queryClient.invalidateQueries({ queryKey: ['userList'] });
      queryClient.removeQueries({ queryKey: ['userDetail', userToDelete.id] });
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex items-start justify-between gap-3">
          <div>
            <Card.Title className="text-2xl">Users</Card.Title>
            <Card.Description>Manage system users and their assigned roles.</Card.Description>
          </div>
          <div className="flex items-center gap-3">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={intl.formatMessage({ id: 'users.index.searchPlaceholder', defaultMessage: 'Search by name, email, or role' })}
              variant="secondary"
              className="w-80"
            />
            <Button variant="primary" onPress={() => navigate('/users/new')}>
              {intl.formatMessage({ id: 'users.index.createButton', defaultMessage: 'Create User' })}
            </Button>
          </div>
        </Card.Header>

        <Card.Content className="space-y-4">
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Users table" className="min-w-full" onRowAction={(key) => navigate(`/users/${String(key)}`)}>
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column key={header.id} isRowHeader={header.id === 'user'}>
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
                      <Icon icon="solar:users-group-two-rounded-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">
                        {search ? intl.formatMessage({ id: 'users.index.noResults', defaultMessage: 'No users match the search.' }) : intl.formatMessage({ id: 'users.index.emptyState', defaultMessage: 'No user data available.' })}
                      </span>
                    </EmptyState>
                  )}
                >
                  {isLoading || isFetching ? (
                    <Table.Row id="loading-row">
                      <Table.Cell className="py-10 text-center" colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({ id: 'users.index.loading', defaultMessage: 'Loading user data...' })}
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
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-90">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Delete User</Modal.Heading>
                <p className="mt-1 text-sm text-muted">
                  Are you sure you want to delete user "{userToDelete?.name ?? userToDelete?.email}"? This action cannot be undone.
                </p>
              </Modal.Header>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDeleteModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onPress={() => void handleDelete()} isDisabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
