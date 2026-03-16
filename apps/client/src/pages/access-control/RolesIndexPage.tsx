import { useMemo, useState } from 'react';
import { Button, Card, Table } from '@heroui/react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router';

type Role = { id: string; name: string; description: string };

const SAMPLE_ROLES: Role[] = [
  { id: 'ROL-001', name: 'System Admin', description: 'Full system access' },
  { id: 'ROL-002', name: 'Warehouse Manager', description: 'Manage warehouse operations and approvals' },
  { id: 'ROL-003', name: 'Warehouse Operator', description: 'Perform warehouse daily operations' },
  { id: 'ROL-004', name: 'Approver', description: 'Approve warehouse transactions' },
];

export default function RolesIndexPage() {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'description', header: 'Description' },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onPress={() => navigate(`/access-control/${row.original.id}/edit`)}>
              Edit
            </Button>
          </div>
        ),
      },
    ],
    [navigate],
  );

  const table = useReactTable({
    data: SAMPLE_ROLES,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex items-start justify-between gap-3">
          <div>
            <Card.Title className="text-2xl">Access Control</Card.Title>
            <Card.Description>Manage roles and their permission assignments.</Card.Description>
          </div>
          <Button variant="primary" onPress={() => navigate('/access-control/new')}>
            Create Role
          </Button>
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
                <Table.Body renderEmptyState={() => 'No roles found.'}>
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
