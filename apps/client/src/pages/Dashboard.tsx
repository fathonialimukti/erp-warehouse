import { Suspense } from 'react';
import { useIntl } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import { Card, Chip, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { trpcClient } from '../lib/trpc';
import { WarehousesScene } from './_WarehousesScene';

// ─── Types ───────────────────────────────────────────────────────────────────

type StatColor = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'teal';

interface KpiDef {
  icon: string;
  label: string;
  value: string | number;
  sub: string;
  color: StatColor;
}

type ActionColor = 'accent' | 'default' | 'warning' | 'danger' | 'success';

const ACTION_COLOR_MAP: Record<string, ActionColor> = {
  CREATE: 'success',
  UPDATE: 'accent',
  DELETE: 'danger',
  APPROVE: 'success',
  REJECT: 'danger',
  LOGIN: 'default',
  LOGOUT: 'default',
  EXPORT: 'accent',
  IMPORT: 'default',
};

const iconStyles: Record<StatColor, { bg: string; icon: string; value: string }> = {
  blue:   { bg: 'bg-primary-soft',   icon: 'text-primary',   value: 'text-primary'   },
  green:  { bg: 'bg-success-soft',   icon: 'text-success',   value: 'text-success'   },
  orange: { bg: 'bg-warning-soft',   icon: 'text-warning',   value: 'text-warning'   },
  teal:   { bg: 'bg-tertiary-soft',  icon: 'text-tertiary',  value: 'text-tertiary'  },
  purple: { bg: 'bg-secondary-soft', icon: 'text-secondary', value: 'text-secondary' },
  red:    { bg: 'bg-danger-soft',    icon: 'text-danger',    value: 'text-danger'    },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ kpi, loading }: { kpi: KpiDef; loading: boolean }) {
  const style = iconStyles[kpi.color];
  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-3">
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${style.bg}`}>
            <Icon icon={kpi.icon} className={`size-5 ${style.icon}`} />
          </div>
          <span className="text-sm font-medium text-muted">{kpi.label}</span>
        </div>
      </Card.Header>
      <Card.Content>
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <>
            <p className={`text-3xl font-bold tracking-tight ${style.value}`}>{kpi.value}</p>
            <p className="mt-1 text-xs text-muted">{kpi.sub}</p>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

function FlowRow({
  color,
  count,
  label,
}: {
  color: string;
  count: number;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <div className={`size-2 rounded-full ${color}`} />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <span className="tabular-nums text-sm font-semibold text-foreground">{count}</span>
    </div>
  );
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const delta = current - prev;
  const pct = Math.round((Math.abs(delta) / prev) * 100);
  const up = delta >= 0;
  return (
    <Chip color={up ? 'success' : 'danger'} size="sm" variant="soft">
      <span className="flex items-center gap-1">
        <Icon icon={up ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'} className="size-3" />
        {pct}%
      </span>
    </Chip>
  );
}

function ApprovalRow({
  count,
  href,
  icon,
  label,
  navigate,
}: {
  count: number;
  href: string;
  icon: string;
  label: string;
  navigate: (path: string) => void;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-surface-hover"
    >
      <div className="flex items-center gap-2.5">
        <Icon icon={icon} className="size-4 text-muted" />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <Chip color="warning" size="sm" variant="soft">{count}</Chip>
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

function Dashboard() {
  const intl = useIntl();
  const navigate = useNavigate();

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard.summary'],
    queryFn: () => trpcClient.dashboard.summary.query(),
    staleTime: 30_000,
  });

  const { data: allocations } = useQuery({
    queryKey: ['dashboard.warehouseAllocations'],
    queryFn: () => trpcClient.dashboard.warehouseAllocations.query(),
    staleTime: 60_000,
  });

  const { data: activityData } = useQuery({
    queryKey: ['dashboard.activityFeed'],
    queryFn: () => trpcClient.activityLog.list.query({ limit: 10 }),
    staleTime: 30_000,
  });

  const { data: warehouseList } = useQuery({
    queryKey: ['warehouse.list.dashboard'],
    queryFn: () => trpcClient.warehouse.list.query({ limit: 100 }),
    staleTime: 120_000,
  });

  const warehouseNameMap: Record<string, string> = {};
  if (warehouseList?.data) {
    for (const w of warehouseList.data) {
      warehouseNameMap[w.id] = w.name;
    }
  }

  const mo = summary?.monthlyActivity;
  const prev = summary?.prevMonthActivity;
  const approvals = summary?.pendingApprovals;
  const pallets = summary?.pallets;
  const exec = summary?.execution;

  const kpis: KpiDef[] = [
    {
      icon: 'solar:box-minimalistic-linear',
      label: intl.formatMessage({ id: 'dashboard.kpi_total_pallets', defaultMessage: 'Total Pallets' }),
      value: pallets?.total ?? '—',
      sub: pallets
        ? intl.formatMessage(
            { id: 'dashboard.kpi_total_pallets_sub', defaultMessage: '{available} available · {notAvailable} in use' },
            { available: pallets.available, notAvailable: pallets.notAvailable },
          )
        : '',
      color: 'blue',
    },
    {
      icon: 'solar:check-circle-linear',
      label: intl.formatMessage({ id: 'dashboard.kpi_available_pallets', defaultMessage: 'Available Pallets' }),
      value: pallets?.available ?? '—',
      sub: intl.formatMessage({ id: 'dashboard.kpi_available_pallets_sub', defaultMessage: 'Ready for putaway' }),
      color: 'green',
    },
    {
      icon: 'solar:checklist-minimalistic-linear',
      label: intl.formatMessage({ id: 'dashboard.kpi_pending_approvals', defaultMessage: 'Pending Approvals' }),
      value: approvals?.total ?? '—',
      sub: approvals
        ? intl.formatMessage(
            { id: 'dashboard.kpi_pending_approvals_sub', defaultMessage: '{inbound} inbound · {outbound} outbound · {loss} adjustment' },
            { inbound: approvals.inbound, outbound: approvals.outbound, loss: approvals.loss },
          )
        : '',
      color: 'orange',
    },
    {
      icon: 'solar:download-minimalistic-linear',
      label: intl.formatMessage({ id: 'dashboard.kpi_putaway_queue', defaultMessage: 'Putaway Queue' }),
      value: exec?.putawayPending ?? '—',
      sub: intl.formatMessage({ id: 'dashboard.kpi_putaway_queue_sub', defaultMessage: 'Pallets awaiting storage placement' }),
      color: 'teal',
    },
    {
      icon: 'solar:delivery-linear',
      label: intl.formatMessage({ id: 'dashboard.kpi_dispatch_queue', defaultMessage: 'Dispatch Queue' }),
      value: exec?.dispatchPending ?? '—',
      sub: intl.formatMessage({ id: 'dashboard.kpi_dispatch_queue_sub', defaultMessage: 'Pallets awaiting outbound pick' }),
      color: 'purple',
    },
  ];

  const totalInbound = mo?.totalInbound ?? 0;
  const totalOutbound = mo?.totalOutbound ?? 0;
  const totalApprovals = approvals?.total ?? 0;

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'dashboard',
        hasSummary: Boolean(summary),
        pallets: pallets ?? null,
        pendingApprovals: approvals ?? null,
        execution: exec ?? null,
        monthlyActivity: mo ?? null,
      })}
    >
      {/* ── Page header ── */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {intl.formatMessage({ id: 'dashboard.title', defaultMessage: 'Dashboard' })}
        </h1>
        <p className="text-sm text-muted">
          {intl.formatMessage({ id: 'dashboard.subtitle', defaultMessage: 'Operational overview for your warehouse management system' })}
        </p>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} loading={isLoading} />
        ))}
      </div>

      {/* ── Middle row: Monthly Flow + Approval Backlog ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Monthly Flow — 3/5 */}
        <Card className="lg:col-span-3">
          <Card.Header>
            <div className="flex items-start justify-between">
              <div>
                <Card.Title>
                  {intl.formatMessage({ id: 'dashboard.section_monthly_flow', defaultMessage: 'Monthly Transaction Flow' })}
                </Card.Title>
                <Card.Description>
                  {intl.formatMessage({ id: 'dashboard.section_monthly_flow_sub', defaultMessage: 'Inbound and outbound activity created this month' })}
                </Card.Description>
              </div>
            </div>
          </Card.Header>
          <Card.Content>
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner size="sm" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {/* Inbound column */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary-soft">
                        <Icon icon="solar:download-minimalistic-linear" className="size-4 text-primary" />
                      </div>
                      <span className="font-semibold text-foreground">
                        {intl.formatMessage({ id: 'dashboard.flow_inbound', defaultMessage: 'Inbound' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-primary">{totalInbound}</span>
                      {prev && <DeltaBadge current={totalInbound} prev={prev.receiving} />}
                    </div>
                  </div>
                  <div className="divide-y divide-border/40">
                    <FlowRow color="bg-primary" count={mo?.receiving ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_receiving', defaultMessage: 'Receiving' })} />
                    <FlowRow color="bg-primary/60" count={mo?.wipCompletion ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_wip_completion', defaultMessage: 'WIP Completion' })} />
                    <FlowRow color="bg-primary/40" count={mo?.rmaReceipt ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_rma', defaultMessage: 'RMA Receipt' })} />
                    <FlowRow color="bg-primary/20" count={mo?.found ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_found', defaultMessage: 'Found' })} />
                  </div>
                </div>

                {/* Outbound column */}
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-secondary-soft">
                        <Icon icon="solar:upload-minimalistic-linear" className="size-4 text-secondary" />
                      </div>
                      <span className="font-semibold text-foreground">
                        {intl.formatMessage({ id: 'dashboard.flow_outbound', defaultMessage: 'Outbound' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-secondary">{totalOutbound}</span>
                      {prev && <DeltaBadge current={totalOutbound} prev={prev.shipment} />}
                    </div>
                  </div>
                  <div className="divide-y divide-border/40">
                    <FlowRow color="bg-secondary" count={mo?.shipment ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_shipment', defaultMessage: 'Shipment' })} />
                    <FlowRow color="bg-secondary/60" count={mo?.wipIssue ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_wip_issue', defaultMessage: 'WIP Issue' })} />
                    <FlowRow color="bg-secondary/40" count={mo?.returnToSupplier ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_rts', defaultMessage: 'Return to Supplier' })} />
                    <FlowRow color="bg-secondary/20" count={mo?.disposal ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_disposal', defaultMessage: 'Disposal' })} />
                  </div>
                </div>
              </div>
            )}
          </Card.Content>
        </Card>

        {/* Approval Backlog — 2/5 */}
        <Card className="lg:col-span-2">
          <Card.Header>
            <div className="flex items-start justify-between">
              <div>
                <Card.Title>
                  {intl.formatMessage({ id: 'dashboard.section_approvals', defaultMessage: 'Approval Backlog' })}
                </Card.Title>
                <Card.Description>
                  {intl.formatMessage({ id: 'dashboard.section_approvals_sub', defaultMessage: 'Documents pending approval by domain' })}
                </Card.Description>
              </div>
              {totalApprovals > 0 && (
                <Chip color="warning" variant="soft">{totalApprovals}</Chip>
              )}
            </div>
          </Card.Header>
          <Card.Content>
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner size="sm" />
              </div>
            ) : totalApprovals === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted">
                <Icon icon="solar:shield-check-linear" className="size-8" />
                <span className="text-sm">{intl.formatMessage({ id: 'dashboard.approvals_all_clear', defaultMessage: 'No pending approvals' })}</span>
              </div>
            ) : (
              <div className="-mx-1 space-y-0.5">
                <ApprovalRow count={approvals?.breakdown.receiving ?? 0} href="/inbound-transaction?tab=receiving" icon="solar:inbox-in-linear" label={intl.formatMessage({ id: 'dashboard.flow_breakdown_receiving', defaultMessage: 'Receiving' })} navigate={navigate} />
                <ApprovalRow count={approvals?.breakdown.wipCompletion ?? 0} href="/inbound-transaction?tab=wip-completion" icon="solar:settings-minimalistic-linear" label={intl.formatMessage({ id: 'dashboard.flow_breakdown_wip_completion', defaultMessage: 'WIP Completion' })} navigate={navigate} />
                <ApprovalRow count={approvals?.breakdown.rmaReceipt ?? 0} href="/inbound-transaction?tab=rma" icon="solar:refresh-back-square-linear" label={intl.formatMessage({ id: 'dashboard.flow_breakdown_rma', defaultMessage: 'RMA Receipt' })} navigate={navigate} />
                <ApprovalRow count={approvals?.breakdown.found ?? 0} href="/inbound-transaction?tab=found" icon="solar:magnifer-linear" label={intl.formatMessage({ id: 'dashboard.flow_breakdown_found', defaultMessage: 'Found' })} navigate={navigate} />
                <ApprovalRow count={approvals?.breakdown.shipment ?? 0} href="/outbound-transaction?tab=shipment" icon="solar:delivery-linear" label={intl.formatMessage({ id: 'dashboard.flow_breakdown_shipment', defaultMessage: 'Shipment' })} navigate={navigate} />
                <ApprovalRow count={approvals?.breakdown.wipIssue ?? 0} href="/outbound-transaction?tab=wip-issue" icon="solar:logout-3-linear" label={intl.formatMessage({ id: 'dashboard.flow_breakdown_wip_issue', defaultMessage: 'WIP Issue' })} navigate={navigate} />
                <ApprovalRow count={approvals?.breakdown.returnToSupplier ?? 0} href="/outbound-transaction?tab=return" icon="solar:arrow-left-up-linear" label={intl.formatMessage({ id: 'dashboard.flow_breakdown_rts', defaultMessage: 'Return to Supplier' })} navigate={navigate} />
                <ApprovalRow count={approvals?.breakdown.disposal ?? 0} href="/outbound-transaction?tab=disposal" icon="solar:trash-bin-minimalistic-linear" label={intl.formatMessage({ id: 'dashboard.flow_breakdown_disposal', defaultMessage: 'Disposal' })} navigate={navigate} />
                <ApprovalRow count={approvals?.loss ?? 0} href="/outbound-transaction?tab=loss" icon="solar:danger-triangle-linear" label="Loss" navigate={navigate} />
              </div>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* ── Lower row: Warehouse Capacity + Activity Feed ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Warehouse Capacity */}
        <Card>
          <Card.Header>
            <Card.Title>
              {intl.formatMessage({ id: 'dashboard.section_capacity', defaultMessage: 'Warehouse Capacity' })}
            </Card.Title>
            <Card.Description>
              {intl.formatMessage({ id: 'dashboard.section_capacity_sub', defaultMessage: 'Storage location utilization per warehouse' })}
            </Card.Description>
          </Card.Header>
          <Card.Content>
            {!allocations ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner size="sm" />
              </div>
            ) : allocations.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted">
                <Icon icon="solar:buildings-linear" className="size-8" />
                <span className="text-sm">No warehouses found</span>
              </div>
            ) : (
              <div className="space-y-4">
                {allocations.map((a: { warehouseId: string; total: number; used: number; rate: number }) => {
                  const name = warehouseNameMap[a.warehouseId] ?? a.warehouseId;
                  const rateColor =
                    a.rate >= 90 ? 'bg-danger' : a.rate >= 70 ? 'bg-warning' : 'bg-success';
                  return (
                    <div key={a.warehouseId}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{name}</span>
                        <div className="flex items-center gap-2 text-muted">
                          <span>
                            {intl.formatMessage(
                              { id: 'dashboard.capacity_locations', defaultMessage: '{used} / {total} locations' },
                              { used: a.used, total: a.total },
                            )}
                          </span>
                          <span className="font-semibold text-foreground">{a.rate}%</span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-border/40">
                        <div
                          className={`h-full rounded-full transition-all ${rateColor}`}
                          style={{ width: `${a.rate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card.Content>
        </Card>

        {/* Activity Feed */}
        <Card>
          <Card.Header>
            <div className="flex items-start justify-between">
              <div>
                <Card.Title>
                  {intl.formatMessage({ id: 'dashboard.section_activity', defaultMessage: 'Recent Activity' })}
                </Card.Title>
                <Card.Description>
                  {intl.formatMessage({ id: 'dashboard.section_activity_sub', defaultMessage: 'Latest system actions across all users' })}
                </Card.Description>
              </div>
              <button
                type="button"
                onClick={() => navigate('/activity-logs')}
                className="text-xs text-primary hover:underline"
              >
                {intl.formatMessage({ id: 'dashboard.activity_view_all', defaultMessage: 'View all activity' })}
              </button>
            </div>
          </Card.Header>
          <Card.Content>
            {!activityData ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner size="sm" />
              </div>
            ) : activityData.data.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted">
                <Icon icon="solar:clock-circle-linear" className="size-8" />
                <span className="text-sm">{intl.formatMessage({ id: 'dashboard.activity_empty', defaultMessage: 'No recent activity' })}</span>
              </div>
            ) : (
              <div className="space-y-1">
                {activityData.data.map((entry: { id: string; action: string; message: string; createdAt: string; user?: { name?: string | null; email: string } | null }) => {
                  const color = ACTION_COLOR_MAP[entry.action] ?? 'default';
                  const ts = new Date(entry.createdAt);
                  const diff = Date.now() - ts.getTime();
                  const mins = Math.floor(diff / 60_000);
                  const hrs = Math.floor(diff / 3_600_000);
                  const relTime =
                    mins < 1 ? 'just now'
                    : mins < 60 ? `${mins}m ago`
                    : hrs < 24 ? `${hrs}h ago`
                    : ts.toLocaleDateString();

                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-hover"
                    >
                      <Chip color={color} size="sm" variant="soft">
                        {entry.action}
                      </Chip>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{entry.message}</p>
                        <p className="text-xs text-muted">{entry.user?.name ?? entry.user?.email}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{relTime}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* ── Warehouse 3D Scene (unchanged) ── */}
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
          <div style={{ height: 600 }}>
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
