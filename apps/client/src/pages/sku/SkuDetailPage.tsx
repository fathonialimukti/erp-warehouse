import { useMemo, useState, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { AlertDialog, Button, Card, Chip, Label } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { Icon } from '@iconify/react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import EntityPhoto from '../../components/EntityPhoto';
import DeleteSkuDialog from './_DeleteSku.tsx';
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

function formatDimensions(row: PalletTypeRow): string {
  const length = row.length ?? '-';
  const width = row.width ?? '-';
  const height = row.height ?? '-';
  return `${length} x ${width} x ${height}`;
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className='text-muted'>{label}</Label>
      <p>{value}</p>
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
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-muted">{hint}</p> : null}
    </Card>
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

  const weightLimitCount = useMemo(
    () => palletTypeRows.filter((row) => toNumber(row.maxWeight) !== null).length,
    [palletTypeRows]
  );

  const createdPalletCount = useMemo(
    () => palletTypeRows.reduce((total, row) => total + row.packagesPerPallet, 0),
    [palletTypeRows]
  );

  const stockPalletCount = useMemo(() => {
    const types = (sku as { palletTypes?: { pallets?: unknown[] }[] } | undefined)?.palletTypes ?? [];
    return types.reduce((sum, pt) => sum + (pt.pallets?.length ?? 0), 0);
  }, [sku]);

  const stockUnitsInBaseUnit = useMemo(() => {
    const types = (sku as { palletTypes?: { pallets?: unknown[]; packagesPerPallet?: number; quantityPerPackage?: number | string }[] } | undefined)?.palletTypes ?? [];
    return types.reduce((sum, pt) => {
      const count = pt.pallets?.length ?? 0;
      const perPallet = (pt.packagesPerPallet ?? 0) * (toNumber(pt.quantityPerPackage) ?? 0);
      return sum + count * perPallet;
    }, 0);
  }, [sku]);

  const formatDateValue = (value: unknown) => {
    if (!value) {
      return '-';
    }

    const dateValue = value instanceof Date ? value : new Date(String(value));

    if (Number.isNaN(dateValue.getTime())) {
      return '-';
    }

    return intl.formatDate(dateValue, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

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
        setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.pallet_type_updated', defaultMessage: 'Pallet type updated successfully.' }));
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
        setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.pallet_type_created', defaultMessage: 'Pallet type added successfully.' }));
      }

      setPalletTypeModalOpen(false);
      setEditingPalletTypeId(null);
      await refetchPalletType();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.detail.errors.save_pallet_type_failed', defaultMessage: 'Failed to save pallet type.' }));
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
      setFeedback('success', intl.formatMessage({ id: 'sku.detail.feedback.pallet_type_deleted', defaultMessage: 'Pallet type deleted successfully.' }));
      setDeletePalletTypeModalOpen(false);
      setDeletingPalletTypeId(null);
      await refetchPalletType();
    } catch (error) {
      setFeedback('danger', error instanceof Error ? error.message : intl.formatMessage({ id: 'sku.detail.errors.delete_pallet_type_failed', defaultMessage: 'Failed to delete pallet type.' }));
    } finally {
      setIsDeletingPalletType(false);
    }
  };

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
        <p className="text-sm text-danger">{intl.formatMessage({ id: 'sku.detail.not_found', defaultMessage: 'SKU not found.' })}</p>
        <Button variant="ghost" onPress={() => navigate('/skus')}>
          {intl.formatMessage({ id: 'sku.detail.back_to_sku_list', defaultMessage: 'Back to SKU list' })}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={intl.formatMessage({ id: 'sku.detail.page_title', defaultMessage: 'SKU Detail' })}
        onBack={() => navigate('/skus')}
        onEdit={() => navigate(`/skus/${sku.id}/edit`)}
        onDelete={openDeleteSkuModal}
        isDisabled={isDeletingSku}
      />

      <Card
        className="overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(160deg,rgba(8,145,178,0.09)_0%,rgba(56,189,248,0.04)_30%,rgba(255,255,255,0.98)_65%)] p-5 shadow-[0_20px_50px_rgba(3,105,161,0.12)] dark:bg-[linear-gradient(160deg,rgba(8,145,178,0.2)_0%,rgba(56,189,248,0.08)_30%,rgba(39,39,42,0.96)_65%)] lg:p-7"
      >
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <EntityPhoto src={sku.photo} alt={sku.name} className="h-72 w-full rounded-[1.25rem] border border-border/50 object-cover" />

          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                {intl.formatMessage({ id: 'sku.detail.code_label', defaultMessage: 'SKU Code' })}
              </p>
              <p className="font-mono text-sm text-foreground">{sku.id}</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{sku.name}</h1>
              <div className="flex flex-wrap gap-2">
                <Chip variant="primary" color="accent">
                  {intl.formatMessage({ id: 'sku.detail.chip_pallet_type_count', defaultMessage: '{count} pallet types' }, { count: palletTypeRows.length })}
                </Chip>
                <Chip variant="primary" color={sku.photo ? 'success' : 'default'}>
                  {sku.photo ? intl.formatMessage({ id: 'sku.detail.chip_photo_available', defaultMessage: 'Photo available' }) : intl.formatMessage({ id: 'sku.detail.chip_no_photo', defaultMessage: 'No photo' })}
                </Chip>
                <Chip variant="primary" color={weightLimitCount > 0 ? 'warning' : 'default'}>
                  {intl.formatMessage({ id: 'sku.detail.chip_weight_limit', defaultMessage: '{count} weight limits' }, { count: weightLimitCount })}
                </Chip>
              </div>
            </div>


            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DetailField
                label={intl.formatMessage({ id: 'sku.detail.description_label', defaultMessage: 'Description' })}
                value={sku.description ?? '-'}
              />
              <DetailField
                label={intl.formatMessage({ id: 'sku.detail.created_at_label', defaultMessage: 'Created At' })}
                value={formatDateValue(sku.createdAt)}
              />
              <DetailField
                label={intl.formatMessage({ id: 'sku.detail.updated_at_label', defaultMessage: 'Updated At' })}
                value={formatDateValue(sku.updatedAt)}
              />
              <DetailField
                label={intl.formatMessage({ id: 'sku.detail.base_unit_label', defaultMessage: 'Base Unit' })}
                value={sku.baseUnit ?? 'kg'}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-8">
        <div className="space-y-6">

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">
              {intl.formatMessage({ id: 'sku.detail.quick_stats_title', defaultMessage: 'Quick Stats' })}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.overview_pallet_types_label', defaultMessage: 'Pallet Types' })}
                value={palletTypeRows.length}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.quick_stats_created_pallets', defaultMessage: 'Total Pallets From Configurations' })}
                value={createdPalletCount.toLocaleString('id-ID')}
                hint={intl.formatMessage({ id: 'sku.detail.quick_stats_created_pallets_hint', defaultMessage: 'Sum of packages-per-pallet values across all pallet types.' })}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.overview_total_capacity_label', defaultMessage: 'Base Capacity Total' })}
                value={totalCapacity.toLocaleString('id-ID')}
                hint={intl.formatMessage({ id: 'sku.detail.overview_capacity_summary', defaultMessage: 'Sum of package quantity per pallet across all configurations' })}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.quick_stats_current_stock', defaultMessage: 'Current Stock Pallets' })}
                value={`${stockPalletCount.toLocaleString('id-ID')} pallets — ${stockUnitsInBaseUnit.toLocaleString('id-ID')} ${sku?.baseUnit ?? 'unit'}`}
                hint={intl.formatMessage({ id: 'sku.detail.quick_stats_current_stock_hint', defaultMessage: 'Active pallets (PLACED or RECEIVED) across all pallet type configurations.' })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {intl.formatMessage(
                  { id: 'sku.detail.pallet_type_section_title', defaultMessage: 'This SKU has {count} pallet configurations' },
                  { count: palletTypeRows.length }
                )}
              </h2>
              <p className="text-sm text-muted">
                {intl.formatMessage({ id: 'sku.detail.pallet_type_section_description', defaultMessage: 'Each pallet type defines packaging, physical dimensions, and handling limits for this SKU.' })}
              </p>
            </div>
            <Button onPress={startAddPalletType} isDisabled={isFetchingPalletType}>
              <Icon icon="solar:add-circle-linear" className="size-4" />
              {intl.formatMessage({ id: 'sku.detail.add_pallet_type_button', defaultMessage: 'Add Pallet Type' })}
            </Button>
          </div>

          {isLoadingPalletType ? (
            <p className="text-sm text-muted">{intl.formatMessage({ id: 'sku.detail.pallet_type_loading', defaultMessage: 'Loading pallet types...' })}</p>
          ) : null}

          {!isLoadingPalletType && palletTypeRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-surface-secondary/60 p-6 text-sm text-muted">
              {intl.formatMessage({ id: 'sku.detail.pallet_type_empty_state', defaultMessage: 'No pallet types available for this SKU.' })}
            </div>
          ) : null}

          {palletTypeRows.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {palletTypeRows.map((row) => {
                const maxWeight = toNumber(row.maxWeight);

                return (
                  <article key={row.id} className="rounded-3xl border border-border/60 bg-surface/95 p-4 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                        <EntityPhoto
                          src={sku.photo}
                          alt={row.name}
                          className="h-28 w-full rounded-xl border border-border/50 object-cover"
                        />
                      <div className="space-y-3">
                        <div>
                          <p className="text-base font-semibold text-foreground">{row.name}</p>
                          <p className="font-mono text-xs text-muted">{row.id}</p>
                        </div>

                        <p className="rounded-xl bg-surface-secondary/70 px-3 py-2 text-sm text-foreground">
                          {formatTotal(row)}
                        </p>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <DetailField
                            label={intl.formatMessage({ id: 'sku.detail.modal.label_package_name', defaultMessage: 'Package Name' })}
                            value={row.packageName}
                          />
                          <DetailField
                            label={intl.formatMessage({ id: 'sku.detail.modal.label_quantity_per_package', defaultMessage: 'Quantity per Package' })}
                            value={`${toNumber(row.quantityPerPackage) ?? 0} ${row.packageUnit}`}
                          />
                          <DetailField
                            label={intl.formatMessage({ id: 'sku.detail.table_header_dimensions', defaultMessage: 'Dimensions (L x W x H)' })}
                            value={formatDimensions(row)}
                          />
                          <DetailField
                            label={intl.formatMessage({ id: 'sku.detail.table_header_max_weight', defaultMessage: 'Max Weight' })}
                            value={maxWeight === null ? '-' : `${maxWeight} ${row.packageUnit}`}
                          />
                        </div>

                        {row.description ? (
                          <p className="text-sm leading-6 text-muted">{row.description}</p>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="ghost" onPress={() => openPalletTypeDetail(row)}>
                            {intl.formatMessage({ id: 'action.detail', defaultMessage: 'Detail' })}
                          </Button>
                          <Button size="sm" variant="secondary" onPress={() => startEditPalletType(row)}>
                            {intl.formatMessage({ id: 'action.edit', defaultMessage: 'Edit' })}
                          </Button>
                          <Button size="sm" variant="danger" onPress={() => openDeletePalletTypeModal(row.id)}>
                            {intl.formatMessage({ id: 'action.delete', defaultMessage: 'Delete' })}
                          </Button>
                          <Button size="sm" variant="outline" onPress={() => navigate('/transactions')}>
                            {intl.formatMessage({ id: 'sku.detail.view_linked_pallets', defaultMessage: 'View Linked Pallets' })}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

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
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  {intl.formatMessage({ id: 'sku.detail.delete_pallet_type_title', defaultMessage: 'Delete Pallet Type' })}
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <div className="space-y-3 text-sm leading-6 text-muted">
                  <p>
                    {intl.formatMessage(
                      {
                        id: 'sku.detail.delete_pallet_type_description',
                        defaultMessage: 'Pallet type {name} will be permanently removed from this SKU packaging profile.',
                      },
                      { name: deletingPalletType?.name ?? deletingPalletTypeId ?? '-' }
                    )}
                  </p>
                  <div className="rounded-2xl border border-danger-soft-hover bg-danger/8 p-4 text-danger">
                    {intl.formatMessage({
                      id: 'sku.detail.delete_pallet_type_warning',
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
                  {intl.formatMessage({ id: 'sku.detail.delete_pallet_type_cancel', defaultMessage: 'Cancel' })}
                </Button>
                <Button variant="danger" onPress={() => void deletePalletType()} isPending={isDeletingPalletType}>
                  {({ isPending }) => (
                    <>
                      <Icon
                        icon={isPending ? 'solar:refresh-linear' : 'solar:trash-bin-trash-linear'}
                        className={`size-4 ${isPending ? 'animate-spin' : ''}`}
                      />
                      {isPending
                        ? intl.formatMessage({ id: 'sku.detail.delete_pallet_type_deleting', defaultMessage: 'Deleting Pallet Type...' })
                        : intl.formatMessage({ id: 'sku.detail.delete_pallet_type_confirm', defaultMessage: 'Delete Pallet Type' })}
                    </>
                  )}
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <DeleteSkuDialog
        id={id ?? ''}
        name={sku?.name}
        isOpen={deleteSkuModalOpen}
        onOpenChange={setDeleteSkuModalOpen}
        onDeletingChange={setIsDeletingSku}
        onError={(message) => setFeedback('danger', message)}
        onDeleted={() => navigate('/skus')}
      />

    </section>
  );
}
