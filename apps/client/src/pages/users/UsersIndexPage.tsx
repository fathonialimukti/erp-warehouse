import { useMemo, useState } from 'react';
import { Button, Card, Dropdown, Header, Label, Separator, Table } from '@heroui/react';
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
              <Button size="sm" variant="ghost" aria-label="Row actions">
                <Icon icon="solar:menu-dots-bold" className="h-4 w-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label="User actions"
                onAction={(key) => {
                  if (key === 'detail') navigate(`/users/${row.original.id}`);
                  if (key === 'edit') navigate(`/users/${row.original.id}/edit`);
                }}
              >
                <Dropdown.Section>
                  <Header>Actions</Header>
                  <Dropdown.Item id="detail" textValue="detail">
                    <Icon icon="solar:eye-linear" className="h-4 w-4" />
                    <Label>Detail</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="edit" textValue="edit">
                    <Icon icon="solar:pen-linear" className="h-4 w-4" />
                    <Label>Edit</Label>
                  </Dropdown.Item>
                </Dropdown.Section>
                <Separator />
                <Dropdown.Section>
                  <Header>Danger zone</Header>
                  <Dropdown.Item id="delete" textValue="delete" variant="danger">
                    <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4 text-danger" />
                    <Label>Delete</Label>
                  </Dropdown.Item>
                </Dropdown.Section>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [navigate],
  );

  const table = useReactTable({
    data: SAMPLE_USERS,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageInfo = `Page ${table.getState().pagination.pageIndex + 1} of ${Math.max(table.getPageCount(), 1)}`;

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex items-start justify-between gap-3">
          <div>
            <Card.Title className="text-2xl">Users</Card.Title>
            <Card.Description>Manage system users and their assigned roles.</Card.Description>
          </div>
          <Button variant="primary" onPress={() => navigate('/users/new')}>
            Create User
          </Button>
        </Card.Header>

        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Users table">
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
                <Table.Body renderEmptyState={() => 'No users found.'}>
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
    </section>
  );
}
