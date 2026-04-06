import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Dropdown, EmptyState, Input, Modal, Pagination, Separator, Spinner, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  type ColumnDef,
  type PaginationState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EntityPhoto from '../../components/EntityPhoto';
import { trpcClient } from '../../lib/trpc';

type Warehouse = {
  id: string;
  nama: string;
  alamat: string;
  foto?: string | null;
  kapasitasTotal: number | null;
  createdAt: string;
};

export default function WarehouseIndexPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['warehouseList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.warehouse.gudang.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
  });

  const columns = useMemo<ColumnDef<Warehouse>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Kode Gudang',
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium text-primary">
            {row.original.id}
          </span>
        ),
      },
      {
        id: 'nama',
        header: 'Nama Gudang',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <EntityPhoto src={row.original.foto} alt={row.original.nama} />
            <div>
              <p className="text-sm font-medium text-foreground">{row.original.nama}</p>
              <p className="text-xs text-muted">{row.original.alamat}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'alamat',
        header: 'Alamat',
      },
      {
        accessorKey: 'kapasitasTotal',
        header: 'Kapasitas Total',
        cell: ({ row }) => row.original.kapasitasTotal?.toLocaleString('id-ID') ?? '-',
      },
      {
        accessorKey: 'createdAt',
        header: 'Dibuat',
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString('id-ID'),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="ghost" isIconOnly aria-label="Actions">
                <Icon icon="solar:menu-dots-bold" className="size-4" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Warehouse actions">
                <Dropdown.Item
                  key="view"
                  onPress={() => navigate(`/warehouse/${row.original.id}`)}
                >
                  <Icon icon="solar:eye-linear" className="size-4" />
                  Lihat detail
                </Dropdown.Item>
                <Dropdown.Item
                  key="edit"
                  className="text-warning"
                  onPress={() => navigate(`/warehouse/${row.original.id}/edit`)}
                >
                  <Icon icon="solar:pen-linear" className="size-4" />
                  Edit gudang
                </Dropdown.Item>
                <Separator />
                <Dropdown.Item
                  key="delete"
                  variant="danger"
                  className="text-danger"
                  onPress={() => {
                    setWarehouseToDelete(row.original);
                    setDeleteModalOpen(true);
                  }}
                >
                  <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                  Hapus gudang
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [navigate]
  );

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    manualPagination: true,
    pageCount: data?.meta.totalPages ?? 0,
    state: {
      pagination,
    },
  });

  const totalEntries = data?.meta.total ?? 0;
  const totalPages = Math.max(data?.meta.totalPages ?? 0, 1);
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageStart = totalEntries === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = totalEntries === 0 ? 0 : pageStart + (data?.data.length ?? 0) - 1;

  const handleDelete = async () => {
    if (!warehouseToDelete || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      await trpcClient.warehouse.gudang.delete.mutate({ id: warehouseToDelete.id });
      await queryClient.invalidateQueries({ queryKey: ['warehouseList'] });
      queryClient.removeQueries({ queryKey: ['warehouseDetail', warehouseToDelete.id] });
      queryClient.removeQueries({ queryKey: ['warehouseLokasi', warehouseToDelete.id] });
      setDeleteModalOpen(false);
      setWarehouseToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex items-start justify-between gap-3">
          <div>
            <Card.Title className="text-2xl">Gudang</Card.Title>
            <Card.Description>Kelola data gudang dan akses ke tabel lokasi penyimpanan di halaman detail.</Card.Description>
          </div>
          <div className="flex items-center gap-3">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Cari nama/alamat gudang"
              variant="secondary"
              className="w-80"
            />
            <Button variant="primary" onPress={() => navigate('/warehouse/new')}>
              Tambah Gudang
            </Button>
          </div>
        </Card.Header>

        <Card.Content className="space-y-4">

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Warehouse table" className="min-w-full" onRowAction={(key) => navigate(`/warehouse/${String(key)}`)}>
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column key={header.id} isRowHeader={header.id === 'nama'}>
                        <span className="font-semibold">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      </Table.Column>
                    ))
                  )}
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <Icon icon="solar:buildings-2-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">Belum ada data gudang.</span>
                    </EmptyState>
                  )}
                >
                  {isLoading || isFetching ? (
                    <Table.Row id="loading-row">
                      <Table.Cell className="py-10 text-center" colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          Memuat data gudang...
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.original.id} id={row.original.id} className="cursor-pointer">
                        {row.getVisibleCells().map((cell) => (
                          <Table.Cell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>
                        ))}
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-muted">
                {pageStart} to {pageEnd} of {totalEntries} results
              </span>
              <Pagination size="sm">
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous isDisabled={!table.getCanPreviousPage()} onPress={() => table.previousPage()}>
                      <Pagination.PreviousIcon />
                      Prev
                    </Pagination.Previous>
                  </Pagination.Item>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <Pagination.Item key={page}>
                      <Pagination.Link isActive={page === currentPage} onPress={() => table.setPageIndex(page - 1)}>
                        {page}
                      </Pagination.Link>
                    </Pagination.Item>
                  ))}
                  <Pagination.Item>
                    <Pagination.Next isDisabled={!table.getCanNextPage()} onPress={() => table.nextPage()}>
                      Next
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-90">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Hapus Gudang</Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  Apakah Anda yakin ingin menghapus gudang "{warehouseToDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.
                </p>
              </Modal.Header>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDeleteModalOpen(false)}>
                  Batal
                </Button>
                <Button variant="danger" onPress={() => void handleDelete()} isDisabled={isDeleting}>
                  {isDeleting ? 'Menghapus...' : 'Hapus'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
