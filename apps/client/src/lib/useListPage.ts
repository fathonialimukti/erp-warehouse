import { useEffect, useMemo, useState } from 'react';
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export interface ListQueryInput {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListQueryResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface UseListPageOptions<T> {
  /** Stable query-key prefix, e.g. ['supplierList']. */
  queryKey: unknown[];
  /** Builds the tRPC query input from the current page state + debounced search + sort. */
  queryFn: (input: ListQueryInput) => Promise<ListQueryResult<T>>;
  /** Column definitions for the table. */
  columns: ColumnDef<T>[];
  /** Extra values that should reset pagination + re-query when changed (e.g. active tab, status filter). */
  resetDeps?: unknown[];
  /** Debounce delay for the search box, in ms. */
  debounceMs?: number;
  /** Page size. */
  pageSize?: number;
  /** Initial sort state (server-side sorting). Omit for unsorted lists. */
  initialSorting?: SortingState;
}

export interface UseListPageResult<T> {
  /** Raw search input (controlled by the SearchField). */
  searchInput: string;
  setSearchInput: (value: string) => void;
  /** Debounced + trimmed search value passed to the query. */
  search: string;
  /** Current sort state (server-side). */
  sorting: SortingState;
  setSorting: (updater: SortingState | ((prev: SortingState) => SortingState)) => void;
  table: ReturnType<typeof useReactTable<T>>;
  query: UseQueryResult<ListQueryResult<T>, unknown>;
  isLoading: boolean;
  isFetching: boolean;
  totalEntries: number;
  totalPages: number;
  currentPage: number;
  pageStart: number;
  pageEnd: number;
}

/**
 * Shared spine for index/list pages: debounced search, pagination state,
 * optional server-side sorting, the tRPC `useQuery`, and the TanStack table
 * wiring (manual pagination + manual sorting).
 *
 * Pages supply `queryKey` + `queryFn` + `columns`; everything else is derived.
 * The delete modal, row-action dropdown, and page header stay in the page.
 */
export function useListPage<T>({
  queryKey,
  queryFn,
  columns,
  resetDeps = [],
  debounceMs = 300,
  pageSize = 10,
  initialSorting,
}: UseListPageOptions<T>): UseListPageResult<T> {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);

  // Debounce search input; reset to first page on each keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchInput, debounceMs]);

  // Reset to first page when a reset dependency (e.g. tab, status filter) changes.
  // Compare by value so a fresh array literal with equal contents does not loop.
  const extraKey = useMemo(() => JSON.stringify(resetDeps), [resetDeps]);
  const prevExtraKey = useState(extraKey);
  if (extraKey !== prevExtraKey[0]) {
    prevExtraKey[0] = extraKey;
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }

  const activeSort = sorting[0];
  const sortBy = activeSort?.id;
  const sortOrder = activeSort ? (activeSort.desc ? 'desc' : 'asc') : undefined;

  const query = useQuery({
    queryKey: [...queryKey, pagination.pageIndex, pagination.pageSize, search, sortBy, sortOrder, ...resetDeps],
    queryFn: () =>
      queryFn({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
        sortBy,
        sortOrder,
      }),
  });

  const table = useReactTable({
    data: query.data?.data ?? [],
    columns,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: query.data?.meta.totalPages ?? 0,
  });

  const totalEntries = query.data?.meta.total ?? 0;
  const totalPages = Math.max(query.data?.meta.totalPages ?? 0, 1);
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageStart = totalEntries === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = totalEntries === 0 ? 0 : pageStart + (query.data?.data.length ?? 0) - 1;

  return {
    searchInput,
    setSearchInput,
    search,
    sorting,
    setSorting,
    table,
    query,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    totalEntries,
    totalPages,
    currentPage,
    pageStart,
    pageEnd,
  };
}
