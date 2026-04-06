import { useMemo, useState } from 'react';
import { Button, Card, Chip, Dropdown, EmptyState, Form, Input, Label, ListBox, Modal, Select, Spinner, Table, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import EntityPhoto from '../../components/EntityPhoto';
import { trpcClient } from '../../lib/trpc';

const lokasiStatusValues = ['AKTIF', 'MAINTENANCE', 'PENUH'] as const;
type LokasiStatus = (typeof lokasiStatusValues)[number];

type LokasiRow = {
  id: string;
  status: LokasiStatus;
  palet: {
    id: string;
    jenisPalet: {
      nama: string;
      sku: {
        nama: string;
      };
    };
  } | null;
  createdAt: string;
};

type ExportRow = {
  ID: string;
  Status: LokasiStatus;
  PaletID: string;
  JenisPalet: string;
  SKU: string;
};

function downloadBlob(content: BlobPart, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sanitizeFileSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
}

export default function WarehouseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [lokasiIdInput, setLokasiIdInput] = useState('');
  const [statusInput, setStatusInput] = useState<LokasiStatus>('AKTIF');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeletingWarehouse, setIsDeletingWarehouse] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'danger' | 'success'>('success');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [lokasiModalOpen, setLokasiModalOpen] = useState(false);

  const { data: warehouse, isLoading: isLoadingWarehouse } = useQuery({
    queryKey: ['warehouseDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.warehouse.gudang.detail.query({ id: id ?? '' }),
  });

  const {
    data: lokasiData,
    isLoading: isLoadingLokasi,
    isFetching: isFetchingLokasi,
    refetch: refetchLokasi,
  } = useQuery({
    queryKey: ['warehouseLokasi', id],
    enabled: Boolean(id),
    queryFn: () =>
      trpcClient.warehouse.lokasiPenyimpanan.list.query({
        gudangId: id,
      }),
  });

  const lokasiRows = useMemo(() => (lokasiData?.data ?? []) as LokasiRow[], [lokasiData?.data]);
  const lokasiSummary = useMemo(() => {
    const total = lokasiRows.length;
    const aktif = lokasiRows.filter((row) => row.status === 'AKTIF').length;
    const maintenance = lokasiRows.filter((row) => row.status === 'MAINTENANCE').length;
    const penuh = lokasiRows.filter((row) => row.status === 'PENUH').length;
    const occupied = lokasiRows.filter((row) => row.palet).length;
    const utilization = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return { aktif, maintenance, occupied, penuh, total, utilization };
  }, [lokasiRows]);

  const resetLokasiForm = () => {
    setEditingId(null);
    setLokasiIdInput('');
    setStatusInput('AKTIF');
    setLokasiModalOpen(false);
  };

  const setFeedback = (tone: 'danger' | 'success', message: string) => {
    setFeedbackTone(tone);
    setFeedbackMessage(message);
  };

  const startEdit = (row: LokasiRow) => {
    setEditingId(row.id);
    setLokasiIdInput(row.id);
    setStatusInput(row.status);
    setLokasiModalOpen(true);
  };

  const submitLokasi = async () => {
    if (!id) return;

    if (!lokasiIdInput.trim()) {
      setFeedback('danger', 'ID lokasi wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      if (editingId) {
        await trpcClient.warehouse.lokasiPenyimpanan.update.mutate({
          currentId: editingId,
          id: lokasiIdInput.trim(),
          gudangId: id,
          status: statusInput,
        });
        setFeedback('success', 'Lokasi penyimpanan berhasil diperbarui.');
      } else {
        await trpcClient.warehouse.lokasiPenyimpanan.create.mutate({
          id: lokasiIdInput.trim(),
          gudangId: id,
          status: statusInput,
        });
        setFeedback('success', 'Lokasi penyimpanan berhasil ditambahkan.');
      }

      resetLokasiForm();
      await refetchLokasi();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : 'Gagal menyimpan lokasi penyimpanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLokasi = async (lokasiId: string) => {
    if (!confirm('Hapus lokasi penyimpanan ini?')) {
      return;
    }

    setFeedbackMessage(null);

    try {
      await trpcClient.warehouse.lokasiPenyimpanan.delete.mutate({ id: lokasiId });
      setFeedback('success', 'Lokasi penyimpanan berhasil dihapus.');
      await refetchLokasi();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : 'Gagal menghapus lokasi penyimpanan.');
    }
  };

  const handleDeleteWarehouse = async () => {
    if (!warehouse || isDeletingWarehouse) {
      return;
    }

    setIsDeletingWarehouse(true);
    try {
      await trpcClient.warehouse.gudang.delete.mutate({ id: warehouse.id });
      await queryClient.invalidateQueries({ queryKey: ['warehouseList'] });
      queryClient.removeQueries({ queryKey: ['warehouseDetail', warehouse.id] });
      queryClient.removeQueries({ queryKey: ['warehouseLokasi', warehouse.id] });
      setDeleteModalOpen(false);
      navigate('/warehouse');
    } catch (error) {
      setDeleteModalOpen(false);
      setFeedback('danger', error instanceof Error ? error.message : 'Gagal menghapus gudang.');
    } finally {
      setIsDeletingWarehouse(false);
    }
  };

  const exportLokasi = async (format: 'csv' | 'xlsx') => {
    if (!id || !warehouse) {
      return;
    }

    setIsExporting(true);
    setFeedbackMessage(null);

    try {
      const rows = await trpcClient.warehouse.lokasiPenyimpanan.exportAll.query({ gudangId: id });
      const exportRows: ExportRow[] = rows.map((row) => ({
        ID: row.id,
        Status: row.status,
        PaletID: row.palet?.id ?? '-',
        JenisPalet: row.palet?.jenisPalet.nama ?? '-',
        SKU: row.palet?.jenisPalet.sku.nama ?? '-',
      }));

      const sheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Lokasi');

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      const baseName = `lokasi-${sanitizeFileSegment(warehouse.nama)}-${timestamp}`;

      if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(sheet);
        downloadBlob(csv, `${baseName}.csv`, 'text/csv;charset=utf-8;');
      } else {
        const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        downloadBlob(xlsxBuffer, `${baseName}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }

      setFeedback('success', `Export ${format.toUpperCase()} berhasil.`);
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : 'Export gagal.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!id || !importFile) {
      setFeedback('danger', 'Pilih file CSV/XLSX terlebih dahulu.');
      return;
    }

    setIsImporting(true);
    setFeedbackMessage(null);

    try {
      const arrayBuffer = await importFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      if (!sheet) {
        throw new Error('Sheet tidak ditemukan pada file import.');
      }

      const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
        header: 1,
        raw: false,
      });

      if (rows.length === 0) {
        throw new Error('File import kosong.');
      }

      const firstCell = String(rows[0]?.[0] ?? '').trim().toLowerCase();
      const hasHeader = firstCell === 'id' || firstCell === 'kode';
      const startIndex = hasHeader ? 1 : 0;

      const parsed = rows
        .slice(startIndex)
        .map((row) => ({
          id: String(row[0] ?? '').trim(),
          status: String(row[1] ?? '').trim().toUpperCase(),
        }))
        .filter((row) => row.id.length > 0);

      if (parsed.length === 0) {
        throw new Error('Tidak ada baris data valid untuk diimport.');
      }

      const invalidStatus = parsed.find(
        (row) => row.status.length > 0 && !lokasiStatusValues.includes(row.status as LokasiStatus)
      );
      if (invalidStatus) {
        throw new Error(`Status tidak valid untuk ID ${invalidStatus.id}: ${invalidStatus.status}`);
      }

      const importResult = await trpcClient.warehouse.lokasiPenyimpanan.importBatch.mutate({
        gudangId: id,
        rows: parsed.map((row) => ({
          id: row.id,
          status: row.status.length > 0 ? (row.status as LokasiStatus) : undefined,
        })),
      });

      setImportFile(null);
      setImportModalOpen(false);
      setFeedback(
        'success',
        `Import selesai. Created: ${importResult.created}, Updated: ${importResult.updated}, Deleted: ${importResult.deleted}.`
      );
      await refetchLokasi();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : 'Import gagal.');
    } finally {
      setIsImporting(false);
    }
  };

  const columns = useMemo<ColumnDef<LokasiRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Chip
            size="sm"
            variant="soft"
            color={row.original.status === 'AKTIF' ? 'success' : row.original.status === 'MAINTENANCE' ? 'warning' : 'danger'}
          >
            {row.original.status}
          </Chip>
        ),
      },
      {
        id: 'palet',
        header: 'Palet',
        cell: ({ row }) => (row.original.palet ? row.original.palet.id : '-'),
      },
      {
        id: 'jenisPalet',
        header: 'Jenis Palet',
        cell: ({ row }) => row.original.palet?.jenisPalet.nama ?? '-',
      },
      {
        id: 'sku',
        header: 'SKU',
        cell: ({ row }) => row.original.palet?.jenisPalet.sku.nama ?? '-',
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
              <Dropdown.Menu aria-label="Lokasi actions">
                <Dropdown.Item
                  key="edit"
                  onPress={() => startEdit(row.original)}
                >
                  <Icon icon="solar:pen-linear" className="size-4" />
                  Edit lokasi
                </Dropdown.Item>
                <Dropdown.Item
                  key="delete"
                  variant="danger"
                  onPress={() => void handleDeleteLokasi(row.original.id)}
                >
                  <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                  Hapus lokasi
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: lokasiRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoadingWarehouse) {
    return <p className="text-sm text-muted">Memuat detail gudang...</p>;
  }

  if (!warehouse) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">Gudang tidak ditemukan.</p>
        <Button variant="ghost" onPress={() => navigate('/warehouse')}>
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden border border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96)_48%,rgba(37,99,235,0.88))] text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <Card.Content className="grid gap-6 p-6 md:grid-cols-[280px_1fr] md:p-8">
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/12 bg-white/6 p-3 backdrop-blur-sm">
              <EntityPhoto src={warehouse.foto} alt={warehouse.nama} className="h-64 w-full rounded-[1.4rem] border border-white/12 object-cover" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Warehouse ID</p>
              <p className="mt-2 font-mono text-sm text-white">{warehouse.id}</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/72">
                  <Icon icon="solar:buildings-2-linear" className="size-4" />
                  Warehouse Operations
                </div>
                <div>
                  <Card.Title className="text-3xl text-white">{warehouse.nama}</Card.Title>
                  <Card.Description className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                    Kelola identitas gudang, distribusi lokasi penyimpanan, dan kesiapan operasional dari satu tampilan ringkas.
                  </Card.Description>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="soft" color="success">
                    {lokasiSummary.aktif} lokasi aktif
                  </Chip>
                  <Chip size="sm" variant="soft" color={lokasiSummary.penuh > 0 ? 'warning' : 'success'}>
                    {lokasiSummary.occupied} lokasi terisi
                  </Chip>
                  <Chip size="sm" variant="soft" color={lokasiSummary.maintenance > 0 ? 'warning' : 'default'}>
                    {lokasiSummary.maintenance} maintenance
                  </Chip>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button variant="secondary" onPress={() => navigate(`/warehouse/${warehouse.id}/edit`)}>
                  <Icon icon="solar:pen-linear" className="h-4 w-4" />
                  Edit Gudang
                </Button>
                <Button variant="danger" onPress={() => setDeleteModalOpen(true)}>
                  <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                  Hapus Gudang
                </Button>
                <Button variant="ghost" onPress={() => navigate('/warehouse')}>
                  <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
                  Kembali
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Alamat</p>
                <p className="mt-2 text-sm leading-6 text-white">{warehouse.alamat}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Kapasitas Total</p>
                <p className="mt-2 text-2xl font-semibold text-white">{warehouse.kapasitasTotal?.toLocaleString('id-ID') ?? '-'}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Utilisasi Lokasi</p>
                <p className="mt-2 text-2xl font-semibold text-white">{lokasiSummary.utilization}%</p>
                <p className="mt-1 text-xs text-white/60">{lokasiSummary.occupied} dari {lokasiSummary.total} lokasi terisi</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">Kondisi Lokasi</p>
                <div className="mt-2 space-y-1 text-sm text-white/88">
                  <p>Aktif: {lokasiSummary.aktif}</p>
                  <p>Penuh: {lokasiSummary.penuh}</p>
                  <p>Maintenance: {lokasiSummary.maintenance}</p>
                </div>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-base">Operational Snapshot</Card.Title>
            <Card.Description>Ringkasan cepat untuk membantu evaluasi kapasitas dan status lokasi.</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Alamat Gudang</p>
              <p className="mt-2 text-sm leading-6 text-foreground">{warehouse.alamat}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Kapasitas Tercatat</p>
              <p className="mt-2 text-sm text-foreground">{warehouse.kapasitasTotal?.toLocaleString('id-ID') ?? '-'} unit</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Foto Tersimpan</p>
              <p className="mt-2 break-all font-mono text-sm text-foreground">{warehouse.foto ?? '-'}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-surface p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Lokasi Terdaftar</p>
              <p className="mt-2 text-sm text-foreground">{lokasiSummary.total} lokasi dengan {lokasiSummary.occupied} terisi palet.</p>
            </div>
          </Card.Content>
        </Card>

        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-base">Action Center</Card.Title>
            <Card.Description>Akses cepat untuk operasi master data dan distribusi lokasi.</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-3">
            <Button variant="primary" fullWidth onPress={() => setLokasiModalOpen(true)}>
              <Icon icon="solar:add-circle-linear" className="size-4" />
              Tambah Lokasi Penyimpanan
            </Button>
            <Button variant="secondary" fullWidth onPress={() => setImportModalOpen(true)}>
              <Icon icon="solar:upload-linear" className="size-4" />
              Import Lokasi
            </Button>
            <Button variant="secondary" fullWidth onPress={() => setExportModalOpen(true)}>
              <Icon icon="solar:download-linear" className="size-4" />
              Export Lokasi
            </Button>
            <Button variant="ghost" fullWidth onPress={() => navigate(`/warehouse/${warehouse.id}/edit`)}>
              <Icon icon="solar:pen-linear" className="size-4" />
              Edit Detail Gudang
            </Button>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Card.Title className="text-base">Lokasi Penyimpanan</Card.Title>
              <Card.Description>Tabel lokasi untuk gudang ini, termasuk status, keterisian palet, dan kontrol perubahan.</Card.Description>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onPress={() => setExportModalOpen(true)}>
                Export Data
              </Button>
              <Button variant="primary" onPress={() => setImportModalOpen(true)}>
                Import Data
              </Button>
              <Button variant="primary" onPress={() => setLokasiModalOpen(true)}>
                <Icon icon="solar:add-circle-linear" className="size-4" />
                Tambah Lokasi
              </Button>
            </div>
          </div>
        </Card.Header>

        <Card.Content className="space-y-4">

          {feedbackMessage && (
            <p
              className={`rounded-xl border px-3 py-2 text-sm ${feedbackTone === 'success'
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-danger/30 bg-danger/10 text-danger'
                }`}
            >
              {feedbackMessage}
            </p>
          )}

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Lokasi penyimpanan table" className="min-w-full">
                <Table.Header>
                  {table.getHeaderGroups().map((headerGroup) =>
                    headerGroup.headers.map((header) => (
                      <Table.Column key={header.id} isRowHeader={header.id === 'id'}>
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
                      <Icon icon="solar:map-point-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">Belum ada lokasi penyimpanan.</span>
                    </EmptyState>
                  )}
                >
                  {isLoadingLokasi || isFetchingLokasi ? (
                    <Table.Row id="loading-row">
                      <Table.Cell className="py-10 text-center" colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          Memuat lokasi penyimpanan...
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <Table.Row key={row.original.id} id={row.original.id}>
                        {row.getVisibleCells().map((cell) => (
                          <Table.Cell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</Table.Cell>
                        ))}
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
            <Table.Footer className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {lokasiRows.length} lokasi ditemukan, {lokasiSummary.occupied} lokasi sedang terisi
              </span>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>

      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-90">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-danger-soft text-danger-soft-foreground">
                  <Icon icon="solar:trash-bin-trash-linear" className="size-5" />
                </Modal.Icon>
                <Modal.Heading>Hapus Gudang</Modal.Heading>
                <p className="mt-1 text-sm leading-5 text-muted">
                  Gudang <span className="font-semibold text-foreground">{warehouse.nama}</span> akan dihapus bersama referensi foto yang tersimpan pada server.
                </p>
              </Modal.Header>
              <Modal.Body>
                <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 p-4 text-sm text-danger">
                  Pastikan tidak ada proses operasional aktif yang masih membutuhkan record ini.
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => setDeleteModalOpen(false)} isDisabled={isDeletingWarehouse}>
                  Batal
                </Button>
                <Button variant="danger" onPress={() => void handleDeleteWarehouse()} isPending={isDeletingWarehouse}>
                  {({ isPending }) => (
                    <>
                      <Icon icon={isPending ? 'solar:refresh-linear' : 'solar:trash-bin-trash-linear'} className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
                      {isPending ? 'Menghapus Gudang...' : 'Hapus Gudang'}
                    </>
                  )}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={importModalOpen} onOpenChange={setImportModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-125">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Import Lokasi Penyimpanan</Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  Upload file CSV atau Excel untuk mengimport data lokasi penyimpanan.
                </p>
              </Modal.Header>
              <Form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleImport();
                }}
              >
                <Modal.Body className="space-y-4">
                  <div className="p-2">
                    <label className="text-sm font-medium">Pilih File</label>
                    <div className="flex gap-2">
                      <Input
                        value={importFile?.name ?? ''}
                        readOnly
                        variant="secondary"
                        placeholder="Pilih file CSV/XLSX"
                        className="flex-1"
                      />
                      <label className="inline-flex cursor-pointer items-center rounded-xl border border-default-300 px-3 text-sm font-medium text-foreground hover:bg-default-100">
                        Browse
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          className="hidden"
                          onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                  </div>

                  {feedbackMessage && (
                    <p
                      className={`rounded-xl border px-3 py-2 text-sm ${feedbackTone === 'success'
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-danger/30 bg-danger/10 text-danger'
                        }`}
                    >
                      {feedbackMessage}
                    </p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="ghost" onPress={() => setImportModalOpen(false)}>
                    Batal
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onPress={() => setImportFile(null)}
                    isDisabled={!importFile}
                  >
                    Reset File
                  </Button>
                  <Button type="submit" variant="primary" isDisabled={isImporting || !importFile}>
                    {isImporting ? 'Mengimport...' : 'Import'}
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={exportModalOpen} onOpenChange={setExportModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-100">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Export Lokasi Penyimpanan</Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  Pilih format file untuk mengekspor data lokasi penyimpanan.
                </p>
              </Modal.Header>
              <Modal.Body className="space-y-4">
                <div className="grid gap-3">
                  <Button
                    variant="secondary"
                    isDisabled={isExporting}
                    onPress={() => {
                      void exportLokasi('csv');
                      setExportModalOpen(false);
                    }}
                    className="justify-start"
                  >
                    <Icon icon="solar:file-text-linear" className="size-4" />
                    Export sebagai CSV
                  </Button>
                  <Button
                    variant="secondary"
                    isDisabled={isExporting}
                    onPress={() => {
                      void exportLokasi('xlsx');
                      setExportModalOpen(false);
                    }}
                    className="justify-start"
                  >
                    <Icon icon="solar:file-linear" className="size-4" />
                    Export sebagai XLSX
                  </Button>
                </div>

                {feedbackMessage && (
                  <p
                    className={`rounded-xl border px-3 py-2 text-sm ${feedbackTone === 'success'
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-danger/30 bg-danger/10 text-danger'
                      }`}
                  >
                    {feedbackMessage}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setExportModalOpen(false)}>
                  Batal
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal isOpen={lokasiModalOpen} onOpenChange={setLokasiModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-125">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{editingId ? 'Edit Lokasi Penyimpanan' : 'Tambah Lokasi Penyimpanan'}</Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  {editingId ? 'Ubah informasi lokasi penyimpanan.' : 'Tambahkan lokasi penyimpanan baru.'}
                </p>
              </Modal.Header>
              <Form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitLokasi();
                }}
              >
                <Modal.Body className="space-y-4">
                  <TextField isRequired>
                    <Label>ID Lokasi</Label>
                    <Input
                      placeholder="Masukkan ID lokasi"
                      value={lokasiIdInput}
                      onChange={(event) => setLokasiIdInput(event.target.value)}
                      variant="secondary"
                    />
                  </TextField>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select
                      selectedKey={statusInput}
                      onSelectionChange={(key) => setStatusInput(key as LokasiStatus)}
                      variant="secondary"
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {lokasiStatusValues.map((status) => (
                            <ListBox.Item key={status}>
                              {status}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  {feedbackMessage && (
                    <p
                      className={`rounded-xl border px-3 py-2 text-sm ${feedbackTone === 'success'
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-danger/30 bg-danger/10 text-danger'
                        }`}
                    >
                      {feedbackMessage}
                    </p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="ghost" onPress={() => setLokasiModalOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" variant="primary" isDisabled={isSubmitting}>
                    {isSubmitting ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Lokasi'}
                  </Button>
                </Modal.Footer>
              </Form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
