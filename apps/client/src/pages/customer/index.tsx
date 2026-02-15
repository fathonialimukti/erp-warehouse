import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@heroui/react';
import { Plus, Edit, Trash2, FileSpreadsheet, Eye } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import { type SortingState } from '@tanstack/react-table';

import { CustomerDeleteModal } from './delete';

import { ExportImportModal } from '@/components/export-import-modal';
import { DefaultLayout } from '@/layouts/default';
import { title } from '@/components/primitives';
import { DataTable } from '@/components/data-table';
import { customerRepository } from '@/repositories/customer';

type Customer = Awaited<ReturnType<typeof customerRepository.table>>['data'][0];

const CustomerPage = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const onOpen = () => setIsOpen(true);
  const onClose = () => setIsOpen(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      // Convert sorting state to sort string
      const sortString =
        sorting.length > 0
          ? sorting
              .map((sort) => (sort.desc ? `-${sort.id}` : sort.id))
              .join(',')
          : undefined;

      const { data, totalPages: pages } = await customerRepository.table(
        debouncedSearchQuery,
        pageIndex + 1,
        pageSize,
        sortString,
      );

      setCustomers(data);
      setTotalPages(pages || 1);
    } catch {
      setCustomers([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [pageIndex, pageSize, debouncedSearchQuery, sorting]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery !== debouncedSearchQuery) {
        setDebouncedSearchQuery(searchQuery);
        setPageIndex(0);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, debouncedSearchQuery]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleOpenDeleteModal = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteModalOpen(true);
  }, []);
  const handleCloseDeleteModal = useCallback(() => {
    setDeleteModalOpen(false);
    setSelectedCustomer(null);
  }, []);
  const handleSortingChange = useCallback((newSorting: SortingState) => {
    setSorting(newSorting);
    setPageIndex(0); // Reset to first page when sorting changes
  }, []);

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        id: 'no',
        header: 'NO',
        cell: ({ row }) => (
          <div className='flex flex-col'>
            <p className='font-semibold'>
              {pageIndex * pageSize + row.index + 1}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'id',
        header: 'ID',
        cell: ({ row }) => row.original.id || '-',
        enableSorting: true,
      },
      {
        accessorKey: 'nama',
        header: 'NAMA',
        cell: ({ row }) => row.original.nama || '-',
        enableSorting: true,
      },
      {
        accessorKey: 'email',
        header: 'EMAIL',
        cell: ({ row }) => row.original.email || '-',
        enableSorting: true,
      },
      {
        accessorKey: 'no_hp',
        header: 'NO HP',
        cell: ({ row }) => row.original.no_hp || '-',
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
              onPress={() => navigate(`/customer/${row.original.id}/detail`)}>
              <Eye className='h-4 w-4' />
            </Button>
            <Button
              isIconOnly
              size='sm'
              variant='ghost'
              onPress={() => navigate(`/customer/${row.original.id}/edit`)}>
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
            <h1 className={title({ size: 'sm' })}>Customer</h1>
            <p className='text-default-500'>Kelola data customer</p>
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
              onPress={() => navigate('/customer/create')}>
              Tambah Customer
            </Button>
          </div>
        </div>
        <DataTable
          searchable
          columns={columns}
          data={customers}
          emptyContent='Tidak ada data customer'
          loading={loading}
          pageCount={totalPages}
          pageIndex={pageIndex}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          searchPlaceholder='Cari customer...'
          searchValue={searchQuery}
          sorting={sorting}
          onPaginationChange={({
            pageIndex: newPageIndex,
            pageSize: newPageSize,
          }) => {
            setPageIndex(newPageIndex);
            setPageSize(newPageSize);
          }}
          onRowClick={(cust) => navigate(`/customer/${cust.id}/detail`)}
          onSearchChange={setSearchQuery}
          onSortingChange={handleSortingChange}
        />
        <ExportImportModal
          downloadTemplateFn={async () => {
            await customerRepository.downloadTemplate();
          }}
          exportFn={async () => {
            await customerRepository.exportToExcel();
          }}
          isOpen={isOpen}
          modelName='Customer'
          onClose={onClose}
        />
        <CustomerDeleteModal
          customer={selectedCustomer}
          isOpen={deleteModalOpen}
          onClose={handleCloseDeleteModal}
          onSuccess={loadCustomers}
        />
      </div>
    </DefaultLayout>
  );
};

export default CustomerPage;
