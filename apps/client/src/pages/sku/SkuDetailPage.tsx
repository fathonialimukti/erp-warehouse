import { useMemo, useState, type Key, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { AlertDialog, Button, Chip, EmptyState, Fieldset, Spinner, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { type Table as TanstackTable, type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { IntlShape } from 'react-intl';
import EntityPhoto from '../../components/EntityPhoto';
import { trpcClient } from '../../lib/trpc';
import _PalletTypeFormModal from './_PalletTypeFormModal.tsx';

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
    <div className="rounded-2xl border border-border/60 bg-surface-secondary/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`mt-2 text-sm leading-6 text-foreground ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface p-4 shadow-sm shadow-black/2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}

interface SkuPalletTypeTableSectionProps {
  intl: IntlShape;
  table: TanstackTable<PalletTypeRow>;
  columns: ColumnDef<PalletTypeRow>[];
  palletTypeCount: number;
  isLoadingPalletType: boolean;
  isFetchingPalletType: boolean;
  onPalletTypeRowAction: (key: Key) => void;
  onAddPalletType: () => void;
}

function SkuPalletTypeTableSection({
  intl,
  table,
  columns,
  palletTypeCount,
  isLoadingPalletType,
  isFetchingPalletType,
  onPalletTypeRowAction,
  onAddPalletType,
}: SkuPalletTypeTableSectionProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onPress={onAddPalletType}>
            <Icon icon="solar:add-circle-linear" className="size-4" />
            {intl.formatMessage({ id: 'sku.detail.addPalletTypeButton', defaultMessage: 'Add Pallet Type' })}
          </Button>
        </div>
      </div>

      <Table>
        <Table.ScrollContainer>
          <Table.Content
            aria-label={intl.formatMessage({ id: 'sku.detail.palletTypeTableAria', defaultMessage: 'Pallet type table' })}
            className="min-w-full"
            onRowAction={onPalletTypeRowAction}
          >
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
        <Table.Footer className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted">
            {intl.formatMessage({ id: 'sku.detail.palletTypeCountSummary', defaultMessage: '{count} pallet types found' }, { count: palletTypeCount })}
          </span>
        </Table.Footer>
      </Table>
    </>
  );
}

export default function SkuDetailPage() {
  const { id } = useParams();
  const intl = useIntl();
  const navigate = useNavigate();

  const [palletTypeModalOpen, setPalletTypeModalOpen] = useState(false);
  const [palletTypeModalMode, setPalletTypeModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingPalletTypeId, setEditingPalletTypeId] = useState<string | null>(null);
  const [isSubmittingPalletType, setIsSubmittingPalletType] = useState(false);
  const [deletePalletTypeModalOpen, setDeletePalletTypeModalOpen] = useState(false);
  const [deletingPalletTypeId, setDeletingPalletTypeId] = useState<string | null>(null);
  const [isDeletingPalletType, setIsDeletingPalletType] = useState(false);
  const [deleteSkuModalOpen, setDeleteSkuModalOpen] = useState(false);
  const [isDeletingSku, setIsDeletingSku] = useState(false);
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'danger'>('success');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [selectedPalletType, setSelectedPalletType] = useState<PalletTypeRow | null>(null);

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

  const palletTypeRows = useMemo(() => {
    const result = palletTypeData as { data: PalletTypeRow[] } | undefined;
    return result?.data ?? [];
  }, [palletTypeData]);

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

  const startAddPalletType = () => {
    setPalletTypeModalMode('create');
    setEditingPalletTypeId(null);
    setSelectedPalletType(null);
    setFeedbackMessage(null);
    setPalletTypeModalOpen(true);
  };

  const startEditPalletType = (row: PalletTypeRow) => {
    setPalletTypeModalMode('edit');
    setEditingPalletTypeId(row.id);
    setSelectedPalletType(row);
    setFeedbackMessage(null);
    setPalletTypeModalOpen(true);
  };

  const openPalletTypeDetail = (row: PalletTypeRow) => {
    setPalletTypeModalMode('view');
    setEditingPalletTypeId(null);
    setSelectedPalletType(row);
    setFeedbackMessage(null);
    setPalletTypeModalOpen(true);
  };

  const handlePalletTypeModalOpenChange = (open: boolean) => {
    setPalletTypeModalOpen(open);

    if (!open) {
      setEditingPalletTypeId(null);
      setSelectedPalletType(null);
    }
  };

  const handlePalletTypeRowAction = (key: Key) => {
    const row = palletTypeRows.find((item) => item.id === String(key));
    if (row) {
      openPalletTypeDetail(row);
    }
  };

  const openDeletePalletTypeModal = (palletTypeId: string) => {
    setDeletingPalletTypeId(palletTypeId);
    setDeletePalletTypeModalOpen(true);
  };

  const handleDeletePalletTypeModalOpenChange = (open: boolean) => {
    setDeletePalletTypeModalOpen(open);

    if (!open && !isDeletingPalletType) {
      setDeletingPalletTypeId(null);
    }
  };

  const openDeleteSkuModal = () => {
    setDeleteSkuModalOpen(true);
  };

  const handleDeleteSkuModalOpenChange = (open: boolean) => {
    setDeleteSkuModalOpen(open);
  };

  const submitPalletType = async (data: {
    id: string;
    name: string;
    description: string;
    packageName: string;
    packagesPerPallet: number;
    quantityPerPackage: number;
    packageUnit: string;
    length: number | null;
    width: number | null;
    height: number | null;
    maxWeight: number | null;
  }) => {
    if (!id) {
      return;
    }

    setIsSubmittingPalletType(true);
    setFeedbackMessage(null);

    try {
      if (editingPalletTypeId) {
        await trpcClient.palletType.update.mutate({
          id: editingPalletTypeId,
          newId: data.id,
          name: data.name,
          description: data.description,
          skuId: id,
          packageName: data.packageName,
          packagesPerPallet: data.packagesPerPallet,
          quantityPerPackage: data.quantityPerPackage,
          packageUnit: data.packageUnit,
          length: data.length ?? undefined,
          width: data.width ?? undefined,
          height: data.height ?? undefined,
          maxWeight: data.maxWeight ?? undefined,
        });
        setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.palletTypeUpdated', defaultMessage: 'Pallet type updated successfully.' }));
      } else {
        await trpcClient.palletType.create.mutate({
          id: data.id,
          name: data.name,
          description: data.description,
          skuId: id,
          packageName: data.packageName,
          packagesPerPallet: data.packagesPerPallet,
          quantityPerPackage: data.quantityPerPackage,
          packageUnit: data.packageUnit,
          length: data.length ?? undefined,
          width: data.width ?? undefined,
          height: data.height ?? undefined,
          maxWeight: data.maxWeight ?? undefined,
        });
        setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.palletTypeCreated', defaultMessage: 'Pallet type added successfully.' }));
      }

      setPalletTypeModalOpen(false);
      setEditingPalletTypeId(null);
      await refetchPalletType();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.detail.errors.savePalletTypeFailed', defaultMessage: 'Failed to save pallet type.' }));
    } finally {
      setIsSubmittingPalletType(false);
    }
  };

  const deletePalletType = async () => {
    if (!deletingPalletTypeId) {
      return;
    }

    setIsDeletingPalletType(true);
    setFeedbackMessage(null);

    try {
      await trpcClient.palletType.delete.mutate({ id: deletingPalletTypeId });
      setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.palletTypeDeleted', defaultMessage: 'Pallet type deleted successfully.' }));
      setDeletePalletTypeModalOpen(false);
      setDeletingPalletTypeId(null);
      await refetchPalletType();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.detail.errors.deletePalletTypeFailed', defaultMessage: 'Failed to delete pallet type.' }));
    } finally {
      setIsDeletingPalletType(false);
    }
  };

  const deleteSku = async () => {
    if (!id) {
      return;
    }

    setIsDeletingSku(true);
    setFeedbackMessage(null);

    try {
      await trpcClient.sku.delete.mutate({ id });
      setDeleteSkuModalOpen(false);
      navigate('/skus');
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.detail.errors.deleteSkuFailed', defaultMessage: 'Failed to delete SKU.' }));
    } finally {
      setIsDeletingSku(false);
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
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label={intl.formatMessage({ id: 'sku.detail.actionEditPalletType', defaultMessage: 'Edit pallet type' })}
              onClick={(event) => event.stopPropagation()}
              onPress={() => startEditPalletType(row.original)}
            >
              <Icon icon="solar:pen-linear" className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              aria-label={intl.formatMessage({ id: 'sku.detail.actionDeletePalletType', defaultMessage: 'Delete pallet type' })}
              onClick={(event) => event.stopPropagation()}
              onPress={() => openDeletePalletTypeModal(row.original.id)}
            >
              <Icon icon="solar:trash-bin-trash-linear" className="size-4" />
            </Button>
          </div>
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

  const activePalletType = palletTypeModalMode === 'create'
    ? null
    : palletTypeRows.find((row) => row.id === editingPalletTypeId || row.id === selectedPalletType?.id) ?? selectedPalletType;
  const deletingPalletType = palletTypeRows.find((row) => row.id === deletingPalletTypeId) ?? null;

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
    <section className="space-y-6">
      <Fieldset className="overflow-hidden border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.08),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,255,255,1))] shadow-[0_18px_48px_rgba(12,74,110,0.08)] dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,rgba(33,37,41,0.98),rgba(33,37,41,1))]">
        <Fieldset.Legend className="sr-only">
          {intl.formatMessage({ id: 'sku.detail.heroLegend', defaultMessage: 'SKU Packaging Profile Overview' })}
        </Fieldset.Legend>
        <div className="grid gap-6 p-5 lg:grid-cols-[260px_1fr] lg:p-6">
          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-border/60 bg-surface p-3 shadow-sm shadow-black/3">
              <EntityPhoto src={sku.photo} alt={sku.name} className="h-64 w-full rounded-[1.25rem] border border-border/50 object-cover" />
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface-secondary/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {intl.formatMessage({ id: 'sku.detail.codeLabel', defaultMessage: 'SKU Code' })}
              </p>
              <p className="mt-2 font-mono text-sm text-foreground">{sku.id}</p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-4">
                <Chip size="sm" variant="soft" color="accent" className="w-fit">
                  <Icon icon="solar:box-minimalistic-linear" className="size-4" />
                  {intl.formatMessage({ id: 'sku.detail.heroEyebrow', defaultMessage: 'SKU Packaging Profile' })}
                </Chip>
                <div className="space-y-3">
                  <h1 className="text-3xl tracking-tight text-foreground">{sku.name}</h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted">
                    {intl.formatMessage({ id: 'sku.detail.heroDescription', defaultMessage: 'Quick SKU summary, photo readiness, and pallet type configuration for storage and distribution needs.' })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Chip size="sm" variant="primary" color="accent">
                    {intl.formatMessage({ id: 'sku.detail.chipPalletTypeCount', defaultMessage: '{count} pallet types' }, { count: palletTypeRows.length })}
                  </Chip>
                  <Chip size="sm" variant="primary" color={sku.photo ? 'success' : 'default'}>
                    {sku.photo ? intl.formatMessage({ id: 'sku.detail.chipPhotoAvailable', defaultMessage: 'Photo available' }) : intl.formatMessage({ id: 'sku.detail.chipNoPhoto', defaultMessage: 'No photo' })}
                  </Chip>
                  <Chip size="sm" variant="primary" color={weightLimitCount > 0 ? 'warning' : 'default'}>
                    {intl.formatMessage({ id: 'sku.detail.chipWeightLimit', defaultMessage: '{count} weight limits' }, { count: weightLimitCount })}
                  </Chip>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                <Button variant="ghost" onPress={() => navigate('/skus')}>
                  <Icon icon="solar:alt-arrow-left-linear" className="h-4 w-4" />
                  {intl.formatMessage({ id: 'sku.detail.backButton', defaultMessage: 'Back' })}
                </Button>
                <Button variant="danger" onPress={openDeleteSkuModal}>
                  <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                  {intl.formatMessage({ id: 'sku.detail.deleteSkuButton', defaultMessage: 'Delete SKU' })}
                </Button>
                <Button variant="primary" onPress={() => navigate(`/skus/${sku.id}/edit`)}>
                  <Icon icon="solar:pen-linear" className="h-4 w-4" />
                  {intl.formatMessage({ id: 'sku.detail.editSkuButton', defaultMessage: 'Edit SKU' })}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.overviewPalletTypesLabel', defaultMessage: 'Pallet Types' })}
                value={palletTypeRows.length}
                hint={intl.formatMessage({ id: 'sku.detail.metricPalletTypesHint', defaultMessage: 'Configured pallet profiles currently available for this SKU.' })}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.overviewTotalCapacityLabel', defaultMessage: 'Base Capacity Total' })}
                value={totalCapacity.toLocaleString('id-ID')}
                hint={intl.formatMessage({ id: 'sku.detail.overviewCapacitySummary', defaultMessage: 'Sum of package quantity per pallet across all configurations' })}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.overviewDimensionCoverageLabel', defaultMessage: 'Dimension Coverage' })}
                value={intl.formatMessage({ id: 'sku.detail.overviewDimensionCount', defaultMessage: '{count} types with dimensions' }, { count: palletTypeWithDimensions })}
                hint={intl.formatMessage({ id: 'sku.detail.metricDimensionHint', defaultMessage: 'Physical dimensions are used for storage fit and handling planning.' })}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.overviewWeightLimitLabel', defaultMessage: 'Weight Limits' })}
                value={intl.formatMessage({ id: 'sku.detail.overviewWeightLimitCount', defaultMessage: '{count} types with max weight' }, { count: weightLimitCount })}
                hint={intl.formatMessage({ id: 'sku.detail.metricWeightHint', defaultMessage: 'Configured load limits support safer warehouse operations.' })}
              />
            </div>
          </div>
        </div>
      </Fieldset>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Fieldset className="rounded-2xl border border-border/60 bg-surface p-5">
          <Fieldset.Legend className="mb-3 text-base font-semibold text-foreground">
            {intl.formatMessage({ id: 'sku.detail.snapshotTitle', defaultMessage: 'Operational Snapshot' })}
          </Fieldset.Legend>
          <p className="mb-4 text-sm leading-6 text-muted">
            {intl.formatMessage({ id: 'sku.detail.snapshotDescription', defaultMessage: 'Core SKU master data used by operations, inventory teams, and pallet configuration workflows.' })}
          </p>
          <Fieldset.Group className="grid gap-3 md:grid-cols-2">
            <DetailField label={intl.formatMessage({ id: 'sku.detail.codeLabel', defaultMessage: 'SKU Code' })} value={sku.id} mono />
            <DetailField label={intl.formatMessage({ id: 'sku.detail.nameLabel', defaultMessage: 'SKU Name' })} value={sku.name} />
            <DetailField label={intl.formatMessage({ id: 'sku.detail.descriptionLabel', defaultMessage: 'Description' })} value={sku.description ?? '-'} />
            <DetailField
              label={intl.formatMessage({ id: 'sku.detail.photoStatusLabel', defaultMessage: 'Photo Status' })}
              value={sku.photo
                ? intl.formatMessage({ id: 'sku.detail.photoStatusReady', defaultMessage: 'Available and ready for operator reference.' })
                : intl.formatMessage({ id: 'sku.detail.photoStatusMissing', defaultMessage: 'No photo uploaded yet.' })}
            />
          </Fieldset.Group>
        </Fieldset>

        <Fieldset className="rounded-2xl border border-border/60 bg-surface p-5">
          <Fieldset.Legend className="mb-3 text-base font-semibold text-foreground">
            {intl.formatMessage({ id: 'sku.detail.readinessTitle', defaultMessage: 'Packaging Readiness' })}
          </Fieldset.Legend>
          <p className="mb-4 text-sm leading-6 text-muted">
            {intl.formatMessage({ id: 'sku.detail.readinessDescription', defaultMessage: 'A concise status view for how complete this SKU is from a storage and distribution perspective.' })}
          </p>
          <div className="space-y-3">
            <DetailField
              label={intl.formatMessage({ id: 'sku.detail.readinessPalletCoverageLabel', defaultMessage: 'Pallet Coverage' })}
              value={palletTypeRows.length > 0
                ? intl.formatMessage({ id: 'sku.detail.readinessPalletCoverageReady', defaultMessage: '{count} pallet types configured.' }, { count: palletTypeRows.length })
                : intl.formatMessage({ id: 'sku.detail.readinessPalletCoverageMissing', defaultMessage: 'No pallet types configured yet.' })}
            />
            <DetailField
              label={intl.formatMessage({ id: 'sku.detail.readinessDimensionsLabel', defaultMessage: 'Dimensions Recorded' })}
              value={intl.formatMessage({ id: 'sku.detail.readinessDimensionsValue', defaultMessage: '{count} of {total} types include physical dimensions.' }, { count: palletTypeWithDimensions, total: palletTypeRows.length })}
            />
            <DetailField
              label={intl.formatMessage({ id: 'sku.detail.readinessWeightLabel', defaultMessage: 'Weight Control' })}
              value={intl.formatMessage({ id: 'sku.detail.readinessWeightValue', defaultMessage: '{count} of {total} types include maximum weight guidance.' }, { count: weightLimitCount, total: palletTypeRows.length })}
            />
          </div>
        </Fieldset>
      </div>

      <SkuPalletTypeTableSection
        intl={intl}
        table={table}
        columns={columns}
        palletTypeCount={palletTypeRows.length}
        isLoadingPalletType={isLoadingPalletType}
        isFetchingPalletType={isFetchingPalletType}
        onPalletTypeRowAction={handlePalletTypeRowAction}
        onAddPalletType={startAddPalletType}
      />

      <_PalletTypeFormModal
        isOpen={palletTypeModalOpen}
        onOpenChange={handlePalletTypeModalOpenChange}
        mode={palletTypeModalMode}
        palletType={activePalletType}
        onSubmit={submitPalletType}
        isSubmitting={isSubmittingPalletType}
        feedbackMessage={feedbackMessage}
        feedbackTone={feedbackTone}
      />

      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={deletePalletTypeModalOpen}
          onOpenChange={handleDeletePalletTypeModalOpenChange}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-md">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  {intl.formatMessage({ id: 'sku.detail.deletePalletTypeTitle', defaultMessage: 'Delete Pallet Type' })}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <div className="space-y-3 text-sm leading-6 text-muted">
                  <p>
                    {intl.formatMessage(
                      {
                        id: 'sku.detail.deletePalletTypeDescription',
                        defaultMessage: 'Pallet type {name} will be permanently removed from this SKU packaging profile.',
                      },
                      { name: deletingPalletType?.name ?? deletingPalletTypeId ?? '-' }
                    )}
                  </p>
                  <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 p-4 text-danger">
                    {intl.formatMessage({
                      id: 'sku.detail.deletePalletTypeWarning',
                      defaultMessage: 'Make sure this pallet type is no longer needed by storage, handling, or operator workflows.',
                    })}
                  </div>
                </div>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  variant="primary"
                  onPress={() => handleDeletePalletTypeModalOpenChange(false)}
                  isDisabled={isDeletingPalletType}
                >
                  {intl.formatMessage({ id: 'sku.detail.deletePalletTypeCancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button variant="danger" onPress={() => void deletePalletType()} isPending={isDeletingPalletType}>
                  {({ isPending }) => (
                    <>
                      <Icon
                        icon={isPending ? 'solar:refresh-linear' : 'solar:trash-bin-trash-linear'}
                        className={`size-4 ${isPending ? 'animate-spin' : ''}`}
                      />
                      {isPending
                        ? intl.formatMessage({ id: 'sku.detail.deletePalletTypeDeleting', defaultMessage: 'Deleting Pallet Type...' })
                        : intl.formatMessage({ id: 'sku.detail.deletePalletTypeConfirm', defaultMessage: 'Delete Pallet Type' })}
                    </>
                  )}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={deleteSkuModalOpen}
          onOpenChange={handleDeleteSkuModalOpenChange}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-md">
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  {intl.formatMessage({ id: 'sku.detail.deleteSkuTitle', defaultMessage: 'Delete SKU' })}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <div className="space-y-3 text-sm leading-6 text-muted">
                  <p>
                    {intl.formatMessage(
                      {
                        id: 'sku.detail.deleteSkuDescription',
                        defaultMessage: 'SKU {name} will be permanently removed from catalog and packaging workflows.',
                      },
                      { name: sku?.name ?? id ?? '-' }
                    )}
                  </p>
                  <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 p-4 text-danger">
                    {intl.formatMessage({
                      id: 'sku.detail.deleteSkuWarning',
                      defaultMessage: 'Make sure this SKU is no longer required by inventory, warehouse, or pallet planning processes.',
                    })}
                  </div>
                </div>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  variant="primary"
                  onPress={() => handleDeleteSkuModalOpenChange(false)}
                  isDisabled={isDeletingSku}
                >
                  {intl.formatMessage({ id: 'sku.detail.deleteSkuCancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button variant="danger" onPress={() => void deleteSku()} isPending={isDeletingSku}>
                  {({ isPending }) => (
                    <>
                      <Icon
                        icon={isPending ? 'solar:refresh-linear' : 'solar:trash-bin-trash-linear'}
                        className={`size-4 ${isPending ? 'animate-spin' : ''}`}
                      />
                      {isPending
                        ? intl.formatMessage({ id: 'sku.detail.deleteSkuDeleting', defaultMessage: 'Deleting SKU...' })
                        : intl.formatMessage({ id: 'sku.detail.deleteSkuConfirm', defaultMessage: 'Delete SKU' })}
                    </>
                  )}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

    </section>
  );
}
