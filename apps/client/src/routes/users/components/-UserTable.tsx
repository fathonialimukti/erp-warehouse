import React from 'react'
import { Button, Pagination, Table, type SortDescriptor } from '@heroui/react'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { trpc } from '../../../utils/trpc'

export interface User {
  id: string
  name: string | null
  email: string
  role: {
    id: string
    name: string
  } | null
  createdAt: string
  updatedAt: string
}

interface UserTableProps {
  page: number
  limit: number
  search?: string
  onPageChange: (page: number) => void
}

function toSortDescriptor(sorting: SortingState): SortDescriptor | undefined {
  const first = sorting[0]
  if (!first) return undefined

  return {
    column: first.id,
    direction: first.desc ? 'descending' : 'ascending',
  }
}

function toSortingState(descriptor: SortDescriptor): SortingState {
  return [{ desc: descriptor.direction === 'descending', id: descriptor.column as string }]
}

export const UserTable: React.FC<UserTableProps> = ({
  page,
  limit,
  search,
  onPageChange,
}) => {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery(
    trpc.user.list.queryOptions({ page, limit, search }),
  )

  const deleteMutation = useMutation(
    trpc.user.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['user.list'] })
      },
    }),
  )

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link to={`/user/${row.original.id}` as any} className="text-primary hover:underline">
          {(row.getValue('name') as string | null) ?? '-'}
        </Link>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'role.name',
      header: 'Role',
      cell: ({ row }) => row.original.role?.name || '-',
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt') as string)
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Link to={`/user/${row.original.id}` as any} className="no-underline">
            <Button variant="outline" size="sm">
              Edit
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            isDisabled={deleteMutation.isPending}
            onPress={() => {
              if (confirm('Are you sure you want to delete this user?')) {
                deleteMutation.mutate({ id: row.original.id })
              }
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: data?.data || [],
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  if (isLoading) {
    return <div className="text-center py-8 text-default-600">Loading users...</div>
  }

  if (error) {
    return (
      <div className="text-center py-8 text-danger">
        Error loading users: {error.message}
      </div>
    )
  }

  const headers = table.getHeaderGroups()[0]?.headers ?? []
  const totalPages = data?.meta.totalPages || 1
  const totalRows = data?.meta.total || 0
  const start = totalRows === 0 ? 0 : (page - 1) * limit + 1
  const end = Math.min(page * limit, totalRows)

  return (
    <div className="space-y-4">
      <Table>
        <Table.ScrollContainer>
          <Table.Content
            aria-label="Users table"
            className="min-w-[980px]"
            sortDescriptor={toSortDescriptor(sorting)}
            onSortChange={(descriptor) => setSorting(toSortingState(descriptor))}
          >
            <Table.Header>
              {headers.map((header) => (
                <Table.Column
                  key={header.id}
                  id={header.id}
                  allowsSorting={header.column.getCanSort()}
                  isRowHeader={header.id === 'name'}
                >
                  {({ sortDirection }) => (
                    <span className="inline-flex items-center gap-1">
                      <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                      {sortDirection ? (
                        <span className="text-xs text-default-500">
                          {sortDirection === 'descending' ? '▼' : '▲'}
                        </span>
                      ) : null}
                    </span>
                  )}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row) => (
                  <Table.Row key={row.id} id={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <Table.Cell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))
              ) : (
                <Table.Row id="empty">
                  <Table.Cell>No users found</Table.Cell>
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                  <Table.Cell />
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
        <Table.Footer>
          <Pagination>
            <Pagination.Summary>
              {start} to {end} of {totalRows} users
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  isDisabled={page === 1}
                  onPress={() => onPageChange(Math.max(page - 1, 1))}
                >
                  <Pagination.PreviousIcon />
                  Prev
                </Pagination.Previous>
              </Pagination.Item>

              {Array.from({ length: totalPages }).map((_, index) => {
                const pageNum = index + 1
                return (
                  <Pagination.Item key={pageNum}>
                    <Pagination.Link
                      isActive={pageNum === page}
                      onPress={() => onPageChange(pageNum)}
                    >
                      {pageNum}
                    </Pagination.Link>
                  </Pagination.Item>
                )
              })}

              <Pagination.Item>
                <Pagination.Next
                  isDisabled={page >= totalPages}
                  onPress={() => onPageChange(Math.min(page + 1, totalPages))}
                >
                  Next
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        </Table.Footer>
      </Table>
    </div>
  )
}
