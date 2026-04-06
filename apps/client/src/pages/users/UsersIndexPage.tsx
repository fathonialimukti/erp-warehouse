import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Dropdown, EmptyState, Input, Modal, Separator, Table } from '@heroui/react';
import { Icon } from '@iconify/react';

import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

const SAMPLE_USERS: User[] = [
  { id: 'USR-001', name: 'Admin', email: 'admin@mail.com', role: 'System Admin', createdAt: '2026-03-01' },
  { id: 'USR-002', name: 'Warehouse Manager', email: 'manager@mail.com', role: 'Warehouse Manager', createdAt: '2026-03-02' },
  { id: 'USR-003', name: 'Operator One', email: 'operator@mail.com', role: 'Warehouse Operator', createdAt: '2026-03-03' },
  { id: 'USR-004', name: 'Approver One', email: 'approver@mail.com', role: 'Approver', createdAt: '2026-03-04' },
];

export default function UsersIndexPage() {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!search) return SAMPLE_USERS;
    
    return SAMPLE_USERS.filter(user => 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.role.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const columns = useMemo<ColumnDef<User>[]>(
    () => [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'email', header: 'Email' },
      { accessorKey: 'role', header: 'Role' },
      { accessorKey: 'createdAt', header: 'Created At' },
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
                <Dropdown.Item
                  key="view"
                  onPress={() => navigate(`/users/${row.original.id}`)}
                >
                  <Icon icon="solar:eye-linear" className="size-4" />
                  View
                </Dropdown.Item>
                <Dropdown.Item
                  key="edit"
                  className="text-warning"
                  onPress={() => navigate(`/users/${row.original.id}/edit`)}
                >
                  <Icon icon="solar:pen-linear" className="size-4" />
                  Edit
                </Dropdown.Item>
                <Separator />
                <Dropdown.Item
                  key="delete"
                  variant="danger"
                  onPress={() => {
                    setUserToDelete(row.original);
                    setDeleteModalOpen(true);
                  }}

                  className='text-danger'
                >
                  <Icon icon="solar:trash-bin-trash-linear" className="size-4 " />
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
    data: filteredUsers,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleDelete = () => {
    if (userToDelete) {
      // TODO: Implement actual delete logic with API call
      console.log('Deleting user:', userToDelete.id);
      setDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  const pageInfo = `Page ${table.getState().pagination.pageIndex + 1} of ${Math.max(table.getPageCount(), 1)}`;

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
              placeholder="Cari nama, email, atau role"
              variant="secondary"
              className="w-80"
            />
            <Button variant="primary" onPress={() => navigate('/users/new')}>
              Create User
            </Button>
          </div>
        </Card.Header>

        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Users table" onRowAction={(key) => navigate(`/users/${String(key)}`)}>
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
                    <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <Icon icon="solar:users-group-two-rounded-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">
                        {search ? 'Tidak ada user yang cocok dengan pencarian.' : 'Belum ada data user.'}
                      </span>
                    </EmptyState>
                  )}
                >
                  {table.getRowModel().rows.map((row) => (
                    <Table.Row key={row.original.id} id={row.original.id} className="cursor-pointer">
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
            <Table.Footer className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{pageInfo}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onPress={() => table.previousPage()} isDisabled={!table.getCanPreviousPage()}>
                  Previous
                </Button>
                <Button size="sm" variant="ghost" onPress={() => table.nextPage()} isDisabled={!table.getCanNextPage()}>
                  Next
                </Button>
              </div>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-[360px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Delete User</Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  Are you sure you want to delete user "{userToDelete?.name}"? This action cannot be undone.
                </p>
              </Modal.Header>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDeleteModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onPress={handleDelete}>
                  Delete
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
