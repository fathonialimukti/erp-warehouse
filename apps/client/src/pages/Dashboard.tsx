import { Suspense, useState, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Chip, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { trpcClient } from '../lib/trpc';
import { WarehousesScene } from './_WarehousesScene';
import {
  KpiPalletsIcon,
  KpiAvailablePalletsIcon,
  KpiPendingApprovalsIcon,
  KpiPutawayQueueIcon,
  KpiDispatchQueueIcon,
} from '../assets/KpiIcons';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KpiDef {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub: string;
  href?: string;
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

/**
 * Maps an activity-log `resource` value to a route prefix for click-through.
 * Only resources with a known detail page are linked; others render as plain rows.
 * The `resourceId` is appended at runtime (entries without resourceId are not linked).
 */
const RESOURCE_HREF_MAP: Record<string, string> = {
  receiving: '/inbound-transaction',
  'wip-completion': '/inbound-transaction',
  'rma-receipt': '/inbound-transaction',
  found: '/inbound-transaction',
  shipment: '/outbound-transaction',
  'wip-issue': '/outbound-transaction',
  'return-to-supplier': '/outbound-transaction',
  disposal: '/outbound-transaction',
  loss: '/outbound-transaction',
  warehouse: '/warehouse',
  sku: '/skus',
  supplier: '/suppliers',
  user: '/access-control/users',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ kpi, loading, navigate }: { kpi: KpiDef; loading: boolean; navigate: (path: string) => void }) {
  const inner = (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Icon tile */}
      <div className="flex items-start justify-between">
        {kpi.icon}
        {kpi.href && (
          <Icon icon="solar:arrow-right-up-linear" className="size-4 text-muted/50" />
        )}
      </div>
      {/* Value + label — pushed to bottom for consistent alignment */}
      <div className="mt-auto space-y-1">
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">{kpi.value}</p>
        )}
        <p className="text-sm font-medium text-foreground">{kpi.label}</p>
        <p className="text-xs text-muted leading-relaxed line-clamp-2">{kpi.sub}</p>
      </div>
    </div>
  );

  if (kpi.href) {
    return (
      <button
        type="button"
        onClick={() => navigate(kpi.href!)}
        className="h-full text-left transition-transform hover:scale-[1.02] active:scale-[0.99]"
      >
        <Card className="h-full">{inner}</Card>
      </button>
    );
  }
  return <Card className="h-full">{inner}</Card>;
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

/** Mini horizontal bar showing the proportion of a single category within its group. */
function FlowBar({ count, total, color }: { count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="mt-1 h-1 overflow-hidden rounded-full bg-border/30">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  const intl = useIntl();
  // Suppress when there's no meaningful comparison (both zero or no history).
  if (prev === 0 && current === 0) return null;
  if (prev === 0) {
    return (
      <Chip color="success" size="sm" variant="soft">
        <span className="flex items-center gap-1">
          <Icon icon="solar:arrow-up-linear" className="size-3" />
          {intl.formatMessage({ id: 'dashboard.flow_delta_up', defaultMessage: '{pct}% increase' }, { pct: 100 })}
        </span>
      </Chip>
    );
  }
  const delta = current - prev;
  const pct = Math.round((Math.abs(delta) / prev) * 100);
  if (delta === 0) {
    return (
      <Chip color="default" size="sm" variant="soft">
        {intl.formatMessage({ id: 'dashboard.flow_no_change', defaultMessage: 'No change' })}
      </Chip>
    );
  }
  const up = delta > 0;
  return (
    <Chip color={up ? 'success' : 'danger'} size="sm" variant="soft">
      <span className="flex items-center gap-1">
        <Icon icon={up ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'} className="size-3" />
        {intl.formatMessage(
          up
            ? { id: 'dashboard.flow_delta_up', defaultMessage: '{pct}% increase' }
            : { id: 'dashboard.flow_delta_down', defaultMessage: '{pct}% decrease' },
          { pct },
        )}
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

/** Localized relative-time formatter for the activity feed. */
function useRelativeTime() {
  const intl = useIntl();
  return (iso: string) => {
    const ts = new Date(iso);
    const diff = Date.now() - ts.getTime();
    const mins = Math.floor(diff / 60_000);
    const hrs = Math.floor(diff / 3_600_000);
    if (mins < 1) return intl.formatMessage({ id: 'dashboard.relative_just_now', defaultMessage: 'just now' });
    if (mins < 60) return intl.formatMessage({ id: 'dashboard.relative_minutes', defaultMessage: '{count}m ago' }, { count: mins });
    if (hrs < 24) return intl.formatMessage({ id: 'dashboard.relative_hours', defaultMessage: '{count}h ago' }, { count: hrs });
    return ts.toLocaleDateString();
  };
}

/** Inline error banner with retry — used when a dashboard query fails. */
function QueryError({ onRetry }: { onRetry: () => void }) {
  const intl = useIntl();
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-3 text-muted">
      <Icon icon="solar:cloud-sad-linear" className="size-8 text-danger" />
      <span className="text-sm">{intl.formatMessage({ id: 'dashboard.error_load_failed', defaultMessage: 'Failed to load dashboard data' })}</span>
      <Button size="sm" variant="ghost" onPress={onRetry}>
        <Icon icon="solar:refresh-linear" className="size-4" />
        {intl.formatMessage({ id: 'dashboard.error_retry', defaultMessage: 'Retry' })}
      </Button>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

function Dashboard() {
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { data: summary, isLoading, isError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ['dashboard.summary'],
    queryFn: async () => {
      const result = await trpcClient.dashboard.summary.query();
      setLastUpdated(new Date());
      return result;
    },
    staleTime: 30_000,
  });

  const { data: allocations, isError: allocationsError, refetch: refetchAllocations } = useQuery({
    queryKey: ['dashboard.warehouseAllocations'],
    queryFn: () => trpcClient.dashboard.warehouseAllocations.query(),
    staleTime: 60_000,
  });

  const { data: activityData, isError: activityError, refetch: refetchActivity } = useQuery({
    queryKey: ['dashboard.activityFeed'],
    queryFn: () => trpcClient.dashboard.activityFeed.query({ limit: 10 }),
    staleTime: 30_000,
  });

  const { data: myTasks } = useQuery({
    queryKey: ['dashboard.myTasks'],
    queryFn: () => trpcClient.dashboard.myTasks.query(),
    staleTime: 30_000,
  });

  const relativeTime = useRelativeTime();

  const handleRefreshAll = () => {
    void refetchSummary();
    void refetchAllocations();
    void refetchActivity();
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const mo = summary?.monthlyActivity;
  const prev = summary?.prevMonthActivity;
  const approvals = summary?.pendingApprovals;
  const pallets = summary?.pallets;
  const exec = summary?.execution;

  const kpis: KpiDef[] = [
    {
      icon: <KpiPalletsIcon size={44} />,
      label: intl.formatMessage({ id: 'dashboard.kpi_total_pallets', defaultMessage: 'Total Pallets' }),
      value: pallets?.total ?? '—',
      sub: pallets
        ? intl.formatMessage(
            { id: 'dashboard.kpi_total_pallets_sub', defaultMessage: '{available} available · {notAvailable} in use' },
            { available: pallets.available, notAvailable: pallets.notAvailable },
          )
        : '',
      href: '/pallet',
    },
    {
      icon: <KpiAvailablePalletsIcon size={44} />,
      label: intl.formatMessage({ id: 'dashboard.kpi_available_pallets', defaultMessage: 'Available Pallets' }),
      value: pallets?.available ?? '—',
      sub: intl.formatMessage({ id: 'dashboard.kpi_available_pallets_sub', defaultMessage: 'Ready for putaway' }),
      href: '/pallet?status=available',
    },
    {
      icon: <KpiPendingApprovalsIcon size={44} />,
      label: intl.formatMessage({ id: 'dashboard.kpi_pending_approvals', defaultMessage: 'Pending Approvals' }),
      value: approvals?.total ?? '—',
      sub: approvals
        ? intl.formatMessage(
            { id: 'dashboard.kpi_pending_approvals_sub', defaultMessage: '{inbound} inbound · {outbound} outbound · {loss} adjustment' },
            { inbound: approvals.inbound, outbound: approvals.outbound, loss: approvals.loss },
          )
        : '',
      href: '/inbound-transaction?tab=receiving',
    },
    {
      icon: <KpiPutawayQueueIcon size={44} />,
      label: intl.formatMessage({ id: 'dashboard.kpi_putaway_queue', defaultMessage: 'Putaway Queue' }),
      value: exec?.putawayPending ?? '—',
      sub: intl.formatMessage({ id: 'dashboard.kpi_putaway_queue_sub', defaultMessage: 'Pallets awaiting storage placement' }),
      href: '/warehouse',
    },
    {
      icon: <KpiDispatchQueueIcon size={44} />,
      label: intl.formatMessage({ id: 'dashboard.kpi_dispatch_queue', defaultMessage: 'Dispatch Queue' }),
      value: exec?.dispatchPending ?? '—',
      sub: intl.formatMessage({ id: 'dashboard.kpi_dispatch_queue_sub', defaultMessage: 'Pallets awaiting outbound pick' }),
      href: '/outbound-transaction',
    },
  ];

  const totalInbound = mo?.totalInbound ?? 0;
  const totalOutbound = mo?.totalOutbound ?? 0;
  const totalApprovals = approvals?.total ?? 0;
  const maxFlow = Math.max(totalInbound, totalOutbound, 1);

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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {intl.formatMessage({ id: 'dashboard.title', defaultMessage: 'Dashboard' })}
          </h1>
          <p className="text-sm text-muted">
            {intl.formatMessage({ id: 'dashboard.subtitle', defaultMessage: 'Operational overview for your warehouse management system' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="hidden text-xs text-muted sm:inline">
              {intl.formatMessage({ id: 'dashboard.last_updated', defaultMessage: 'Updated {time} ago' }, { time: relativeTime(lastUpdated.toISOString()) })}
            </span>
          )}
          <Button size="sm" variant="ghost" onPress={handleRefreshAll} isPending={isLoading}>
            <Icon icon="solar:refresh-linear" className="size-4" />
            {intl.formatMessage({ id: 'dashboard.refresh', defaultMessage: 'Refresh' })}
          </Button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-1 gap-4 auto-rows-fr sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} loading={isLoading} navigate={navigate} />
        ))}
      </div>

      {/* ── My Tasks row ── */}
      {myTasks && (myTasks.totalApprovals > 0 || myTasks.myDrafts.total > 0 || (myTasks.execution?.putawayPending ?? 0) > 0 || (myTasks.execution?.pickPending ?? 0) > 0) && (
        <Card>
          <Card.Header>
            <div>
              <Card.Title>
                {intl.formatMessage({ id: 'dashboard.my_tasks_title', defaultMessage: 'My Tasks' })}
              </Card.Title>
              <Card.Description>
                {intl.formatMessage({ id: 'dashboard.my_tasks_sub', defaultMessage: 'Items requiring your attention' })}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {myTasks.totalApprovals > 0 && (
                <button type="button" onClick={() => navigate('/inbound-transaction?tab=receiving')} className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4 text-left transition-colors hover:bg-warning/10">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-warning-soft">
                    <Icon icon="solar:checklist-minimalistic-linear" className="size-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{myTasks.totalApprovals}</p>
                    <p className="text-xs text-muted">{intl.formatMessage({ id: 'dashboard.my_tasks_approvals', defaultMessage: 'Pending Approval' })}</p>
                  </div>
                </button>
              )}
              {myTasks.myDrafts.total > 0 && (
                <button type="button" onClick={() => navigate('/inbound-transaction')} className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface p-4 text-left transition-colors hover:bg-surface-hover">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft">
                    <Icon icon="solar:document-text-linear" className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{myTasks.myDrafts.total}</p>
                    <p className="text-xs text-muted">{intl.formatMessage({ id: 'dashboard.my_tasks_drafts', defaultMessage: 'My Drafts' })}</p>
                  </div>
                </button>
              )}
              {(myTasks.execution?.putawayPending ?? 0) > 0 && (
                <button type="button" onClick={() => navigate('/warehouse')} className="flex items-center gap-3 rounded-xl border border-teal/30 bg-teal/5 p-4 text-left transition-colors hover:bg-teal/10">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-tertiary-soft">
                    <Icon icon="solar:download-minimalistic-linear" className="size-5 text-tertiary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-tertiary">{myTasks.execution.putawayPending}</p>
                    <p className="text-xs text-muted">{intl.formatMessage({ id: 'dashboard.my_tasks_putaway', defaultMessage: 'Putaway Queue' })}</p>
                  </div>
                </button>
              )}
              {(myTasks.execution?.pickPending ?? 0) > 0 && (
                <button type="button" onClick={() => navigate('/outbound-transaction')} className="flex items-center gap-3 rounded-xl border border-purple/30 bg-purple/5 p-4 text-left transition-colors hover:bg-purple/10">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-secondary-soft">
                    <Icon icon="solar:delivery-linear" className="size-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary">{myTasks.execution.pickPending}</p>
                    <p className="text-xs text-muted">{intl.formatMessage({ id: 'dashboard.my_tasks_dispatch', defaultMessage: 'Dispatch Queue' })}</p>
                  </div>
                </button>
              )}
            </div>
          </Card.Content>
        </Card>
      )}

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
            {summaryError ? (
              <QueryError onRetry={() => void refetchSummary()} />
            ) : isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner size="sm" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Comparison bars — inbound vs outbound */}
                <div className="space-y-2.5">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-primary">
                        {intl.formatMessage({ id: 'dashboard.flow_inbound', defaultMessage: 'Inbound' })}
                      </span>
                      <span className="tabular-nums font-semibold text-primary">{totalInbound}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-border/30">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(totalInbound / maxFlow) * 100}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-secondary">
                        {intl.formatMessage({ id: 'dashboard.flow_outbound', defaultMessage: 'Outbound' })}
                      </span>
                      <span className="tabular-nums font-semibold text-secondary">{totalOutbound}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-border/30">
                      <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${(totalOutbound / maxFlow) * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* Breakdown columns */}
                <div className="grid grid-cols-2 gap-6 border-t border-border/40 pt-4">
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
                      {prev && prev.receiving > 0 && <DeltaBadge current={totalInbound} prev={prev.receiving} />}
                    </div>
                  </div>
                  <div className="divide-y divide-border/40">
                    <div className="py-1.5">
                      <FlowRow color="bg-primary" count={mo?.receiving ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_receiving', defaultMessage: 'Receiving' })} />
                      <FlowBar count={mo?.receiving ?? 0} total={totalInbound} color="bg-primary" />
                    </div>
                    <div className="py-1.5">
                      <FlowRow color="bg-primary/60" count={mo?.wipCompletion ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_wip_completion', defaultMessage: 'WIP Completion' })} />
                      <FlowBar count={mo?.wipCompletion ?? 0} total={totalInbound} color="bg-primary/60" />
                    </div>
                    <div className="py-1.5">
                      <FlowRow color="bg-primary/40" count={mo?.rmaReceipt ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_rma', defaultMessage: 'RMA Receipt' })} />
                      <FlowBar count={mo?.rmaReceipt ?? 0} total={totalInbound} color="bg-primary/40" />
                    </div>
                    <div className="py-1.5">
                      <FlowRow color="bg-primary/20" count={mo?.found ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_found', defaultMessage: 'Found' })} />
                      <FlowBar count={mo?.found ?? 0} total={totalInbound} color="bg-primary/20" />
                    </div>
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
                      {prev && prev.shipment > 0 && <DeltaBadge current={totalOutbound} prev={prev.shipment} />}
                    </div>
                  </div>
                  <div className="divide-y divide-border/40">
                    <div className="py-1.5">
                      <FlowRow color="bg-secondary" count={mo?.shipment ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_shipment', defaultMessage: 'Shipment' })} />
                      <FlowBar count={mo?.shipment ?? 0} total={totalOutbound} color="bg-secondary" />
                    </div>
                    <div className="py-1.5">
                      <FlowRow color="bg-secondary/60" count={mo?.wipIssue ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_wip_issue', defaultMessage: 'WIP Issue' })} />
                      <FlowBar count={mo?.wipIssue ?? 0} total={totalOutbound} color="bg-secondary/60" />
                    </div>
                    <div className="py-1.5">
                      <FlowRow color="bg-secondary/40" count={mo?.returnToSupplier ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_rts', defaultMessage: 'Return to Supplier' })} />
                      <FlowBar count={mo?.returnToSupplier ?? 0} total={totalOutbound} color="bg-secondary/40" />
                    </div>
                    <div className="py-1.5">
                      <FlowRow color="bg-secondary/20" count={mo?.disposal ?? 0} label={intl.formatMessage({ id: 'dashboard.flow_breakdown_disposal', defaultMessage: 'Disposal' })} />
                      <FlowBar count={mo?.disposal ?? 0} total={totalOutbound} color="bg-secondary/20" />
                    </div>
                  </div>
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
            {summaryError ? (
              <QueryError onRetry={() => void refetchSummary()} />
            ) : isLoading ? (
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
                <ApprovalRow count={approvals?.loss ?? 0} href="/outbound-transaction?tab=loss" icon="solar:danger-triangle-linear" label={intl.formatMessage({ id: 'dashboard.flow_breakdown_loss', defaultMessage: 'Loss' })} navigate={navigate} />
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
            {allocationsError ? (
              <QueryError onRetry={() => void refetchAllocations()} />
            ) : !allocations ? (
              <div className="flex h-40 items-center justify-center">
                <Spinner size="sm" />
              </div>
            ) : allocations.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted">
                <Icon icon="solar:buildings-linear" className="size-8" />
                <span className="text-sm">{intl.formatMessage({ id: 'dashboard.capacity_empty', defaultMessage: 'No warehouses found' })}</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary line */}
                {(() => {
                  const totalLocations = allocations.reduce((s: number, a: { total: number }) => s + a.total, 0);
                  const usedLocations = allocations.reduce((s: number, a: { used: number }) => s + a.used, 0);
                  const overallRate = totalLocations > 0 ? Math.round((usedLocations / totalLocations) * 100) : 0;
                  return (
                    <p className="text-xs text-muted">
                      {intl.formatMessage(
                        { id: 'dashboard.capacity_summary', defaultMessage: '{count} warehouses · {total} locations · {rate}% overall utilization' },
                        { count: allocations.length, total: totalLocations, rate: overallRate },
                      )}
                    </p>
                  );
                })()}
                {allocations.map((a: { warehouseId: string; warehouseName: string | null; total: number; used: number; rate: number }) => {
                  const name = a.warehouseName ?? a.warehouseId;
                  const rateColor =
                    a.rate >= 90 ? 'bg-danger' : a.rate >= 70 ? 'bg-warning' : 'bg-success';
                  return (
                    <button
                      key={a.warehouseId}
                      type="button"
                      onClick={() => navigate(`/warehouse/${a.warehouseId}`)}
                      className="block w-full text-left transition-opacity hover:opacity-80"
                    >
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
                    </button>
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
            {activityError ? (
              <QueryError onRetry={() => void refetchActivity()} />
            ) : !activityData ? (
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
                {activityData.data.map((entry: { id: string; action: string; message: string; createdAt: string; resource?: string | null; resourceId?: string | null; user?: { name?: string | null; email: string } | null }) => {
                  const color = ACTION_COLOR_MAP[entry.action] ?? 'default';
                  // Build a click-through href from the activity log's resource/resourceId.
                  // Only known transaction resources are linked; unknown ones render as plain rows.
                  const href = entry.resource && entry.resourceId
                    ? RESOURCE_HREF_MAP[entry.resource] ?? null
                    : null;
                  const RowTag = href ? 'button' : 'div';
                  return (
                    <RowTag
                      key={entry.id}
                      {...(href ? { type: 'button' as const, onClick: () => navigate(href) } : {})}
                      className={`flex items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors ${href ? 'hover:bg-surface-hover' : ''}`}
                    >
                      <Chip color={color} size="sm" variant="soft">
                        {entry.action}
                      </Chip>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{entry.message}</p>
                        <p className="text-xs text-muted">{entry.user?.name ?? entry.user?.email}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{relativeTime(entry.createdAt)}</span>
                    </RowTag>
                  );
                })}
              </div>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* ── Warehouse 3D Scene ── */}
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
          <div className="relative" style={{ height: '60vh', minHeight: 400 }}>
            {/* Legend overlay */}
            <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-lg border border-border/40 bg-surface/80 px-3 py-2 text-[0.6875rem] text-muted backdrop-blur-sm">
              <span className="flex items-center gap-1.5">
                <Icon icon="solar:mouse-linear" className="size-3" />
                {intl.formatMessage({ id: 'dashboard.canvas_legend_left_click', defaultMessage: 'Left click — open detail' })}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon icon="solar:mouse-square-linear" className="size-3" />
                {intl.formatMessage({ id: 'dashboard.canvas_legend_right_click', defaultMessage: 'Right click — inspect allocation' })}
              </span>
              <span className="flex items-center gap-1.5">
                <Icon icon="solar:hand-linear" className="size-3" />
                {intl.formatMessage({ id: 'dashboard.canvas_legend_drag', defaultMessage: 'Drag to orbit' })}
              </span>
            </div>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center gap-2 text-muted">
                  <Spinner size="sm" />
                  <span className="text-sm">{intl.formatMessage({ id: 'dashboard.canvas_loading', defaultMessage: 'Loading 3D warehouse map…' })}</span>
                </div>
              }
            >
              <WarehousesScene allocations={allocations ?? []} />
            </Suspense>
          </div>
        </Card.Content>
      </Card>
    </section>
  );
}

export { Dashboard };
