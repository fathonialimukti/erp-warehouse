import { useMemo, useState, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Chip, Dropdown, EmptyState, Form, Input, Label, Modal, Spinner, Table, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import EntityPhoto from '../../components/EntityPhoto';
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

function DetailField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <div className={mono ? 'mt-2 break-all font-mono text-sm text-foreground' : 'mt-2 text-sm text-foreground'}>{value}</div>
    </div>
  );
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
  const totalKapasitas = useMemo(
    () =>
      jenisPaletRows.reduce((total, row) => {
        const isi = toNumber(row.isiPerKemasan) ?? 0;
        return total + row.kemasanPerPalet * isi;
      }, 0),
    [jenisPaletRows]
  );
  const jenisPaletDenganDimensi = useMemo(
    () => jenisPaletRows.filter((row) => row.panjang || row.lebar || row.tinggi).length,
    [jenisPaletRows]
  );
  const beratMaksTersedia = useMemo(
    () => jenisPaletRows.filter((row) => toNumber(row.beratMaks) !== null).length,
    [jenisPaletRows]
  );

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
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.palletTypeRequired', defaultMessage: 'Pallet type code and name are required.' }));
      return;
    }

    if (!Number.isInteger(parsedKemasanPerPalet) || parsedKemasanPerPalet <= 0) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.packagesPerPalletInvalid', defaultMessage: 'Packages per pallet must be a positive integer.' }));
      return;
    }

    if (Number.isNaN(parsedIsiPerKemasan) || parsedIsiPerKemasan < 0) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.quantityPerPackageInvalid', defaultMessage: 'Quantity per package must be 0 or greater.' }));
      return;
    }

    const parsedPanjang = panjang.trim() ? Number(panjang) : undefined;
    const parsedLebar = lebar.trim() ? Number(lebar) : undefined;
    const parsedTinggi = tinggi.trim() ? Number(tinggi) : undefined;
    const parsedBeratMaks = beratMaks.trim() ? Number(beratMaks) : undefined;

    if (parsedPanjang !== undefined && (!Number.isInteger(parsedPanjang) || parsedPanjang < 0)) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.lengthInvalid', defaultMessage: 'Length must be a non-negative integer.' }));
      return;
    }

    if (parsedLebar !== undefined && (!Number.isInteger(parsedLebar) || parsedLebar < 0)) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.widthInvalid', defaultMessage: 'Width must be a non-negative integer.' }));
      return;
    }

    if (parsedTinggi !== undefined && (!Number.isInteger(parsedTinggi) || parsedTinggi < 0)) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.heightInvalid', defaultMessage: 'Height must be a non-negative integer.' }));
      return;
    }

    if (parsedBeratMaks !== undefined && (Number.isNaN(parsedBeratMaks) || parsedBeratMaks < 0)) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.weightLimitInvalid', defaultMessage: 'Maximum weight must be 0 or greater.' }));
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
        setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.palletTypeUpdated', defaultMessage: 'Pallet type updated successfully.' }));
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
        setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.palletTypeCreated', defaultMessage: 'Pallet type added successfully.' }));
      }

      setJenisPaletModalOpen(false);
      clearJenisPaletForm();
      await refetchJenisPalet();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.detail.errors.savePalletTypeFailed', defaultMessage: 'Failed to save pallet type.' }));
    } finally {
      setIsSubmittingJenisPalet(false);
    }
  };

  const deleteJenisPalet = async (jenisPaletId: string) => {
    const confirmed = confirm(intl.formatMessage({ id: 'sku.detail.confirmDeletePalletType', defaultMessage: 'Delete this pallet type?' }));
    if (!confirmed) {
      return;
    }

    setFeedbackMessage(null);

    try {
      await trpcClient.jenisPalet.delete.mutate({ id: jenisPaletId });
      setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.palletTypeDeleted', defaultMessage: 'Pallet type deleted successfully.' }));
      await refetchJenisPalet();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.detail.errors.deletePalletTypeFailed', defaultMessage: 'Failed to delete pallet type.' }));
    }
  };

  const columns = useMemo<ColumnDef<JenisPaletRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: intl.formatMessage({ id: 'sku.detail.tableHeaderCode', defaultMessage: 'Code' }),
      },
      {
        accessorKey: 'nama',
        header: intl.formatMessage({ id: 'sku.detail.tableHeaderPalletTypeName', defaultMessage: 'Pallet Type Name' }),
      },
      {
        id: 'ringkasanKemasan',
        header: intl.formatMessage({ id: 'sku.detail.tableHeaderSummary', defaultMessage: 'Summary' }),
        cell: ({ row }) => formatTotal(row.original),
      },
      {
        id: 'dimensi',
        header: intl.formatMessage({ id: 'sku.detail.tableHeaderDimensions', defaultMessage: 'Dimensions (L x W x H)' }),
        cell: ({ row }) => {
          const p = row.original.panjang ?? '-';
          const l = row.original.lebar ?? '-';
          const t = row.original.tinggi ?? '-';
          return `${p} x ${l} x ${t}`;
        },
      },
      {
        accessorKey: 'beratMaks',
        header: intl.formatMessage({ id: 'sku.detail.tableHeaderMaxWeight', defaultMessage: 'Max Weight' }),
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
              <Dropdown.Menu aria-label={intl.formatMessage({ id: 'sku.detail.palletTypeActionsMenuAria', defaultMessage: 'Pallet type actions' })}>
                <Dropdown.Item key="edit" onPress={() => startEditJenisPalet(row.original)}>
                  <Icon icon="solar:pen-linear" className="size-4" />
                  {intl.formatMessage({ id: 'sku.detail.actionEditPalletType', defaultMessage: 'Edit pallet type' })}
                </Dropdown.Item>
                <Dropdown.Item key="delete" variant="danger" onPress={() => void deleteJenisPalet(row.original.id)}>
                  <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                  {intl.formatMessage({ id: 'sku.detail.actionDeletePalletType', defaultMessage: 'Delete pallet type' })}
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
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'sku.detail.loading', defaultMessage: 'Loading SKU details...' })}</p>;
  }

  if (!sku) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">{intl.formatMessage({ id: 'sku.detail.notFound', defaultMessage: 'SKU not found.' })}</p>
        <Button variant="ghost" onPress={() => navigate('/skus')}>
          {intl.formatMessage({ id: 'sku.detail.backToSkuList', defaultMessage: 'Back to SKU list' })}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <Card className="overflow-hidden border border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96)_48%,rgba(14,116,144,0.9))] text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <Card.Content className="grid gap-6 p-6 md:grid-cols-[280px_1fr] md:p-8">
          <div className="space-y-4">
            <div className="rounded-[2rem] border border-white/12 bg-white/6 p-3 backdrop-blur-sm">
              <EntityPhoto src={sku.foto} alt={sku.nama} className="h-64 w-full rounded-[1.4rem] border border-white/12 object-cover" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">SKU Code</p>
              <p className="mt-2 font-mono text-sm text-white">{sku.id}</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/72">
                  <Icon icon="solar:box-minimalistic-linear" className="size-4" />
                  SKU Packaging Profile
                </div>
                <div>
                  <Card.Title className="text-3xl text-white">{sku.nama}</Card.Title>
                  <Card.Description className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                    {intl.formatMessage({ id: 'sku.detail.heroDescription', defaultMessage: 'Quick SKU summary, photo readiness, and pallet type configuration for storage and distribution needs.' })}
                  </Card.Description>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="soft" color="accent">
                    {intl.formatMessage({ id: 'sku.detail.chipPalletTypeCount', defaultMessage: '{count} pallet types' }, { count: jenisPaletRows.length })}
                  </Chip>
                  <Chip size="sm" variant="soft" color={sku.foto ? 'success' : 'default'}>
                    {sku.foto ? intl.formatMessage({ id: 'sku.detail.chipPhotoAvailable', defaultMessage: 'Photo available' }) : intl.formatMessage({ id: 'sku.detail.chipNoPhoto', defaultMessage: 'No photo' })}
                  </Chip>
                  <Chip size="sm" variant="soft" color={beratMaksTersedia > 0 ? 'warning' : 'default'}>
                    {intl.formatMessage({ id: 'sku.detail.chipWeightLimit', defaultMessage: '{count} weight limits' }, { count: beratMaksTersedia })}
                  </Chip>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button variant="secondary" onPress={() => navigate(`/skus/${sku.id}/edit`)}>
                  <Icon icon="solar:pen-linear" className="h-4 w-4" />
                  {intl.formatMessage({ id: 'sku.detail.editSkuButton', defaultMessage: 'Edit SKU' })}
                </Button>
                <Button variant="primary" onPress={startAddJenisPalet}>
                  <Icon icon="solar:add-circle-linear" className="h-4 w-4" />
                  {intl.formatMessage({ id: 'sku.detail.addPalletTypeButton', defaultMessage: 'Add Pallet Type' })}
                </Button>
                <Button variant="ghost" onPress={() => navigate('/skus')}>
                  <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
                  {intl.formatMessage({ id: 'sku.detail.backButton', defaultMessage: 'Back' })}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'sku.detail.overviewDescriptionLabel', defaultMessage: 'Description' })}</p>
                <p className="mt-2 text-sm leading-6 text-white">{sku.deskripsi ?? '-'}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'sku.detail.overviewPalletTypesLabel', defaultMessage: 'Pallet Types' })}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{jenisPaletRows.length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'sku.detail.overviewTotalCapacityLabel', defaultMessage: 'Base Capacity Total' })}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{totalKapasitas.toLocaleString('id-ID')}</p>
                <p className="mt-1 text-xs text-white/60">{intl.formatMessage({ id: 'sku.detail.overviewCapacitySummary', defaultMessage: 'Sum of package quantity per pallet across all configurations' })}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'sku.detail.overviewPhysicalProfileLabel', defaultMessage: 'Physical Profile' })}</p>
                <div className="mt-2 space-y-1 text-sm text-white/88">
                  <p>{intl.formatMessage({ id: 'sku.detail.overviewDimensionCount', defaultMessage: '{count} types with dimensions' }, { count: jenisPaletDenganDimensi })}</p>
                  <p>{intl.formatMessage({ id: 'sku.detail.overviewWeightLimitCount', defaultMessage: '{count} types with max weight' }, { count: beratMaksTersedia })}</p>
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
            <Card.Description>Data SKU yang paling sering dipakai untuk validasi master data dan konfigurasi palet.</Card.Description>
          </Card.Header>
          <Card.Content className="grid gap-3 md:grid-cols-2">
            <DetailField label="Kode SKU" value={sku.id} mono />
            <DetailField label="Nama SKU" value={sku.nama} />
            <DetailField label={intl.formatMessage({ id: 'sku.detail.descriptionLabel', defaultMessage: 'Description' })} value={sku.deskripsi ?? '-'} />
          </Card.Content>
        </Card>

        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-base">{intl.formatMessage({ id: 'sku.detail.actionCenterTitle', defaultMessage: 'Action Center' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'sku.detail.actionCenterDescription', defaultMessage: 'Quick access for SKU maintenance and pallet type configuration management.' })}</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-3">
            <Button variant="primary" fullWidth onPress={startAddJenisPalet}>
              <Icon icon="solar:add-circle-linear" className="size-4" />
              {intl.formatMessage({ id: 'sku.detail.addPalletTypeButton', defaultMessage: 'Add Pallet Type' })}
            </Button>
            <Button variant="secondary" fullWidth onPress={() => navigate(`/skus/${sku.id}/edit`)}>
              <Icon icon="solar:pen-linear" className="size-4" />
              {intl.formatMessage({ id: 'sku.detail.editSkuDetailsButton', defaultMessage: 'Edit SKU Details' })}
            </Button>
            <Button variant="ghost" fullWidth onPress={() => navigate('/skus')}>
              <Icon icon="solar:list-linear" className="size-4" />
              {intl.formatMessage({ id: 'sku.detail.backToSkuListButton', defaultMessage: 'Back to SKU list' })}
            </Button>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Card.Title className="text-base">{intl.formatMessage({ id: 'sku.detail.palletTypePanelTitle', defaultMessage: 'Pallet Types' })}</Card.Title>
              <Card.Description>
                {intl.formatMessage({ id: 'sku.detail.palletTypePanelDescription', defaultMessage: 'Table of pallet configurations for this SKU, including capacity, dimensions, and max weight per type.' })}
              </Card.Description>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onPress={() => navigate(`/skus/${sku.id}/edit`)}>
                {intl.formatMessage({ id: 'sku.detail.editSkuButton', defaultMessage: 'Edit SKU' })}
              </Button>
              <Button variant="primary" onPress={startAddJenisPalet}>
                <Icon icon="solar:add-circle-linear" className="size-4" />
                {intl.formatMessage({ id: 'sku.detail.addPalletTypeButton', defaultMessage: 'Add Pallet Type' })}
              </Button>
            </div>
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
              <Table.Content aria-label={intl.formatMessage({ id: 'sku.detail.palletTypeTableAria', defaultMessage: 'Pallet type table' })} className="min-w-full">
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
                      <span className="text-sm text-muted">{intl.formatMessage({ id: 'sku.detail.palletTypeEmptyState', defaultMessage: 'No pallet types available for this SKU.' })}</span>
                    </EmptyState>
                  )}
                >
                  {isLoadingJenisPalet || isFetchingJenisPalet ? (
                    <Table.Row id="loading-row">
                      <Table.Cell className="py-10 text-center" colSpan={columns.length}>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted">
                          <Spinner size="sm" />
                          {intl.formatMessage({ id: 'sku.detail.palletTypeLoading', defaultMessage: 'Loading pallet types...' })}
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
              {intl.formatMessage({ id: 'sku.detail.palletTypeCountSummary', defaultMessage: '{count} pallet types found' }, { count: jenisPaletRows.length })}
            </span>
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
                <Modal.Heading>
                  {editingJenisPaletId
                    ? intl.formatMessage({ id: 'sku.detail.modalTitleEdit', defaultMessage: 'Edit Pallet Type' })
                    : intl.formatMessage({ id: 'sku.detail.modalTitleCreate', defaultMessage: 'Add Pallet Type' })}
                </Modal.Heading>
                <p className="text-sm text-muted mt-1">
                  {editingJenisPaletId
                    ? intl.formatMessage({ id: 'sku.detail.modalDescriptionEdit', defaultMessage: 'Update pallet type data for this SKU.' })
                    : intl.formatMessage({ id: 'sku.detail.modalDescriptionCreate', defaultMessage: 'Add a new pallet type for this SKU.' })}
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
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelCode', defaultMessage: 'Pallet Type Code' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholderCode', defaultMessage: 'Example: PT-A' })}
                        value={kode}
                        onChange={(event) => setKode(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelName', defaultMessage: 'Pallet Type Name' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholderName', defaultMessage: 'Example: Pallet A' })}
                        value={nama}
                        onChange={(event) => setNama(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <div className="md:col-span-2">
                      <TextField>
                        <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelDescription', defaultMessage: 'Description' })}</Label>
                        <Input
                          placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholderDescription', defaultMessage: 'Example: For 6 cartons, 25 kg per carton' })}
                          value={deskripsi}
                          onChange={(event) => setDeskripsi(event.target.value)}
                          variant="secondary"
                        />
                      </TextField>
                    </div>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelPackageName', defaultMessage: 'Package Name' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholderPackageName', defaultMessage: 'carton' })}
                        value={namaKemasan}
                        onChange={(event) => setNamaKemasan(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelPackagesPerPallet', defaultMessage: 'Packages per Pallet' })}</Label>
                      <Input
                        type="number"
                        value={kemasanPerPalet}
                        onChange={(event) => setKemasanPerPalet(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelQuantityPerPackage', defaultMessage: 'Quantity per Package' })}</Label>
                      <Input
                        type="number"
                        value={isiPerKemasan}
                        onChange={(event) => setIsiPerKemasan(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelPackageUnit', defaultMessage: 'Package Unit' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholderPackageUnit', defaultMessage: 'kg' })}
                        value={satuanKemasan}
                        onChange={(event) => setSatuanKemasan(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelLength', defaultMessage: 'Length' })}</Label>
                      <Input
                        type="number"
                        value={panjang}
                        onChange={(event) => setPanjang(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelWidth', defaultMessage: 'Width' })}</Label>
                      <Input
                        type="number"
                        value={lebar}
                        onChange={(event) => setLebar(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelHeight', defaultMessage: 'Height' })}</Label>
                      <Input
                        type="number"
                        value={tinggi}
                        onChange={(event) => setTinggi(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelMaxWeight', defaultMessage: 'Max Weight' })}</Label>
                      <Input
                        type="number"
                        value={beratMaks}
                        onChange={(event) => setBeratMaks(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                  </div>

                  <div className="rounded-xl border border-default-200 bg-default-50 p-3 text-sm">
                    {intl.formatMessage({ id: 'sku.detail.modal.summaryText', defaultMessage: 'Total summary:' })} {Number(kemasanPerPalet || '0')} {namaKemasan || intl.formatMessage({ id: 'sku.detail.modal.summaryPackageFallback', defaultMessage: 'packages' })} x {Number(isiPerKemasan || '0')} {satuanKemasan || intl.formatMessage({ id: 'sku.detail.modal.summaryUnitFallback', defaultMessage: 'units' })} = {' '}
                    {(Number(kemasanPerPalet || '0') * Number(isiPerKemasan || '0')).toLocaleString('id-ID')} {satuanKemasan || intl.formatMessage({ id: 'sku.detail.modal.summaryUnitFallback', defaultMessage: 'units' })}
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
                    {intl.formatMessage({ id: 'sku.detail.modal.cancel', defaultMessage: 'Cancel' })}
                  </Button>
                  <Button type="submit" variant="primary" isDisabled={isSubmittingJenisPalet}>
                    {isSubmittingJenisPalet ? intl.formatMessage({ id: 'sku.detail.modal.saving', defaultMessage: 'Saving...' }) : editingJenisPaletId ? intl.formatMessage({ id: 'sku.detail.modal.submitUpdate', defaultMessage: 'Save Changes' }) : intl.formatMessage({ id: 'sku.detail.modal.submitCreate', defaultMessage: 'Add Pallet Type' })}
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
