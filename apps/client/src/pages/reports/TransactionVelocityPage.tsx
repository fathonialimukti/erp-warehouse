import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, ListBox, Select, Spinner } from '@heroui/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { trpcClient } from '../../lib/trpc';


interface TooltipPayloadEntry {
  dataKey?: string | number;
  value?: number;
  name?: string;
  color?: string;
}

function formatQty(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}

function TransactionVelocityPage() {
  const intl = useIntl();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouseListForFilter'],
    queryFn: () => trpcClient.warehouse.warehouse.list.query({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['reportTransactionVelocity', year, warehouseId],
    queryFn: () => trpcClient.report.transactionVelocity.query({ year, warehouseId }),
  });

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {intl.formatMessage({ id: 'report.velocity.title', defaultMessage: 'Transaction Velocity' })}
        </h1>
        <p className="text-sm text-muted">
          {intl.formatMessage({ id: 'report.velocity.description', defaultMessage: 'Monthly inbound vs outbound throughput. Green bars above zero = stock build-up (inbound > outbound).' })}
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          variant="secondary"
          selectedKey={String(year)}
          onSelectionChange={(key) => { if (key) setYear(Number(key)); }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {years.map((y) => (
                <ListBox.Item key={String(y)} id={String(y)} textValue={String(y)}>{String(y)}</ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select
          variant="secondary"
          selectedKey={warehouseId ?? '__all__'}
          onSelectionChange={(key) => setWarehouseId(key === '__all__' ? undefined : String(key) as string | undefined)}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__all__" textValue={intl.formatMessage({ id: 'report.velocity.all_warehouses', defaultMessage: 'All Warehouses' })}>
                {intl.formatMessage({ id: 'report.velocity.all_warehouses', defaultMessage: 'All Warehouses' })}
              </ListBox.Item>
              {(warehouses?.data ?? []).map((w) => (
                <ListBox.Item key={w.id} id={w.id} textValue={w.name}>{w.name}</ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      <Card>
        <Card.Header>
          <div>
            <Card.Title>
              {intl.formatMessage({ id: 'report.velocity.chart_title', defaultMessage: 'Monthly Inbound vs Outbound' })}
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({ id: 'report.velocity.chart_subtitle', defaultMessage: 'Stacked bars show volume per direction. Net line = inbound − outbound.' })}
            </Card.Description>
          </div>
        </Card.Header>
        <Card.Content>
          {isLoading ? (
            <div className="flex h-80 items-center justify-center"><Spinner /></div>
          ) : (
            <ResponsiveContainer width="100%" height={420}>
              <BarChart data={data?.months ?? []} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-default-200" />
                <XAxis dataKey="label" className="text-xs text-muted" />
                <YAxis tickFormatter={formatQty} className="text-xs text-muted" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const _p = payload as unknown as TooltipPayloadEntry[];
                    return (
                      <div className="rounded-lg border border-default-200 bg-background p-3 shadow-lg">
                        <p className="mb-1 text-sm font-semibold text-foreground">{payload[0]?.payload?.label}</p>
                        {_p.map((entry, i) => (
                          <p key={i} className="text-xs" style={{ color: entry.color }}>
                            {entry.name}: {typeof entry.value === 'number' ? formatQty(entry.value) : entry.value}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <ReferenceLine y={0} stroke="#9ca3af" />
                <Bar dataKey="inbound" name={intl.formatMessage({ id: 'report.velocity.inbound', defaultMessage: 'Inbound' })} fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outbound" name={intl.formatMessage({ id: 'report.velocity.outbound', defaultMessage: 'Outbound' })} fill="#ef4444" stackId="b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* KPI summary */}
          {data && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-success-soft p-3">
                <p className="text-xs text-muted">{intl.formatMessage({ id: 'report.velocity.total_inbound', defaultMessage: 'Total Inbound' })}</p>
                <p className="text-lg font-bold text-success">{formatQty(data.totals.inbound)}</p>
              </div>
              <div className="rounded-lg bg-danger-soft p-3">
                <p className="text-xs text-muted">{intl.formatMessage({ id: 'report.velocity.total_outbound', defaultMessage: 'Total Outbound' })}</p>
                <p className="text-lg font-bold text-danger">{formatQty(data.totals.outbound)}</p>
              </div>
              <div className="rounded-lg bg-default-soft p-3">
                <p className="text-xs text-muted">{intl.formatMessage({ id: 'report.velocity.avg_monthly_inbound', defaultMessage: 'Avg Inbound/Month' })}</p>
                <p className="text-lg font-bold text-foreground">{formatQty(Math.round(data.totals.inbound / 12))}</p>
              </div>
              <div className="rounded-lg bg-default-soft p-3">
                <p className="text-xs text-muted">{intl.formatMessage({ id: 'report.velocity.avg_monthly_outbound', defaultMessage: 'Avg Outbound/Month' })}</p>
                <p className="text-lg font-bold text-foreground">{formatQty(Math.round(data.totals.outbound / 12))}</p>
              </div>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

export { TransactionVelocityPage };