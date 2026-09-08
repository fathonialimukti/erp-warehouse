import { useIntl } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Spinner } from '@heroui/react';
import { trpcClient } from '../lib/trpc';

const IDR_FORMAT = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

interface SupplierAgingCardProps {
  supplierId: string;
}

function SupplierAgingCard({ supplierId }: SupplierAgingCardProps) {
  const intl = useIntl();

  const { data, isLoading } = useQuery({
    queryKey: ['inventoryAgingBySupplier', supplierId],
    queryFn: () => trpcClient.inventoryAging.bySupplier.query({ supplierId }),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card>
        <Card.Header>
          <div>
            <Card.Title>
              {intl.formatMessage({ id: 'inventory_aging.supplier.title', defaultMessage: 'Inventory Aging' })}
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({ id: 'inventory_aging.supplier.subtitle', defaultMessage: 'Aging status of materials from this supplier.' })}
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content>
          <div className="flex h-24 items-center justify-center">
            <Spinner size="sm" />
          </div>
        </Card.Content>
      </Card>
    );
  }

  if (!data || data.skuCount === 0) {
    return (
      <Card>
        <Card.Header>
          <div>
            <Card.Title>
              {intl.formatMessage({ id: 'inventory_aging.supplier.title', defaultMessage: 'Inventory Aging' })}
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({ id: 'inventory_aging.supplier.subtitle', defaultMessage: 'Aging status of materials from this supplier.' })}
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content>
          <p className="py-4 text-center text-sm text-muted">
            {intl.formatMessage({ id: 'inventory_aging.supplier.empty', defaultMessage: 'No inventory data for this supplier.' })}
          </p>
        </Card.Content>
      </Card>
    );
  }

  const totalValue = data.deadStockValue + data.slowMovingValue + data.activeValue;

  return (
    <Card>
      <Card.Header>
        <div>
          <Card.Title>
            {intl.formatMessage({ id: 'inventory_aging.supplier.title', defaultMessage: 'Inventory Aging' })}
          </Card.Title>
          <Card.Description>
            {intl.formatMessage({ id: 'inventory_aging.supplier.subtitle', defaultMessage: 'Aging status of materials from this supplier.' })}
          </Card.Description>
        </div>
      </Card.Header>
      <Card.Content>
        {/* Summary KPIs */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-default-soft p-3">
            <p className="text-xs text-muted">{intl.formatMessage({ id: 'inventory_aging.supplier.total_skus', defaultMessage: 'Total SKUs' })}</p>
            <p className="text-lg font-bold text-foreground">{data.skuCount}</p>
          </div>
          <div className="rounded-lg bg-danger-soft p-3">
            <p className="text-xs text-muted">{intl.formatMessage({ id: 'inventory_aging.supplier.dead_stock', defaultMessage: 'Dead Stock' })}</p>
            <p className="text-lg font-bold text-danger">{IDR_FORMAT.format(data.deadStockValue)}</p>
            <p className="text-xs text-muted">{data.deadStockSkuCount} SKUs</p>
          </div>
          <div className="rounded-lg bg-warning-soft p-3">
            <p className="text-xs text-muted">{intl.formatMessage({ id: 'inventory_aging.supplier.slow_moving', defaultMessage: 'Slow Moving' })}</p>
            <p className="text-lg font-bold text-warning">{IDR_FORMAT.format(data.slowMovingValue)}</p>
          </div>
          <div className="rounded-lg bg-success-soft p-3">
            <p className="text-xs text-muted">{intl.formatMessage({ id: 'inventory_aging.supplier.active', defaultMessage: 'Active' })}</p>
            <p className="text-lg font-bold text-success">{IDR_FORMAT.format(data.activeValue)}</p>
          </div>
        </div>

        {/* Progress bar */}
        {totalValue > 0 && (
          <div className="mb-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-default-soft">
              <div className="bg-danger" style={{ width: `${(data.deadStockValue / totalValue) * 100}%` }} />
              <div className="bg-warning" style={{ width: `${(data.slowMovingValue / totalValue) * 100}%` }} />
              <div className="bg-success" style={{ width: `${(data.activeValue / totalValue) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Items list */}
        <div className="space-y-2">
          {data.items.slice(0, 5).map((item: { skuId: string; skuName: string; skuCode: string | null; palletCount: number; totalValue: number; agingCategory: string }) => (
            <div key={item.skuId} className="flex items-center justify-between rounded-lg border border-default-200 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.skuName}</p>
                <p className="text-xs text-muted">{item.skuCode ?? item.skuId.slice(0, 8)} · {item.palletCount} pallets</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {IDR_FORMAT.format(item.totalValue)}
                </span>
                <Chip
                  size="sm"
                  variant="soft"
                  color={
                    item.agingCategory === 'dead_stock' ? 'danger' :
                    item.agingCategory === 'slow_moving' ? 'warning' :
                    item.agingCategory === 'active' ? 'success' : 'default'
                  }
                >
                  {item.agingCategory === 'dead_stock' ? intl.formatMessage({ id: 'inventory_aging.category.dead_stock', defaultMessage: 'Dead Stock' }) :
                   item.agingCategory === 'slow_moving' ? intl.formatMessage({ id: 'inventory_aging.category.slow_moving', defaultMessage: 'Slow Moving' }) :
                   item.agingCategory === 'active' ? intl.formatMessage({ id: 'inventory_aging.category.active', defaultMessage: 'Active' }) :
                   intl.formatMessage({ id: 'inventory_aging.category.no_data', defaultMessage: 'No Data' })}
                </Chip>
              </div>
            </div>
          ))}
          {data.items.length > 5 && (
            <p className="text-center text-xs text-muted">
              +{data.items.length - 5} {intl.formatMessage({ id: 'inventory_aging.supplier.more_items', defaultMessage: 'more items' })}
            </p>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

export { SupplierAgingCard };
