import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Dropdown, EmptyState, Input, Modal, Pagination, Separator, Spinner, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { type ColumnDef, type PaginationState, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpcClient } from '../../lib/trpc';

type TransaksiTab = 'MASUK' | 'PENGELUARAN' | 'TEMUAN' | 'KEHILANGAN';

type TransaksiRow = Record<string, unknown>;

const tabs: Array<{ key: TransaksiTab; label: string; icon: string }> = [
  { key: 'MASUK', label: 'Masuk', icon: 'solar:download-linear' },
  { key: 'PENGELUARAN', label: 'Pengeluaran', icon: 'solar:upload-linear' },
  { key: 'TEMUAN', label: 'Temuan', icon: 'solar:search-minimalistic-linear' },
  { key: 'KEHILANGAN', label: 'Kehilangan', icon: 'solar:warning-linear' },
];

const TRANSAKSI_ROUTE_MAP: Record<TransaksiTab, string> = {
  MASUK: 'masuk',
  PENGELUARAN: 'keluar',
  TEMUAN: 'temuan',
  KEHILANGAN: 'kehilangan',
};

const getTransaksiRoute = (tab: TransaksiTab) => TRANSAKSI_ROUTE_MAP[tab];

export default function TransaksiPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TransaksiTab>('MASUK');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 10 });
  }, [activeTab]);

  const transaksiMasukQuery = useQuery({
    queryKey: ['transaksiMasukList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.transaksiMasuk.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
    enabled: activeTab === 'MASUK',
  });

  const transaksiKeluarQuery = useQuery({
    queryKey: ['transaksiKeluarList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.transaksiKeluar.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
    enabled: activeTab === 'PENGELUARAN',
  });

  const transaksiTemuanQuery = useQuery({
    queryKey: ['transaksiTemuanList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.transaksiTemuan.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
    enabled: activeTab === 'TEMUAN',
  });

  const transaksiKehilanganQuery = useQuery({
    queryKey: ['transaksiKehilanganList', pagination.pageIndex, pagination.pageSize, search],
    queryFn: () =>
      trpcClient.transaksiKehilangan.list.query({
        page: pagination.pageIndex + 1,
        limit: pagination.pageSize,
        search: search || undefined,
      }),
    enabled: activeTab === 'KEHILANGAN',
  });

  const currentQuery =
    (activeTab === 'MASUK'
      ? transaksiMasukQuery
      : activeTab === 'PENGELUARAN'
      ? transaksiKeluarQuery
      : activeTab === 'TEMUAN'
      ? transaksiTemuanQuery
      : transaksiKehilanganQuery) as any;

  const rows = currentQuery.data?.data ?? [];
  const totalPages = Math.max(currentQuery.data?.meta.totalPages ?? 0, 1);
  const totalEntries = currentQuery.data?.meta.total ?? 0;
  const currentPage = pagination.pageIndex + 1;
  const pageStart = totalEntries === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const pageEnd = totalEntries === 0 ? 0 : pageStart + rows.length - 1;
  const isLoading = currentQuery.isLoading || currentQuery.isFetching;

  const columns = useMemo<ColumnDef<TransaksiRow>[]>(() => {
    const baseColumns: Array<ColumnDef<TransaksiRow>> = [
      {
        accessorKey: 'id',
        header: 'Kode Transaksi',
      },
      {
        accessorKey: 'tanggal',
        header: 'Tanggal',
        cell: ({ row }) => {
          const dateValue = row.original.tanggal ? String(row.original.tanggal) : '';
          return dateValue ? new Date(dateValue).toLocaleDateString('id-ID') : '-';
        },
      },
      {
        accessorKey: 'statusApproval',
        header: 'Status',
      },
    ];

    const actionColumn: ColumnDef<TransaksiRow> = {
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
            <Dropdown.Menu aria-label="Transaksi actions">
              <Dropdown.Item onPress={() => navigate(`/transaksi/${getTransaksiRoute(activeTab)}/detail/${String(row.original.id)}`)}>
                <Icon icon="solar:eye-linear" className="size-4" />
                Detail
              </Dropdown.Item>
              <Dropdown.Item
                onPress={() => navigate(`/transaksi/${getTransaksiRoute(activeTab)}/form/${String(row.original.id)}`)}
                className="text-warning"
              >
                <Icon icon="solar:pen-linear" className="size-4" />
                Edit
              </Dropdown.Item>
              <Separator />
              <Dropdown.Item
                variant="danger"
                className="text-danger"
                onPress={() => {
                  setDeletingRowId(String(row.original.id));
                  setDeleteModalOpen(true);
                }}
              >
                <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                Hapus
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      ),
    };

    if (activeTab === 'MASUK') {
      return [
        ...baseColumns.slice(0, 1),
        {
          id: 'lokasi',
          header: 'Lokasi Masuk',
          cell: ({ row }) => String((row.original.lokasiMasuk as any)?.nama ?? '-'),
        },
        {
          id: 'jumlahItem',
          header: 'Jumlah Item',
          cell: ({ row }) => String((row.original.totalJumlahItem as number) ?? (row.original.items as any[])?.length ?? '-'),
        },
        baseColumns[1],
        baseColumns[2],
        actionColumn,
      ];
    }

    if (activeTab === 'PENGELUARAN') {
      return [
        ...baseColumns.slice(0, 1),
        {
          id: 'lokasi',
          header: 'Lokasi Keluar',
          cell: ({ row }) => String((row.original.lokasiKeluar as any)?.nama ?? '-'),
        },
        {
          id: 'jumlahPalet',
          header: 'Jumlah Palet',
          cell: ({ row }) => String((row.original.items as any[])?.length ?? '-'),
        },
        baseColumns[1],
        baseColumns[2],
        actionColumn,
      ];
    }

    if (activeTab === 'TEMUAN') {
      return [
        ...baseColumns.slice(0, 1),
        {
          accessorKey: 'jenisTemuan',
          header: 'Jenis Temuan',
          cell: ({ row }) => String(row.original.jenisTemuan ?? '-'),
        },
        {
          accessorKey: 'referensi',
          header: 'Referensi',
          cell: ({ row }) => String(row.original.referensi ?? '-'),
        },
        {
          id: 'jumlahItem',
          header: 'Jumlah Item',
          cell: ({ row }) => String((row.original.items as any[])?.length ?? '-'),
        },
        baseColumns[1],
        baseColumns[2],
        actionColumn,
      ];
    }

    return [
      ...baseColumns.slice(0, 1),
      {
        accessorKey: 'alasanKehilangan',
        header: 'Alasan Kehilangan',
        cell: ({ row }) => String(row.original.alasanKehilangan ?? '-'),
      },
      {
        accessorKey: 'nilaiEstimasi',
        header: 'Nilai Estimasi',
        cell: ({ row }) => {
          const value = row.original.nilaiEstimasi as number | string | null | undefined;
          return value != null ? `Rp ${Number(value).toLocaleString('id-ID')}` : '-';
        },
      },
      baseColumns[1],
      baseColumns[2],
      actionColumn,
    ];
  }, [activeTab]);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: currentQuery.data?.meta.totalPages ?? 0,
  });

  const activeLabel = tabs.find((tab) => tab.key === activeTab)?.label ?? 'Transaksi';

  const handleDelete = async () => {
    if (!deletingRowId || isDeleting) {
      return;
    }

    setIsDeleting(true);
    try {
      if (activeTab === 'MASUK') {
        await trpcClient.transaksiMasuk.delete.mutate({ id: deletingRowId });
      } else if (activeTab === 'PENGELUARAN') {
        await trpcClient.transaksiKeluar.delete.mutate({ id: deletingRowId });
      } else if (activeTab === 'TEMUAN') {
        await trpcClient.transaksiTemuan.delete.mutate({ id: deletingRowId });
      } else {
        await trpcClient.transaksiKehilangan.delete.mutate({ id: deletingRowId });
      }
      await queryClient.invalidateQueries({ queryKey: [
        activeTab === 'MASUK'
          ? 'transaksiMasukList'
          : activeTab === 'PENGELUARAN'
          ? 'transaksiKeluarList'
          : activeTab === 'TEMUAN'
          ? 'transaksiTemuanList'
          : 'transaksiKehilanganList',
        pagination.pageIndex,
        pagination.pageSize,
        search,
      ] });
      setDeleteModalOpen(false);
      setDeletingRowId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="space-y-4">
      <Card>
        <Card.Header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Card.Title className="text-2xl">Transaksi Gudang</Card.Title>
            <Card.Description>
              Pantau transaksi masuk, pengeluaran, temuan, dan kehilangan dari satu halaman.
            </Card.Description>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Button
                  key={tab.key}
                  size="sm"
                  variant={activeTab === tab.key ? 'primary' : 'secondary'}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Icon icon={tab.icon} className="size-4" />
                  {tab.label}
                </Button>
              ))}
            </div>
            <Button variant="primary" onPress={() => navigate(`/transaksi/${getTransaksiRoute(activeTab)}/form`)}>
              Tambah Transaksi
            </Button>
          </div>
        </Card.Header>

        <Card.Content className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted">Tab aktif: {activeLabel}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Cari transaksi..."
                variant="secondary"
                className="w-full sm:w-80"
              />
            </div>
          </div>

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={`${activeLabel} table`} className="min-w-full">
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column key={header.id} isRowHeader={header.id === 'id'}>
                        <span className="font-semibold">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      </Table.Column>
                    )),
                  )}
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <EmptyState className="flex w-full flex-col items-center justify-center gap-3 py-10 text-center">
                      <Icon icon="solar:box-minimalistic-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">Belum ada data transaksi untuk tab ini.</span>
                    </EmptyState>
                  )}
                >
                  {isLoading ? (
                    <Table.Row id="loading-row">
                      <Table.Cell className="py-10 text-center" colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          Memuat data transaksi...
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={String(row.original.id)} id={String(row.original.id)} className="hover:bg-surface/50 cursor-default">
                        {row.getVisibleCells().map((cell) => (
                          <Table.Cell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>
                        ))}
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer>
              <Pagination size="sm">
                <Pagination.Summary>
                  {pageStart} to {pageEnd} of {totalEntries} results
                </Pagination.Summary>
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

      <Card>
        <Card.Header>
          <Card.Title>Catatan</Card.Title>
        </Card.Header>
        <Card.Content>
          <p className="text-sm text-muted">
            Tombol action di baris dan tombol Tambah Transaksi saat ini masih bersifat kerangka kerja.
            Langkah selanjutnya adalah menambahkan halaman detail, edit, dan form create untuk setiap jenis transaksi.
          </p>
        </Card.Content>
      </Card>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-90">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Hapus Transaksi</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-muted">
                  Apakah Anda yakin ingin menghapus transaksi {activeLabel.toLowerCase()} dengan ID {deletingRowId}?
                  Aksi ini hanya akan berhasil apabila status transaksi masih DRAFT.
                </p>
              </Modal.Body>
              <Modal.Footer className="flex items-center justify-end gap-2">
                <Button variant="secondary" onPress={() => setDeleteModalOpen(false)}>
                  Batal
                </Button>
                <Button variant="danger" onPress={handleDelete} isDisabled={isDeleting}>
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
