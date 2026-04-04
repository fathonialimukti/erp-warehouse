import { useMemo, useState } from 'react';
import { Button, Card, Table } from '@heroui/react';

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
    ],
    [],
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
                <Table.Body renderEmptyState={() => 'No users found.'}>
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
    </section>
  );
}
