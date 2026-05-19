import { Suspense } from 'react';
import { useIntl } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { trpcClient } from '../lib/trpc';
import { WarehousesScene } from './_WarehousesScene';

type StatColor = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'teal';

interface StatDef {
  icon: string;
  label: string;
  value: string;
  sub: string;
  color: StatColor;
}

const iconStyles: Record<StatColor, { bg: string; icon: string; value: string }> = {
  blue:   { bg: 'bg-primary-soft',   icon: 'text-primary',   value: 'text-primary'   },
  green:  { bg: 'bg-success-soft',   icon: 'text-success',   value: 'text-success'   },
  orange: { bg: 'bg-warning-soft',   icon: 'text-warning',   value: 'text-warning'   },
  teal:   { bg: 'bg-tertiary-soft',  icon: 'text-tertiary',  value: 'text-tertiary'  },
  purple: { bg: 'bg-secondary-soft', icon: 'text-secondary', value: 'text-secondary' },
  red:    { bg: 'bg-danger-soft',    icon: 'text-danger',    value: 'text-danger'    },
};

function Dashboard() {
  const intl = useIntl();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard.summary'],
    queryFn: () => trpcClient.dashboard.summary.query(),
    staleTime: 30_000,
  });

  const inboundActivity = summary?.monthlyActivity;
  const approvalBacklog = summary?.pendingApprovals;
  const execution = summary?.execution;

  const stats: StatDef[] = [
    {
      icon: 'solar:box-minimalistic-linear',
      label: intl.formatMessage({ id: 'dashboard.stat_inbound_activity', defaultMessage: 'Inbound Activity' }),
      value: inboundActivity ? String(inboundActivity.receiving) : '—',
      sub: intl.formatMessage({ id: 'dashboard.stat_inbound_activity_sub', defaultMessage: 'In-progress of total this month' }),
      color: 'blue',
    },
    {
      icon: 'solar:chart-2-linear',
      label: intl.formatMessage({ id: 'dashboard.stat_pallet_turnover', defaultMessage: 'Pallet Turnover' }),
      value: summary ? `${summary.palletTurnover.dispatched} / ${summary.palletTurnover.total}` : '—',
      sub: summary
        ? intl.formatMessage(
            { id: 'dashboard.stat_pallet_turnover_sub', defaultMessage: '{dispatched} of {total} pallets dispatched' },
            { dispatched: summary.palletTurnover.dispatched, total: summary.palletTurnover.total },
          )
        : '',
      color: 'green',
    },
    {
      icon: 'solar:checklist-minimalistic-linear',
      label: intl.formatMessage({ id: 'dashboard.stat_approval_backlog', defaultMessage: 'Approval Backlog' }),
      value: approvalBacklog ? String(approvalBacklog.inbound + approvalBacklog.outbound + approvalBacklog.loss) : '—',
      sub: approvalBacklog
        ? intl.formatMessage(
            { id: 'dashboard.stat_approval_backlog_sub', defaultMessage: 'Inbound {inbound} · Outbound {outbound} · Loss {loss} · Found {found}' },
            {
              inbound: approvalBacklog.inbound,
              outbound: approvalBacklog.outbound,
              loss: approvalBacklog.loss,
              found: 0,
            },
          )
        : '',
      color: 'orange',
    },
    {
      icon: 'solar:shield-check-linear',
      label: intl.formatMessage({ id: 'dashboard.stat_dispatch_rate', defaultMessage: 'Dispatch Completion' }),
      value: execution ? String(execution.dispatchPending) : '—',
      sub: execution
        ? intl.formatMessage(
            { id: 'dashboard.stat_dispatch_rate_sub', defaultMessage: '{completed} of {total} outbound fully dispatched' },
            { completed: execution.dispatchPending, total: execution.dispatchPending },
          )
        : '',
      color: 'teal',
    },
    {
      icon: 'solar:delivery-linear',
      label: intl.formatMessage({ id: 'dashboard.stat_open_dispatch', defaultMessage: 'Open Dispatch Queue' }),
      value: execution ? String(execution.putawayPending) : '—',
      sub: execution
        ? intl.formatMessage(
            { id: 'dashboard.stat_open_dispatch_sub', defaultMessage: '{totalItems} items pending fulfillment' },
            { totalItems: execution.putawayPending },
          )
        : '',
      color: 'purple',
    },
    {
      icon: 'solar:graph-linear',
      label: intl.formatMessage({ id: 'dashboard.stat_monthly_flow', defaultMessage: 'Monthly Flow' }),
      value: inboundActivity
        ? `${inboundActivity.receiving} in / ${inboundActivity.shipment} out`
        : '—',
      sub: intl.formatMessage({ id: 'dashboard.stat_monthly_flow_sub', defaultMessage: 'Approved transactions this month' }),
      color: 'red',
    },
  ];

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {intl.formatMessage({ id: 'dashboard.title', defaultMessage: 'Dashboard' })}
        </h1>
        <p className="text-sm text-muted">
          {intl.formatMessage({ id: 'dashboard.subtitle', defaultMessage: 'Operational overview for your warehouse management system' })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const style = iconStyles[stat.color];
          return (
            <Card key={stat.label}>
              <Card.Header>
                <div className="flex items-center gap-3">
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${style.bg}`}>
                    <Icon icon={stat.icon} className={`size-5 ${style.icon}`} />
                  </div>
                  <span className="text-sm font-medium text-muted">{stat.label}</span>
                </div>
              </Card.Header>
              <Card.Content>
                {isLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <p className={`text-3xl font-bold tracking-tight ${style.value}`}>{stat.value}</p>
                    <p className="mt-1 text-xs text-muted">{stat.sub}</p>
                  </>
                )}
              </Card.Content>
            </Card>
          );
        })}
      </div>

      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <div>
              <Card.Title>
                {intl.formatMessage({ id: 'dashboard.canvas_title', defaultMessage: 'Warehouse Overview' })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({ id: 'dashboard.canvas_click_hint', defaultMessage: 'Click a warehouse to open its 3D layout view' })}
              </Card.Description>
            </div>
            <div className="flex items-center gap-1.5 text-muted">
              <Icon icon="solar:map-point-rotate-linear" className="size-4" />
              <span className="text-xs">Interactive 3D</span>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          <div style={{ height: 420 }}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <WarehousesScene />
            </Suspense>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}

export { Dashboard };
