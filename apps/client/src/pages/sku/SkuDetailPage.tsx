import { useMemo, useState, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Chip, Dropdown, EmptyState, Form, Input, Label, Modal, Spinner, Table, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import EntityPhoto from '../../components/EntityPhoto';
import { trpcClient } from '../../lib/trpc';

type PalletTypeRow = {
  id: string;
  name: string;
  description: string | null;
  packageName: string;
  packagesPerPallet: number;
  quantityPerPackage: number | string;
  packageUnit: string;
  length: number | null;
  width: number | null;
  height: number | null;
  maxWeight: number | string | null;
};

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTotal(row: PalletTypeRow): string {
  const perPackage = toNumber(row.quantityPerPackage) ?? 0;
  const total = row.packagesPerPallet * perPackage;
  return `${row.packagesPerPallet} ${row.packageName} x ${perPackage} ${row.packageUnit} = ${total} ${row.packageUnit}`;
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
      <p className={`mt-2 text-sm ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

export default function SkuDetailPage() {
  const { id } = useParams();
  const intl = useIntl();
  const navigate = useNavigate();

  const [palletTypeModalOpen, setPalletTypeModalOpen] = useState(false);
  const [editingPalletTypeId, setEditingPalletTypeId] = useState<string | null>(null);
  const [isSubmittingPalletType, setIsSubmittingPalletType] = useState(false);
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'danger'>('success');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [packageName, setPackageName] = useState('carton');
  const [packagesPerPallet, setPackagesPerPallet] = useState('1');
  const [quantityPerPackage, setQuantityPerPackage] = useState('1');
  const [packageUnit, setPackageUnit] = useState('kg');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');

  const setFeedback = (tone: 'success' | 'danger', message: string) => {
    setFeedbackTone(tone);
    setFeedbackMessage(message);
  };

  const { data: sku, isLoading: isLoadingSku } = useQuery({
    queryKey: ['skuDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.sku.detail.query({ id: id ?? '' }),
  });

  const {
    data: palletTypeData,
    isLoading: isLoadingPalletType,
    isFetching: isFetchingPalletType,
    refetch: refetchPalletType,
  } = useQuery({
    queryKey: ['palletTypeBySku', id],
    enabled: Boolean(id),
    queryFn: () =>
      trpcClient.palletType.list.query({
        skuId: id,
        limit: 100,
        page: 1,
      }),
  });

  const palletTypeRows = useMemo(
    () => (palletTypeData?.data ?? []) as unknown as PalletTypeRow[],
    [palletTypeData?.data]
  );

  const totalCapacity = useMemo(
    () =>
      palletTypeRows.reduce((total, row) => {
        const perPackage = toNumber(row.quantityPerPackage) ?? 0;
        return total + row.packagesPerPallet * perPackage;
      }, 0),
    [palletTypeRows]
  );

  const palletTypeWithDimensions = useMemo(
    () => palletTypeRows.filter((row) => row.length || row.width || row.height).length,
    [palletTypeRows]
  );

  const weightLimitCount = useMemo(
    () => palletTypeRows.filter((row) => toNumber(row.maxWeight) !== null).length,
    [palletTypeRows]
  );

  const clearPalletTypeForm = () => {
    setEditingPalletTypeId(null);
    setCode('');
    setName('');
    setDescription('');
    setPackageName('carton');
    setPackagesPerPallet('1');
    setQuantityPerPackage('1');
    setPackageUnit('kg');
    setLength('');
    setWidth('');
    setHeight('');
    setMaxWeight('');
  };

  const startAddPalletType = () => {
    clearPalletTypeForm();
    setFeedbackMessage(null);
    setPalletTypeModalOpen(true);
  };

  const startEditPalletType = (row: PalletTypeRow) => {
    setEditingPalletTypeId(row.id);
    setCode(row.id);
    setName(row.name);
    setDescription(row.description ?? '');
    setPackageName(row.packageName);
    setPackagesPerPallet(String(row.packagesPerPallet));
    setQuantityPerPackage(String(toNumber(row.quantityPerPackage) ?? 0));
    setPackageUnit(row.packageUnit);
    setLength(row.length ? String(row.length) : '');
    setWidth(row.width ? String(row.width) : '');
    setHeight(row.height ? String(row.height) : '');
    setMaxWeight(toNumber(row.maxWeight) ? String(row.maxWeight) : '');
    setFeedbackMessage(null);
    setPalletTypeModalOpen(true);
  };

  const submitPalletType = async () => {
    if (!id) {
      return;
    }

    const parsedPackagesPerPallet = Number(packagesPerPallet);
    const parsedQuantityPerPackage = Number(quantityPerPackage);

    if (!code.trim() || !name.trim()) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.palletTypeRequired', defaultMessage: 'Pallet type code and name are required.' }));
      return;
    }

    if (!Number.isInteger(parsedPackagesPerPallet) || parsedPackagesPerPallet <= 0) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.packagesPerPalletInvalid', defaultMessage: 'Packages per pallet must be a positive integer.' }));
      return;
    }

    if (Number.isNaN(parsedQuantityPerPackage) || parsedQuantityPerPackage < 0) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.quantityPerPackageInvalid', defaultMessage: 'Quantity per package must be 0 or greater.' }));
      return;
    }

    const parsedLength = length.trim() ? Number(length) : undefined;
    const parsedWidth = width.trim() ? Number(width) : undefined;
    const parsedHeight = height.trim() ? Number(height) : undefined;
    const parsedMaxWeight = maxWeight.trim() ? Number(maxWeight) : undefined;

    if (parsedLength !== undefined && (!Number.isInteger(parsedLength) || parsedLength < 0)) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.lengthInvalid', defaultMessage: 'Length must be a non-negative integer.' }));
      return;
    }

    if (parsedWidth !== undefined && (!Number.isInteger(parsedWidth) || parsedWidth < 0)) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.widthInvalid', defaultMessage: 'Width must be a non-negative integer.' }));
      return;
    }

    if (parsedHeight !== undefined && (!Number.isInteger(parsedHeight) || parsedHeight < 0)) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.heightInvalid', defaultMessage: 'Height must be a non-negative integer.' }));
      return;
    }

    if (parsedMaxWeight !== undefined && (Number.isNaN(parsedMaxWeight) || parsedMaxWeight < 0)) {
      setFeedback('danger', intl.formatMessage({ id: 'sku.detail.errors.weightLimitInvalid', defaultMessage: 'Maximum weight must be 0 or greater.' }));
      return;
    }

    setIsSubmittingPalletType(true);
    setFeedbackMessage(null);

    try {
      if (editingPalletTypeId) {
        await trpcClient.palletType.update.mutate({
          id: editingPalletTypeId,
          newId: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          skuId: id,
          packageName: packageName.trim() || 'carton',
          packagesPerPallet: parsedPackagesPerPallet,
          quantityPerPackage: parsedQuantityPerPackage,
          packageUnit: packageUnit.trim() || 'kg',
          length: parsedLength,
          width: parsedWidth,
          height: parsedHeight,
          maxWeight: parsedMaxWeight,
        });
        setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.palletTypeUpdated', defaultMessage: 'Pallet type updated successfully.' }));
      } else {
        await trpcClient.palletType.create.mutate({
          id: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          skuId: id,
          packageName: packageName.trim() || 'carton',
          packagesPerPallet: parsedPackagesPerPallet,
          quantityPerPackage: parsedQuantityPerPackage,
          packageUnit: packageUnit.trim() || 'kg',
          length: parsedLength,
          width: parsedWidth,
          height: parsedHeight,
          maxWeight: parsedMaxWeight,
        });
        setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.palletTypeCreated', defaultMessage: 'Pallet type added successfully.' }));
      }

      setPalletTypeModalOpen(false);
      clearPalletTypeForm();
      await refetchPalletType();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.detail.errors.savePalletTypeFailed', defaultMessage: 'Failed to save pallet type.' }));
    } finally {
      setIsSubmittingPalletType(false);
    }
  };

  const deletePalletType = async (palletTypeId: string) => {
    const confirmed = confirm(intl.formatMessage({ id: 'sku.detail.confirmDeletePalletType', defaultMessage: 'Delete this pallet type?' }));
    if (!confirmed) {
      return;
    }

    setFeedbackMessage(null);

    try {
      await trpcClient.palletType.delete.mutate({ id: palletTypeId });
      setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.palletTypeDeleted', defaultMessage: 'Pallet type deleted successfully.' }));
      await refetchPalletType();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.detail.errors.deletePalletTypeFailed', defaultMessage: 'Failed to delete pallet type.' }));
    }
  };

  const columns = useMemo<ColumnDef<PalletTypeRow>[]>(
    () => [
      {
        accessorKey: 'id',
        header: intl.formatMessage({ id: 'sku.detail.tableHeaderCode', defaultMessage: 'Code' }),
      },
      {
        accessorKey: 'name',
        header: intl.formatMessage({ id: 'sku.detail.tableHeaderPalletTypeName', defaultMessage: 'Pallet Type Name' }),
      },
      {
        id: 'packageSummary',
        header: intl.formatMessage({ id: 'sku.detail.tableHeaderSummary', defaultMessage: 'Summary' }),
        cell: ({ row }) => formatTotal(row.original),
      },
      {
        id: 'dimensions',
        header: intl.formatMessage({ id: 'sku.detail.tableHeaderDimensions', defaultMessage: 'Dimensions (L x W x H)' }),
        cell: ({ row }) => {
          const l = row.original.length ?? '-';
          const w = row.original.width ?? '-';
          const h = row.original.height ?? '-';
          return `${l} x ${w} x ${h}`;
        },
      },
      {
        accessorKey: 'maxWeight',
        header: intl.formatMessage({ id: 'sku.detail.tableHeaderMaxWeight', defaultMessage: 'Max Weight' }),
        cell: ({ row }) => {
          const value = toNumber(row.original.maxWeight);
          return value === null ? '-' : `${value} ${row.original.packageUnit}`;
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
                <Dropdown.Item key="edit" onPress={() => startEditPalletType(row.original)}>
                  <Icon icon="solar:pen-linear" className="size-4" />
                  {intl.formatMessage({ id: 'sku.detail.actionEditPalletType', defaultMessage: 'Edit pallet type' })}
                </Dropdown.Item>
                <Dropdown.Item key="delete" variant="danger" onPress={() => void deletePalletType(row.original.id)}>
                  <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
                  {intl.formatMessage({ id: 'sku.detail.actionDeletePalletType', defaultMessage: 'Delete pallet type' })}
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        ),
      },
    ],
    [intl]
  );

  const table = useReactTable({
    data: palletTypeRows,
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
              <EntityPhoto src={sku.photo} alt={sku.name} className="h-64 w-full rounded-[1.4rem] border border-white/12 object-cover" />
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
                  <Card.Title className="text-3xl text-white">{sku.name}</Card.Title>
                  <Card.Description className="mt-2 max-w-2xl text-sm leading-6 text-white/72">
                    {intl.formatMessage({ id: 'sku.detail.heroDescription', defaultMessage: 'Quick SKU summary, photo readiness, and pallet type configuration for storage and distribution needs.' })}
                  </Card.Description>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="soft" color="accent">
                    {intl.formatMessage({ id: 'sku.detail.chipPalletTypeCount', defaultMessage: '{count} pallet types' }, { count: palletTypeRows.length })}
                  </Chip>
                  <Chip size="sm" variant="soft" color={sku.photo ? 'success' : 'default'}>
                    {sku.photo ? intl.formatMessage({ id: 'sku.detail.chipPhotoAvailable', defaultMessage: 'Photo available' }) : intl.formatMessage({ id: 'sku.detail.chipNoPhoto', defaultMessage: 'No photo' })}
                  </Chip>
                  <Chip size="sm" variant="soft" color={weightLimitCount > 0 ? 'warning' : 'default'}>
                    {intl.formatMessage({ id: 'sku.detail.chipWeightLimit', defaultMessage: '{count} weight limits' }, { count: weightLimitCount })}
                  </Chip>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button variant="secondary" onPress={() => navigate(`/skus/${sku.id}/edit`)}>
                  <Icon icon="solar:pen-linear" className="h-4 w-4" />
                  {intl.formatMessage({ id: 'sku.detail.editSkuButton', defaultMessage: 'Edit SKU' })}
                </Button>
                <Button variant="primary" onPress={startAddPalletType}>
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
                <p className="mt-2 text-sm leading-6 text-white">{sku.description ?? '-'}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'sku.detail.overviewPalletTypesLabel', defaultMessage: 'Pallet Types' })}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{palletTypeRows.length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'sku.detail.overviewTotalCapacityLabel', defaultMessage: 'Base Capacity Total' })}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{totalCapacity.toLocaleString('id-ID')}</p>
                <p className="mt-1 text-xs text-white/60">{intl.formatMessage({ id: 'sku.detail.overviewCapacitySummary', defaultMessage: 'Sum of package quantity per pallet across all configurations' })}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/58">{intl.formatMessage({ id: 'sku.detail.overviewPhysicalProfileLabel', defaultMessage: 'Physical Profile' })}</p>
                <div className="mt-2 space-y-1 text-sm text-white/88">
                  <p>{intl.formatMessage({ id: 'sku.detail.overviewDimensionCount', defaultMessage: '{count} types with dimensions' }, { count: palletTypeWithDimensions })}</p>
                  <p>{intl.formatMessage({ id: 'sku.detail.overviewWeightLimitCount', defaultMessage: '{count} types with max weight' }, { count: weightLimitCount })}</p>
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
            <DetailField label="Nama SKU" value={sku.name} />
            <DetailField label={intl.formatMessage({ id: 'sku.detail.descriptionLabel', defaultMessage: 'Description' })} value={sku.description ?? '-'} />
          </Card.Content>
        </Card>

        <Card variant="secondary">
          <Card.Header>
            <Card.Title className="text-base">{intl.formatMessage({ id: 'sku.detail.actionCenterTitle', defaultMessage: 'Action Center' })}</Card.Title>
            <Card.Description>{intl.formatMessage({ id: 'sku.detail.actionCenterDescription', defaultMessage: 'Quick access for SKU maintenance and pallet type configuration management.' })}</Card.Description>
          </Card.Header>
          <Card.Content className="space-y-3">
            <Button variant="primary" fullWidth onPress={startAddPalletType}>
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
              <Button variant="primary" onPress={startAddPalletType}>
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
                  {isLoadingPalletType || isFetchingPalletType ? (
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
                {intl.formatMessage({ id: 'sku.detail.palletTypeCountSummary', defaultMessage: '{count} pallet types found' }, { count: palletTypeRows.length })}
              </span>
            </Table.Footer>
          </Table>
        </Card.Content>
      </Card>

      <Modal isOpen={palletTypeModalOpen} onOpenChange={setPalletTypeModalOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-175">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>
                  {editingPalletTypeId
                    ? intl.formatMessage({ id: 'sku.detail.modalTitleEdit', defaultMessage: 'Edit Pallet Type' })
                    : intl.formatMessage({ id: 'sku.detail.modalTitleCreate', defaultMessage: 'Add Pallet Type' })}
                </Modal.Heading>
                <p className="mt-1 text-sm text-muted">
                  {editingPalletTypeId
                    ? intl.formatMessage({ id: 'sku.detail.modalDescriptionEdit', defaultMessage: 'Update pallet type data for this SKU.' })
                    : intl.formatMessage({ id: 'sku.detail.modalDescriptionCreate', defaultMessage: 'Add a new pallet type for this SKU.' })}
                </p>
              </Modal.Header>
              <Form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitPalletType();
                }}
              >
                <Modal.Body className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelCode', defaultMessage: 'Pallet Type Code' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholderCode', defaultMessage: 'Example: PT-A' })}
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelName', defaultMessage: 'Pallet Type Name' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholderName', defaultMessage: 'Example: Pallet A' })}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <div className="md:col-span-2">
                      <TextField>
                        <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelDescription', defaultMessage: 'Description' })}</Label>
                        <Input
                          placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholderDescription', defaultMessage: 'Example: For 6 cartons, 25 kg per carton' })}
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          variant="secondary"
                        />
                      </TextField>
                    </div>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelPackageName', defaultMessage: 'Package Name' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholderPackageName', defaultMessage: 'carton' })}
                        value={packageName}
                        onChange={(event) => setPackageName(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelPackagesPerPallet', defaultMessage: 'Packages per Pallet' })}</Label>
                      <Input
                        type="number"
                        value={packagesPerPallet}
                        onChange={(event) => setPackagesPerPallet(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField isRequired>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelQuantityPerPackage', defaultMessage: 'Quantity per Package' })}</Label>
                      <Input
                        type="number"
                        value={quantityPerPackage}
                        onChange={(event) => setQuantityPerPackage(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelPackageUnit', defaultMessage: 'Package Unit' })}</Label>
                      <Input
                        placeholder={intl.formatMessage({ id: 'sku.detail.modal.placeholderPackageUnit', defaultMessage: 'kg' })}
                        value={packageUnit}
                        onChange={(event) => setPackageUnit(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelLength', defaultMessage: 'Length' })}</Label>
                      <Input
                        type="number"
                        value={length}
                        onChange={(event) => setLength(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelWidth', defaultMessage: 'Width' })}</Label>
                      <Input
                        type="number"
                        value={width}
                        onChange={(event) => setWidth(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelHeight', defaultMessage: 'Height' })}</Label>
                      <Input
                        type="number"
                        value={height}
                        onChange={(event) => setHeight(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                    <TextField>
                      <Label>{intl.formatMessage({ id: 'sku.detail.modal.labelMaxWeight', defaultMessage: 'Max Weight' })}</Label>
                      <Input
                        type="number"
                        value={maxWeight}
                        onChange={(event) => setMaxWeight(event.target.value)}
                        variant="secondary"
                      />
                    </TextField>
                  </div>

                  <div className="rounded-xl border border-default-200 bg-default-50 p-3 text-sm">
                    {intl.formatMessage({ id: 'sku.detail.modal.summaryText', defaultMessage: 'Total summary:' })}{' '}
                    {Number(packagesPerPallet || '0')} {packageName || intl.formatMessage({ id: 'sku.detail.modal.summaryPackageFallback', defaultMessage: 'packages' })} x{' '}
                    {Number(quantityPerPackage || '0')} {packageUnit || intl.formatMessage({ id: 'sku.detail.modal.summaryUnitFallback', defaultMessage: 'units' })} ={' '}
                    {(Number(packagesPerPallet || '0') * Number(quantityPerPackage || '0')).toLocaleString('id-ID')} {packageUnit || intl.formatMessage({ id: 'sku.detail.modal.summaryUnitFallback', defaultMessage: 'units' })}
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
                  <Button type="button" variant="ghost" onPress={() => setPalletTypeModalOpen(false)}>
                    {intl.formatMessage({ id: 'sku.detail.modal.cancel', defaultMessage: 'Cancel' })}
                  </Button>
                  <Button type="submit" variant="primary" isDisabled={isSubmittingPalletType}>
                    {isSubmittingPalletType
                      ? intl.formatMessage({ id: 'sku.detail.modal.saving', defaultMessage: 'Saving...' })
                      : editingPalletTypeId
                      ? intl.formatMessage({ id: 'sku.detail.modal.submitUpdate', defaultMessage: 'Save Changes' })
                      : intl.formatMessage({ id: 'sku.detail.modal.submitCreate', defaultMessage: 'Add Pallet Type' })}
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
