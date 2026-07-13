import { useAtomValue } from 'jotai';
import { useState, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Chip, Label } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { EntityPhoto } from '../../components/EntityPhoto';
import { DeleteSkuDialog } from './_DeleteSku';
import { hasPermissionAtom } from '../../lib/atoms';
import { trpcClient } from '../../lib/trpc';

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function SkuDetailPage() {
  const { id } = useParams();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);
  const canEditSku = hasPermission('sku@update');
  const canDeleteSku = hasPermission('product@delete');

  const [deleteSkuModalOpen, setDeleteSkuModalOpen] = useState(false);
  const [isDeletingSku, setIsDeletingSku] = useState(false);

  const { data: sku, isLoading: isLoadingSku } = useQuery({
    queryKey: ['skuDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.sku.detail.query({ id: id ?? '' }),
  });

  const stockPalletCount = (sku as { pallets?: unknown[] } | undefined)?.pallets?.length ?? 0;
  const perPackage = toNumber(sku?.quantityPerPackage) ?? 0;
  const stockUnitsInBaseUnit = stockPalletCount * (sku?.packagesPerPallet ?? 0) * perPackage;

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

  const openDeleteSkuModal = () => {
    setDeleteSkuModalOpen(true);
  };

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
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'sku-detail',
        skuId: sku.id,
        skuCode: sku.code ?? sku.id,
        stockPalletCount,
        stockUnitsInBaseUnit,
      })}
    >
      <PageHeader
        title={intl.formatMessage({ id: 'sku.detail.page_title', defaultMessage: 'SKU Detail' })}
        onBack={() => navigate('/skus')}
        onEdit={canEditSku && sku ? () => navigate(`/skus/${sku.id}/edit`) : undefined}
        onDelete={canDeleteSku && sku?.type === 'FINISHED_GOOD' ? openDeleteSkuModal : undefined}
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
              <p className="font-mono text-sm text-foreground">{sku.code ?? sku.id}</p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{sku.name}</h1>
              <div className="flex flex-wrap gap-2">
                <Chip variant="primary" color={sku.photo ? 'success' : 'default'}>
                  {sku.photo ? intl.formatMessage({ id: 'sku.detail.chip_photo_available', defaultMessage: 'Photo available' }) : intl.formatMessage({ id: 'sku.detail.chip_no_photo', defaultMessage: 'No photo' })}
                </Chip>
                <Chip variant="primary" color={sku.maxWeight ? 'warning' : 'default'}>
                  {intl.formatMessage({ id: 'sku.detail.chip_weight_limit', defaultMessage: 'Weight limit: {weight} kg' }, { weight: sku.maxWeight ?? '-' })}
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.quick_stats_current_stock', defaultMessage: 'Current Stock Pallets' })}
                value={stockPalletCount.toLocaleString('id-ID')}
                hint={intl.formatMessage({ id: 'sku.detail.quick_stats_current_stock_hint', defaultMessage: 'Active pallets (PLACED or RECEIVED).' })}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.quick_stats_stock_units', defaultMessage: 'Stock in Base Units' })}
                value={stockUnitsInBaseUnit.toLocaleString('id-ID')}
                hint={intl.formatMessage({ id: 'sku.detail.quick_stats_stock_units_hint', defaultMessage: 'Total units in base unit ({unit}).' }, { unit: sku.baseUnit ?? 'unit' })}
              />
              <MetricCard
                label={intl.formatMessage({ id: 'sku.detail.quick_stats_packages_per_pallet', defaultMessage: 'Packages per Pallet' })}
                value={sku.packagesPerPallet.toLocaleString('id-ID')}
                hint={intl.formatMessage({ id: 'sku.detail.quick_stats_packages_per_pallet_hint', defaultMessage: 'Number of packages per pallet.' })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {intl.formatMessage({ id: 'sku.detail.packaging_section_title', defaultMessage: 'Packaging Configuration' })}
              </h2>
              <p className="text-sm text-muted">
                {intl.formatMessage({ id: 'sku.detail.packaging_section_description', defaultMessage: 'Packaging, physical dimensions, and handling limits for this SKU.' })}
              </p>
            </div>
          </div>

          <Card>
            <Card.Content>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <DetailField
                  label={intl.formatMessage({ id: 'sku.detail.packaging.package_name', defaultMessage: 'Package Name' })}
                  value={sku.packageName}
                />
                <DetailField
                  label={intl.formatMessage({ id: 'sku.detail.packaging.packages_per_pallet', defaultMessage: 'Packages per Pallet' })}
                  value={sku.packagesPerPallet.toLocaleString('id-ID')}
                />
                <DetailField
                  label={intl.formatMessage({ id: 'sku.detail.packaging.quantity_per_package', defaultMessage: 'Quantity per Package' })}
                  value={`${perPackage} ${sku.packageUnit}`}
                />
                <DetailField
                  label={intl.formatMessage({ id: 'sku.detail.packaging.package_unit', defaultMessage: 'Package Unit' })}
                  value={sku.packageUnit}
                />
                <DetailField
                  label={intl.formatMessage({ id: 'sku.detail.packaging.dimensions', defaultMessage: 'Dimensions (L x W x H)' })}
                  value={`${sku.length ?? '-'} x ${sku.width ?? '-'} x ${sku.height ?? '-'}`}
                />
                <DetailField
                  label={intl.formatMessage({ id: 'sku.detail.packaging.max_weight', defaultMessage: 'Max Weight' })}
                  value={sku.maxWeight ? `${sku.maxWeight} kg` : '-'}
                />
              </div>
            </Card.Content>
          </Card>
        </div>
      </div>

      <DeleteSkuDialog
        id={id ?? ''}
        name={sku?.name}
        isOpen={deleteSkuModalOpen}
        onOpenChange={setDeleteSkuModalOpen}
        onDeletingChange={setIsDeletingSku}
        onDeleted={() => navigate('/skus')}
      />

    </section>
  );
}

export { SkuDetailPage };
