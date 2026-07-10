import { type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Button, Card, Chip, Label } from '@heroui/react';
import { Icon } from '@iconify/react';
import { QRCodeSVG } from 'qrcode.react';
import { PageHeader } from '../../components/PageHeader';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { EntityPhoto } from '../../components/EntityPhoto';
import { trpcClient } from '../../lib/trpc';

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-muted">{label}</Label>
      <p>{value}</p>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-muted">{hint}</p> : null}
    </Card>
  );
}

function PalletDetailPage() {
  const { id } = useParams();
  const intl = useIntl();
  const navigate = useNavigate();

  const { data: pallet, isLoading } = useQuery({
    queryKey: ['palletDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.warehouse.pallet.detail.query({ id: id ?? '' }),
  });

  const formatDateValue = (value: unknown) => {
    if (!value) return '-';
    const dateValue = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(dateValue.getTime())) return '-';
    return intl.formatDate(dateValue, { dateStyle: 'medium', timeStyle: 'short' });
  };

  if (isLoading) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'pallet.detail.loading', defaultMessage: 'Loading pallet details...' })}</p>;
  }

  if (!pallet) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">{intl.formatMessage({ id: 'pallet.detail.not_found', defaultMessage: 'Pallet not found.' })}</p>
        <Button variant="ghost" onPress={() => navigate('/pallets')}>
          {intl.formatMessage({ id: 'pallet.detail.back_to_list', defaultMessage: 'Back to pallet list' })}
        </Button>
      </div>
    );
  }

  const sku = pallet.sku;
  const location = pallet.storageLocation;

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'pallet-detail',
        palletId: pallet.id,
        status: pallet.status,
        skuId: sku?.id,
        locationId: location?.id,
      })}
    >
      <PageHeader
        title={intl.formatMessage({ id: 'pallet.detail.page_title', defaultMessage: 'Pallet Detail' })}
        onBack={() => navigate('/pallets')}
      />

      <Card className="overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(160deg,rgba(14,116,144,0.09)_0%,rgba(56,189,248,0.04)_30%,rgba(255,255,255,0.98)_65%)] p-5 shadow-[0_20px_50px_rgba(3,105,161,0.12)] dark:bg-[linear-gradient(160deg,rgba(14,116,144,0.2)_0%,rgba(56,189,248,0.08)_30%,rgba(39,39,42,0.96)_65%)] lg:p-7">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <EntityPhoto src={sku?.photo} alt={sku?.name ?? ''} />
          <div className="flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  {intl.formatMessage({ id: 'pallet.detail.number_label', defaultMessage: 'Pallet No.' })}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={intl.formatMessage({ id: 'pallet.detail.print_qr', defaultMessage: 'Print QR' })}
                  onPress={() => window.print()}
                >
                  <Icon icon="solar:printer-bold-duotone" style={{ width: 16, height: 16 }} />
                  {intl.formatMessage({ id: 'pallet.detail.print_qr', defaultMessage: 'Print QR' })}
                </Button>
              </div>
              <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                {pallet.palletNumber ?? pallet.id}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {sku?.name ?? pallet.id}
              </h1>
              <div className="flex flex-wrap gap-2">
                <Chip color={pallet.status === 'AVAILABLE' ? 'success' : 'warning'} variant="primary">
                  {pallet.status}
                </Chip>
                {pallet.sourceType && (
                  <Chip variant="primary" color="default">
                    {pallet.sourceType}
                  </Chip>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DetailField
                label={intl.formatMessage({ id: 'pallet.detail.sku_code_label', defaultMessage: 'SKU Code' })}
                value={sku?.code ?? '-'}
              />
              <DetailField
                label={intl.formatMessage({ id: 'pallet.detail.sku_name_label', defaultMessage: 'SKU Name' })}
                value={sku?.name ?? '-'}
              />
              <DetailField
                label={intl.formatMessage({ id: 'pallet.detail.created_label', defaultMessage: 'Created' })}
                value={formatDateValue(pallet.createdAt)}
              />
              <DetailField
                label={intl.formatMessage({ id: 'pallet.detail.updated_label', defaultMessage: 'Updated' })}
                value={formatDateValue(pallet.updatedAt)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* QR code card — encodes the pallet number for scanning/printing */}
      <Card className="flex flex-col items-center gap-4 p-6 print:break-inside-avoid">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          {intl.formatMessage({ id: 'pallet.detail.qr_label', defaultMessage: 'QR Code' })}
        </p>
        <QRCodeSVG
          value={pallet.palletNumber ?? pallet.id}
          size={200}
          level="M"
          includeMargin
        />
        <p className="font-mono text-lg font-semibold tracking-tight text-foreground">
          {pallet.palletNumber ?? pallet.id}
        </p>
        <Button
          variant="ghost"
          onPress={() => window.print()}
        >
          <Icon icon="solar:printer-bold-duotone" style={{ width: 16, height: 16 }} />
          {intl.formatMessage({ id: 'pallet.detail.print_qr', defaultMessage: 'Print QR' })}
        </Button>
      </Card>

      <div className="space-y-8">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">
            {intl.formatMessage({ id: 'pallet.detail.location_section', defaultMessage: 'Storage Location' })}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label={intl.formatMessage({ id: 'pallet.detail.location_id', defaultMessage: 'Location ID' })}
              value={<span className="font-mono">{location?.id ?? '-'}</span>}
              hint={location?.warehouse?.name ? `${intl.formatMessage({ id: 'pallet.detail.warehouse', defaultMessage: 'Warehouse' })}: ${location.warehouse.name}` : undefined}
            />
            <MetricCard
              label={intl.formatMessage({ id: 'pallet.detail.status', defaultMessage: 'Status' })}
              value={pallet.status}
            />
            <MetricCard
              label={intl.formatMessage({ id: 'pallet.detail.source', defaultMessage: 'Source' })}
              value={pallet.sourceType ?? '-'}
              hint={pallet.sourceItemId ?? undefined}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export { PalletDetailPage };