import { useMemo, useState } from 'react';
import { Button, Card, Dropdown, EmptyState, Form, Input, Label, Modal, Spinner, Table, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { trpcClient } from '../../lib/trpc';

type JenisPaletRow = {
  id: string;
  nama: string;
  deskripsi: string | null;
  namaKemasan: string;
  kemasanPerPalet: number;
  isiPerKemasan: number | string;
  satuanKemasan: string;
  panjang: number | null;
  lebar: number | null;
  tinggi: number | null;
  beratMaks: number | string | null;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTotal(row: JenisPaletRow) {
  const isi = toNumber(row.isiPerKemasan) ?? 0;
  const total = row.kemasanPerPalet * isi;
  return `${row.kemasanPerPalet} ${row.namaKemasan} x ${isi} ${row.satuanKemasan} = ${total} ${row.satuanKemasan}`;
}

export default function SkuDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [jenisPaletModalOpen, setJenisPaletModalOpen] = useState(false);
  const [editingJenisPaletId, setEditingJenisPaletId] = useState<string | null>(null);
  const [isSubmittingJenisPalet, setIsSubmittingJenisPalet] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'danger' | 'success'>('success');

  const [kode, setKode] = useState('');
  const [nama, setNama] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [namaKemasan, setNamaKemasan] = useState('carton');
  const [kemasanPerPalet, setKemasanPerPalet] = useState('1');
  const [isiPerKemasan, setIsiPerKemasan] = useState('1');
  const [satuanKemasan, setSatuanKemasan] = useState('kg');
  const [panjang, setPanjang] = useState('');
  const [lebar, setLebar] = useState('');
  const [tinggi, setTinggi] = useState('');
  const [beratMaks, setBeratMaks] = useState('');

  const { data: sku, isLoading: isLoadingSku } = useQuery({
    queryKey: ['skuDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.sku.detail.query({ id: id ?? '' }),
  });

  const {
    data: jenisPaletData,
    isLoading: isLoadingJenisPalet,
    isFetching: isFetchingJenisPalet,
    refetch: refetchJenisPalet,
  } = useQuery({
    queryKey: ['jenisPaletBySku', id],
    enabled: Boolean(id),
    queryFn: () =>
      trpcClient.jenisPalet.list.query({
        skuId: id,
        limit: 100,
        page: 1,
      }),
  });

  const jenisPaletRows = useMemo(() => (jenisPaletData?.data ?? []) as JenisPaletRow[], [jenisPaletData?.data]);

  const clearJenisPaletForm = () => {
    setEditingJenisPaletId(null);
    setKode('');
    setNama('');
    setDeskripsi('');
    setNamaKemasan('carton');
    setKemasanPerPalet('1');
    setIsiPerKemasan('1');
    setSatuanKemasan('kg');
    setPanjang('');
    setLebar('');
    setTinggi('');
    setBeratMaks('');
  };

  const setFeedback = (tone: 'danger' | 'success', message: string) => {
    setFeedbackTone(tone);
    setFeedbackMessage(message);
  };

  const startAddJenisPalet = () => {
    clearJenisPaletForm();
    setFeedbackMessage(null);
    setJenisPaletModalOpen(true);
  };

  const startEditJenisPalet = (row: JenisPaletRow) => {
    setEditingJenisPaletId(row.id);
    setKode(row.id);
    setNama(row.nama);
    setDeskripsi(row.deskripsi ?? '');
    setNamaKemasan(row.namaKemasan);
    setKemasanPerPalet(String(row.kemasanPerPalet));
    setIsiPerKemasan(String(toNumber(row.isiPerKemasan) ?? 0));
    setSatuanKemasan(row.satuanKemasan);
    setPanjang(row.panjang ? String(row.panjang) : '');
    setLebar(row.lebar ? String(row.lebar) : '');
    setTinggi(row.tinggi ? String(row.tinggi) : '');
    setBeratMaks(toNumber(row.beratMaks) ? String(row.beratMaks) : '');
    setFeedbackMessage(null);
    setJenisPaletModalOpen(true);
  };

  const submitJenisPalet = async () => {
    if (!id) {
      return;
    }

    const parsedKemasanPerPalet = Number(kemasanPerPalet);
    const parsedIsiPerKemasan = Number(isiPerKemasan);

    if (!kode.trim() || !nama.trim()) {
      setFeedback('danger', 'Kode dan nama jenis palet wajib diisi.');
      return;
    }

    if (!Number.isInteger(parsedKemasanPerPalet) || parsedKemasanPerPalet <= 0) {
      setFeedback('danger', 'Kemasan per palet harus angka bulat lebih dari 0.');
      return;
    }

    if (Number.isNaN(parsedIsiPerKemasan) || parsedIsiPerKemasan < 0) {
      setFeedback('danger', 'Isi per kemasan harus angka 0 atau lebih.');
      return;
    }

    const parsedPanjang = panjang.trim() ? Number(panjang) : undefined;
    const parsedLebar = lebar.trim() ? Number(lebar) : undefined;
    const parsedTinggi = tinggi.trim() ? Number(tinggi) : undefined;
    const parsedBeratMaks = beratMaks.trim() ? Number(beratMaks) : undefined;

    if (parsedPanjang !== undefined && (!Number.isInteger(parsedPanjang) || parsedPanjang < 0)) {
      setFeedback('danger', 'Panjang harus angka bulat 0 atau lebih.');
      return;
    }

    if (parsedLebar !== undefined && (!Number.isInteger(parsedLebar) || parsedLebar < 0)) {
      setFeedback('danger', 'Lebar harus angka bulat 0 atau lebih.');
      return;
    }

    if (parsedTinggi !== undefined && (!Number.isInteger(parsedTinggi) || parsedTinggi < 0)) {
      setFeedback('danger', 'Tinggi harus angka bulat 0 atau lebih.');
      return;
    }

    if (parsedBeratMaks !== undefined && (Number.isNaN(parsedBeratMaks) || parsedBeratMaks < 0)) {
      setFeedback('danger', 'Berat maksimal harus angka 0 atau lebih.');
      return;
    }

    setIsSubmittingJenisPalet(true);
    setFeedbackMessage(null);

    try {
      if (editingJenisPaletId) {
        await trpcClient.jenisPalet.update.mutate({
          id: editingJenisPaletId,
          kode: kode.trim(),
          nama: nama.trim(),
          deskripsi: deskripsi.trim() || undefined,
          skuId: id,
          namaKemasan: namaKemasan.trim() || 'carton',
          kemasanPerPalet: parsedKemasanPerPalet,
          isiPerKemasan: parsedIsiPerKemasan,
          satuanKemasan: satuanKemasan.trim() || 'kg',
          panjang: parsedPanjang,
          lebar: parsedLebar,
          tinggi: parsedTinggi,
          beratMaks: parsedBeratMaks,
        });
        setFeedback('success', 'Jenis palet berhasil diperbarui.');
      } else {
        await trpcClient.jenisPalet.create.mutate({
          kode: kode.trim(),
          nama: nama.trim(),
          deskripsi: deskripsi.trim() || undefined,
          skuId: id,
          namaKemasan: namaKemasan.trim() || 'carton',
          kemasanPerPalet: parsedKemasanPerPalet,
          isiPerKemasan: parsedIsiPerKemasan,
          satuanKemasan: satuanKemasan.trim() || 'kg',
          panjang: parsedPanjang,
          lebar: parsedLebar,
          tinggi: parsedTinggi,
          beratMaks: parsedBeratMaks,
        });
        setFeedback('success', 'Jenis palet berhasil ditambahkan.');
      }

      setJenisPaletModalOpen(false);
      clearJenisPaletForm();
      await refetchJenisPalet();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : 'Gagal menyimpan jenis palet.');
    } finally {
      setIsSubmittingJenisPalet(false);
    }
  };

  const deleteJenisPalet = async (jenisPaletId: string) => {
    const confirmed = confirm('Hapus jenis palet ini?');
    if (!confirmed) {
      return;
    }

    setFeedbackMessage(null);

    try {
      await trpcClient.jenisPalet.delete.mutate({ id: jenisPaletId });
      setFeedback('success', 'Jenis palet berhasil dihapus.');
      await refetchJenisPalet();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : 'Gagal menghapus jenis palet.');
    }
  };

  const columns = useMemo<ColumnDef<JenisPaletRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Kode',
      },
      {
        accessorKey: 'nama',
        header: 'Nama Jenis Palet',
      },
      {
        id: 'ringkasanKemasan',
        header: 'Ringkasan',
        cell: ({ row }) => formatTotal(row.original),
      },
      {
        id: 'dimensi',
        header: 'Dimensi (P x L x T)',
        cell: ({ row }) => {
          const p = row.original.panjang ?? '-';
          const l = row.original.lebar ?? '-';
          const t = row.original.tinggi ?? '-';
          return `${p} x ${l} x ${t}`;
        },
      },
      {
        accessorKey: 'beratMaks',
        header: 'Berat Maks',
        cell: ({ row }) => {
          const value = toNumber(row.original.beratMaks);
          return value === null ? '-' : `${value} ${row.original.satuanKemasan}`;
        },
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
              <Dropdown.Menu aria-label="Jenis Palet actions">
                <Dropdown.Item key="edit" onPress={() => startEditJenisPalet(row.original)}>
                  <Icon icon="solar:pen-linear" className="size-4" />
                  Edit jenis palet
                </Dropdown.Item>
                <Dropdown.Item key="delete" variant="danger" onPress={() => void deleteJenisPalet(row.original.id)}>
                  <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                  Hapus jenis palet
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
    data: jenisPaletRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoadingSku) {
    return <p className="text-sm text-muted">Memuat detail SKU...</p>;
  }

  if (!sku) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">SKU tidak ditemukan.</p>
        <Button variant="ghost" onPress={() => navigate('/skus')}>
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Card.Title className="text-2xl">Detail SKU</Card.Title>
          <Card.Description>Kelola informasi SKU dan banyak jenis palet yang terhubung ke SKU ini.</Card.Description>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onPress={() => navigate(`/skus/${sku.id}/edit`)}  className="bg-warning hover:bg-warning-hover text-warning-foreground">
            <Icon icon="solar:pen-linear" className="h-4 w-4" />
            Edit SKU
          </Button>
          <Button variant="ghost" onPress={() => navigate('/skus')}>
            <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <Card>
        <Card.Header>
          <Card.Title className="text-base">Informasi SKU</Card.Title>
          <Card.Description>Ringkasan data SKU.</Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Kode</p>
            <p className="mt-2 text-sm text-foreground">{sku.id}</p>
          </div>
          <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Nama</p>
            <p className="mt-2 text-sm text-foreground">{sku.nama}</p>
          </div>
          <div className="rounded-2xl border border-default-200 bg-default-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Deskripsi</p>
            <p className="mt-2 text-sm text-foreground">{sku.deskripsi ?? '-'}</p>
          </div>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Card.Title className="text-base">Jenis Palet</Card.Title>
              <Card.Description>
                Satu SKU bisa memiliki banyak jenis palet. Contoh: Palet A untuk 6 carton x 25 kg = 150 kg.
              </Card.Description>
            </div>
            <Button variant="primary" onPress={startAddJenisPalet}>
              <Icon icon="solar:add-circle-linear" className="size-4" />
              Tambah Jenis Palet
            </Button>
          </div>
        </Card.Header>

        <Card.Content className="space-y-4">
          {feedbackMessage && (
            <p
              className={`rounded-xl border px-3 py-2 text-sm ${
                feedbackTone === 'success'
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-danger/30 bg-danger/10 text-danger'
              }`}
            >
              {feedbackMessage}
            </p>
          )}

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Jenis palet table" className="min-w-full">
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
                      <Icon icon="solar:box-linear" className="size-6 text-muted" />
                      <span className="text-sm text-muted">Belum ada jenis palet untuk SKU ini.</span>
                    </EmptyState>
                  )}
                >
                  {isLoadingJenisPalet || isFetchingJenisPalet ? (
                    <Table.Row id="loading-row">
                      <Table.Cell className="py-10 text-center" colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          Memuat jenis palet...
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
              <span className="text-sm text-gray-600 dark:text-gray-400">{jenisPaletRows.length} jenis palet ditemukan</span>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>

      <Modal isOpen={jenisPaletModalOpen} onOpenChange={setJenisPaletModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-175">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{editingJenisPaletId ? 'Edit Jenis Palet' : 'Tambah Jenis Palet'}</Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  {editingJenisPaletId
                    ? 'Ubah data jenis palet untuk SKU ini.'
                    : 'Tambahkan jenis palet baru untuk SKU ini.'}
                </p>
              </Modal.Header>
              <Form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitJenisPalet();
                }}
              >
                <Modal.Body className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <TextField isRequired>
                      <Label>Kode Jenis Palet</Label>
                      <Input
                        placeholder="Contoh: JP-A"
                        value={kode}
                        onChange={(event) => setKode(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>Nama Jenis Palet</Label>
                      <Input
                        placeholder="Contoh: Palet A"
                        value={nama}
                        onChange={(event) => setNama(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <div className="md:col-span-2">
                      <TextField>
                        <Label>Deskripsi</Label>
                        <Input
                          placeholder="Contoh: Untuk 6 carton, 25 kg per carton"
                          value={deskripsi}
                          onChange={(event) => setDeskripsi(event.target.value)}
                          variant="secondary"
                        />
                      </TextField>
                    </div>
                    <TextField>
                      <Label>Nama Kemasan</Label>
                      <Input
                        placeholder="carton"
                        value={namaKemasan}
                        onChange={(event) => setNamaKemasan(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>Kemasan per Palet</Label>
                      <Input
                        type="number"
                        value={kemasanPerPalet}
                        onChange={(event) => setKemasanPerPalet(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>Isi per Kemasan</Label>
                      <Input
                        type="number"
                        value={isiPerKemasan}
                        onChange={(event) => setIsiPerKemasan(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>Satuan Kemasan</Label>
                      <Input
                        placeholder="kg"
                        value={satuanKemasan}
                        onChange={(event) => setSatuanKemasan(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>Panjang</Label>
                      <Input
                        type="number"
                        value={panjang}
                        onChange={(event) => setPanjang(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>Lebar</Label>
                      <Input
                        type="number"
                        value={lebar}
                        onChange={(event) => setLebar(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>Tinggi</Label>
                      <Input
                        type="number"
                        value={tinggi}
                        onChange={(event) => setTinggi(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>Berat Maks</Label>
                      <Input
                        type="number"
                        value={beratMaks}
                        onChange={(event) => setBeratMaks(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                  </div>

                  <div className="rounded-xl border border-default-200 bg-default-50 p-3 text-sm">
                    Ringkasan total: {Number(kemasanPerPalet || '0')} {namaKemasan || 'kemasan'} x {Number(isiPerKemasan || '0')} {satuanKemasan || 'satuan'} ={' '}
                    {(Number(kemasanPerPalet || '0') * Number(isiPerKemasan || '0')).toLocaleString('id-ID')} {satuanKemasan || 'satuan'}
                  </div>

                  {feedbackMessage && (
                    <p
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        feedbackTone === 'success'
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-danger/30 bg-danger/10 text-danger'
                      }`}
                    >
                      {feedbackMessage}
                    </p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button type="button" variant="ghost" onPress={() => setJenisPaletModalOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" variant="primary" isDisabled={isSubmittingJenisPalet}>
                    {isSubmittingJenisPalet ? 'Menyimpan...' : editingJenisPaletId ? 'Simpan Perubahan' : 'Tambah Jenis Palet'}
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
