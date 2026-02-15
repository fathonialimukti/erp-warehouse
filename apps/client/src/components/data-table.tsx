/**
 * DataTable Component - DISABLED FOR HERO UI V3 BETA COMPATIBILITY
 *
 * This component is disabled temporarily due to Hero UI v3 beta table
 * export issues. Use a simple HTML table or alternative solution instead.
 */

import { ReactNode } from 'react';

interface DataTableProps<TData, _TValue = any> {
  columns: any[];
  data: TData[];
  loading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  searchValue?: string;
  pageCount?: number;
  pageIndex?: number;
  pageSize?: number;
  onPaginationChange?: (pagination: any) => void;
  onRowClick?: (row: any) => void;
  isCompact?: boolean;
}

export function DataTable<TData, _TValue = any>({
  columns,
  data,
}: DataTableProps<TData, _TValue>): ReactNode {
  // Placeholder component - implement with simple HTML table when needed
  return (
    <div className='w-full p-4 bg-default-50 rounded-lg text-center'>
      <p className='text-sm text-default-500'>
        DataTable component disabled. Use simple tables instead.
      </p>
    </div>
  );
}

export default DataTable;
