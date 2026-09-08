import { useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import { Button, Card } from '@heroui/react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams } from 'react-router';
import { trpcClient } from '../../lib/trpc';

/**
 * Printable pallet label (QR + pallet number + SKU + lot/expiry).
 * Auto-opens the browser print dialog; works in Tauri webview too.
 */
export function PalletLabelPrintPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();

  const { data: pallet, isLoading } = useQuery({
    queryKey: ['palletDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.pallet.detail.query({ id: id ?? '' }),
  });

  useEffect(() => {
    if (pallet) {
      const timer = setTimeout(() => window.print(), 400);
      return () => clearTimeout(timer);
    }
  }, [pallet]);

  if (isLoading || !pallet) {
    return <p className="text-sm text-muted">{intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading…' })}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <Button variant="primary" onPress={() => window.print()}>
          {intl.formatMessage({ id: 'print.print_again', defaultMessage: 'Print again' })}
        </Button>
      </div>
      <Card className="mx-auto w-[380px] p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <QRCodeSVG value={pallet.palletNumber ?? pallet.id} size={180} />
          <p className="font-mono text-xl font-bold">{pallet.palletNumber ?? pallet.id}</p>
          <div className="text-sm">
            <p className="font-semibold">{pallet.sku.name}</p>
            {pallet.sku.code ? <p className="font-mono text-muted">{pallet.sku.code}</p> : null}
          </div>
          <dl className="w-full space-y-1 text-xs">
            {pallet.lotNo ? (
              <div className="flex justify-between border-t pt-1">
                <dt className="text-muted">{intl.formatMessage({ id: 'report.expiry.lot', defaultMessage: 'Lot' })}</dt>
                <dd className="font-mono">{pallet.lotNo}</dd>
              </div>
            ) : null}
            {pallet.expiryDate ? (
              <div className="flex justify-between border-t pt-1">
                <dt className="text-muted">{intl.formatMessage({ id: 'report.expiry.expiry_date', defaultMessage: 'Expiry' })}</dt>
                <dd className="font-mono">{new Date(pallet.expiryDate).toLocaleDateString()}</dd>
              </div>
            ) : null}
            {pallet.storageLocation ? (
              <div className="flex justify-between border-t pt-1">
                <dt className="text-muted">{intl.formatMessage({ id: 'print.location', defaultMessage: 'Location' })}</dt>
                <dd className="font-mono">{pallet.storageLocation.id}</dd>
              </div>
            ) : null}
          </dl>
          <p className="text-[10px] text-muted">WMS — Warehouse Management System</p>
        </div>
      </Card>
    </div>
  );
}
