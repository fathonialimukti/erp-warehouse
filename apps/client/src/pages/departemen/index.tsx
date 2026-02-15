import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import { Plus, Edit, Trash2, FileSpreadsheet, Eye } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { type SortingState } from '@tanstack/react-table';

import { DepartemenDeleteModal } from './delete';

import { ExportImportModal } from '@/components/export-import-modal';
import { DefaultLayout } from '@/layouts/default';
import { title } from '@/components/primitives';
import { DataTable } from '@/components/data-table';
import { departemenRepository } from '@/repositories/departemen';

type Departemen = Awaited<
  ReturnType<typeof departemenRepository.table>
>['data'][0];

const DepartemenPage = () => {
  const navigate = useNavigate();
  const [departemens, setDepartemens] = useState<Departemen[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedDepartemen, setSelectedDepartemen] =
    useState<Departemen | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadDepartemens = useCallback(async () => {
    try {
      setLoading(true);
      // Convert sorting state to sort string
      const sortString =
        sorting.length > 0
          ? sorting
              .map((sort) => (sort.desc ? `-${sort.id}` : sort.id))
              .join(',')
          : undefined;

      const { data, totalPages: pages } = await departemenRepository.table(
        debouncedSearchQuery,
        pageIndex + 1, // Convert to 1-based page
        pageSize,
        sortString,
      );

      setDepartemens(data);
      setTotalPages(pages || 1);
    } catch {
      // Failed to load departemens
      setDepartemens([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [pageIndex, pageSize, debouncedSearchQuery, sorting]);

  // Debounce search with 300ms delay
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      // Only update if search query actually changed
      if (searchQuery !== debouncedSearchQuery) {
        setDebouncedSearchQuery(searchQuery);
        // Reset to page 0 when search query changes
        setPageIndex(0);
      }
    }, 300);

    // Cleanup timeout on unmount or when searchQuery changes
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, debouncedSearchQuery]);

  // Load departemens when page, rowsPerPage, or debouncedSearchQuery changes
  useEffect(() => {
    loadDepartemens();
  }, [loadDepartemens]);

  const handleOpenDeleteModal = useCallback((departemen: Departemen) => {
    setSelectedDepartemen(departemen);
    setDeleteModalOpen(true);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setSelectedDepartemen(null);
  }, []);

  const handleSortingChange = useCallback((newSorting: SortingState) => {
    setSorting(newSorting);
    setPageIndex(0); // Reset to first page when sorting changes
  }, []);

  // Define columns for TanStack Table
  const columns = useMemo<ColumnDef<Departemen>[]>(
    () => [
      {
        id: 'no',
        header: 'NO',
        cell: ({ row }) => {
          const sequentialNumber = pageIndex * pageSize + row.index + 1;

          return (
            <div className='flex flex-col'>
              <p className='font-semibold'>{sequentialNumber}</p>
            </div>
          );
        },
      },
      {
        accessorKey: 'id',
        header: 'KODE *',
        cell: ({ row }) => (
          <span className='font-mono text-sm  px-2 py-1 rounded'>
            {row.original.id}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: 'nama',
        header: 'NAMA DEPARTEMEN',
        cell: ({ row }) => row.original.nama || '-',
        enableSorting: true,
      },
      {
        accessorKey: 'deskripsi',
        header: 'DESKRIPSI',
        cell: ({ row }) => row.original.deskripsi || '-',
        enableSorting: true,
      },
      {
        id: 'actions',
        header: 'AKSI',
        cell: ({ row }) => (
          <div className='flex items-center gap-2'>
            <Button
              isIconOnly
              size='sm'
              variant='ghost'
              onPress={() => navigate(`/departemen/${row.original.id}/detail`)}>
              <Eye className='h-4 w-4' />
            </Button>
            <Button
              isIconOnly
              size='sm'
              variant='ghost'
              onPress={() => navigate(`/departemen/${row.original.id}/edit`)}>
              <Edit className='h-4 w-4' />
            </Button>
            <Button
              isIconOnly
              color='danger'
              size='sm'
              variant='ghost'
              onPress={() => handleOpenDeleteModal(row.original)}>
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        ),
      },
    ],
    [pageIndex, pageSize, handleOpenDeleteModal],
  );

  return (
    <DefaultLayout>
      <div className='space-y-6'>
        <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div>
            <h1 className={title({ size: 'sm' })}>Departemen</h1>
            <p className='text-default-500'>Kelola data departemen</p>
          </div>
          <div className='flex gap-2'>
            <Button
              color='success'
              startContent={<FileSpreadsheet className='h-4 w-4' />}
              variant='outline'
              onPress={onOpen}>
              Excel
            </Button>
            <Button
              color='primary'
              startContent={<Plus className='h-4 w-4' />}
              onPress={() => navigate('/departemen/create')}>
              Tambah Departemen
            </Button>
          </div>
        </div>
        <DataTable
          searchable
          columns={columns}
          data={departemens}
          emptyContent='Tidak ada data departemen'
          loading={loading}
          pageCount={totalPages}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          searchPlaceholder='Cari departemen...'
          searchValue={searchQuery}
          sorting={sorting}
          onPaginationChange={({
            pageIndex: newPageIndex,
            pageSize: newPageSize,
          }) => {
            setPageIndex(newPageIndex);
            setPageSize(newPageSize);
          }}
          onRowClick={(departemen) =>
            navigate(`/departemen/${departemen.id}/detail`)
          }
          onSearchChange={setSearchQuery}
          onSortingChange={handleSortingChange}
        />
        <ExportImportModal
          downloadTemplateFn={async () => {
            await departemenRepository.downloadTemplate();
          }}
          exportFn={async () => {
            await departemenRepository.exportToExcel();
          }}
          isOpen={isOpen}
          modelName='Departemen'
          onClose={onClose}
        />
        <DepartemenDeleteModal
          departemen={selectedDepartemen}
          isOpen={deleteModalOpen}
          onClose={handleCloseDeleteModal}
          onSuccess={loadDepartemens}
        />
      </div>
    </DefaultLayout>
  );
};

export default DepartemenPage;
