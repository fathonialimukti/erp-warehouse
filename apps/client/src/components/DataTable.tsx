import { type ReactNode } from 'react';
import { Pagination, Spinner, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { flexRender, type ColumnDef, type Table as TanstackTable } from '@tanstack/react-table';

export interface DataTableProps<T> {
  table: TanstackTable<T>;
  columns: ColumnDef<T>[];
  isLoading: boolean;
  /** Shown when there are zero rows and not loading. */
  emptyState: { icon: string; message: string };
  /** Loading message rendered in the spinner row. */
  loadingMessage: string;
  /** aria-label for the table content. */
  ariaLabel: string;
  /** Row header column id (for accessibility). */
  rowHeaderId?: string;
  /** Called with the row id when a row is activated. */
  onRowAction?: (id: string) => void;
  /** Extra footer content rendered before the pagination summary. */
  footerPrefix?: ReactNode;
  /** Total number of entries across all pages (from query meta). */
  totalEntries: number;
  /** 1-based index of the first visible row. */
  pageStart: number;
  /** 1-based index of the last visible row. */
  pageEnd: number;
  /** Enable server-side sorting. When set, sortable columns render a sort indicator. */
  enableSorting?: boolean;
}

/**
 * Shared table renderer for index pages: header, body with loading/empty
 * states, and footer pagination. Encapsulates the TanStack + HeroUI wiring
 * so individual pages only declare columns and data.
 */
export function DataTable<T>({
  table,
  columns,
  isLoading,
  emptyState,
  loadingMessage,
  ariaLabel,
  rowHeaderId,
  onRowAction,
  footerPrefix,
  totalEntries,
  pageStart,
  pageEnd,
  enableSorting = false,
}: DataTableProps<T>) {
  const totalPages = Math.max(table.getPageCount(), 1);
  const currentPage = table.getState().pagination.pageIndex + 1;

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label={ariaLabel}
          onRowAction={(key) => onRowAction?.(String(key))}
        >
          <Table.Header>
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header) => (
                <Table.Column
                  key={header.id}
                  id={header.id}
                  isRowHeader={header.id === rowHeaderId}
                  allowsSorting={enableSorting && header.column.getCanSort()}
                >
                  {({ sortDirection }) => (
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {enableSorting && header.column.getCanSort() ? (
                        <Icon
                          icon="solar:alt-arrow-up-linear"
                          className={`size-3 transition-transform ${
                            sortDirection === 'descending'
                              ? 'rotate-180'
                              : sortDirection === 'ascending'
                                ? ''
                                : 'opacity-30'
                          }`}
                        />
                      ) : null}
                    </span>
                  )}
                </Table.Column>
              ))
            )}
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <div className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                <Icon icon={emptyState.icon} className="size-6 text-muted" />
                <span className="text-sm text-muted">{emptyState.message}</span>
              </div>
            )}
          >
            {isLoading ? (
              <Table.Row id="loading-row">
                <Table.Cell colSpan={columns.length}>
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                    <Spinner size="sm" />
                    {loadingMessage}
                  </div>
                </Table.Cell>
              </Table.Row>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Table.Row
                  key={row.original && (row.original as { id?: string }).id}
                  id={(row.original as { id?: string }).id}
                  className={onRowAction ? 'cursor-pointer' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Table.Cell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
      <Table.Footer>
        {footerPrefix}
        <Pagination size="sm">
          <Pagination.Summary>
            {pageStart} to {pageEnd} of {totalEntries} results
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={!table.getCanPreviousPage()}
                onPress={() => table.previousPage()}
              >
                <Pagination.PreviousIcon />
                Prev
              </Pagination.Previous>
            </Pagination.Item>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <Pagination.Item key={page}>
                <Pagination.Link
                  isActive={page === currentPage}
                  onPress={() => table.setPageIndex(page - 1)}
                >
                  {page}
                </Pagination.Link>
              </Pagination.Item>
            ))}
            <Pagination.Item>
              <Pagination.Next
                isDisabled={!table.getCanNextPage()}
                onPress={() => table.nextPage()}
              >
                Next
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </Table.Footer>
    </Table>
  );
}
