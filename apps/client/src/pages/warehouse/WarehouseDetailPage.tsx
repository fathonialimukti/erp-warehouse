import { useMemo, useState } from 'react';
import { Button, Card, Chip, Dropdown, EmptyState, Form, Input, Label, ListBox, Modal, Select, Spinner, Table, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
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

  const [lokasiIdInput, setLokasiIdInput] = useState('');
  const [statusInput, setStatusInput] = useState<LokasiStatus>('AKTIF');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Card.Title className="text-2xl">Detail Gudang</Card.Title>
          <Card.Description>Kelola informasi gudang dan lokasi penyimpanan pada gudang ini.</Card.Description>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onPress={() => navigate(`/warehouse/${warehouse.id}/edit`)} className="bg-warning hover:bg-warning-hover text-warning-foreground">
            <Icon icon="solar:pen-linear" className="h-4 w-4" />
            Edit Gudang
          </Button>
          <Button variant="ghost" onPress={() => navigate('/warehouse')}>
            <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <Card>
        <Card.Header>
          <Card.Title className="text-base">Informasi Gudang</Card.Title>
          <Card.Description>Ringkasan data gudang.</Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Kode Gudang</p>
            <p className="mt-2 font-mono text-sm font-medium text-primary">{warehouse.id}</p>
          </div>
          <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Nama</p>
            <p className="mt-2 text-sm text-foreground">{warehouse.nama}</p>
          </div>
          <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Alamat</p>
            <p className="mt-2 text-sm text-foreground">{warehouse.alamat}</p>
          </div>
          <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Kapasitas Total</p>
            <p className="mt-2 text-sm text-foreground">{warehouse.kapasitasTotal?.toLocaleString('id-ID') ?? '-'}</p>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Card.Title className="text-base">Lokasi Penyimpanan</Card.Title>
              <Card.Description>Tabel lokasi untuk gudang ini, termasuk import/export.</Card.Description>
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
                {lokasiRows.length} lokasi ditemukan
              </span>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>

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
