import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Input, Table, Tooltip } from '@heroui/react';
import { Icon } from '@iconify/react';
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
  const intl = useIntl();
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Filter roles based on search
  const filteredRoles = useMemo(() => {
    if (!search) return SAMPLE_ROLES;
    
    return SAMPLE_ROLES.filter(role => 
      role.name.toLowerCase().includes(search.toLowerCase()) ||
      role.description.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'description', header: 'Description' },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
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
          </div>
        ),
      },
    ],
    [navigate],
  );

  const table = useReactTable({
    data: filteredRoles,
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
              <Button onPress={() => navigate('/access-control/roles/new')}>
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
