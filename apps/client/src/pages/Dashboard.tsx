import { Suspense, useState, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Chip, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { useAtomValue } from 'jotai';
import { trpcClient } from '../lib/trpc';
import { authUserAtom } from '../lib/atoms';
import { AiInsightsCard } from '../components/AiInsights/AiInsightsCard';
import { AiDigestCard } from '../components/AiDigest/AiDigestCard';
import { WarehousesScene } from './_WarehousesScene';
import {
  KpiPalletsIcon,
  KpiAvailablePalletsIcon,
  KpiPendingApprovalsIcon,
  KpiPutawayQueueIcon,
  KpiDispatchQueueIcon,
} from '../assets/KpiIcons';

// ─── Animated gradient header background ────────────────────────────────────
const gradientKeyframes = `
@keyframes dashboardGradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes dashboardPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
`;

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

// KPI accent colors: one per tile position, matching icon themes
const KPI_ACCENT_COLORS = [
  { bar: '#6366f1', glow: 'rgba(99,102,241,0.35)' },  // indigo — total pallets
  { bar: '#10b981', glow: 'rgba(16,185,129,0.35)' },  // emerald — available
  { bar: '#f59e0b', glow: 'rgba(245,158,11,0.35)' },  // amber — pending approvals
  { bar: '#0ea5e9', glow: 'rgba(14,165,233,0.35)' },  // sky — putaway
  { bar: '#8b5cf6', glow: 'rgba(139,92,246,0.35)' },  // violet — dispatch
];

function KpiCard({
  kpi,
  loading,
  navigate,
  accentIndex,
  prev,
}: {
  kpi: KpiDef;
  loading: boolean;
  navigate: (path: string) => void;
  accentIndex: number;
  prev?: number;
}) {
  const accent = KPI_ACCENT_COLORS[accentIndex % KPI_ACCENT_COLORS.length];
  const currentVal = typeof kpi.value === 'number' ? kpi.value : null;
  const trendUp = currentVal !== null && prev !== undefined && prev > 0 && currentVal > prev;
  const trendDown = currentVal !== null && prev !== undefined && prev > 0 && currentVal < prev;

  const inner = (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: accent.bar,
          borderRadius: '4px 0 0 4px',
        }}
      />
      <div className="flex h-full flex-col gap-3 p-4 pl-5">
        <div className="flex items-start justify-between">
          {kpi.icon}
          {kpi.href && (
            <Icon icon="solar:arrow-right-up-linear" className="size-4 text-muted/50" />
          )}
        </div>
        <div className="mt-auto space-y-1">
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <div className="flex items-end gap-1.5">
              <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">{kpi.value}</p>
              {trendUp && <Icon icon="solar:arrow-up-bold" className="mb-1 size-4 text-success" />}
              {trendDown && <Icon icon="solar:arrow-down-bold" className="mb-1 size-4 text-danger" />}
            </div>
          )}
          <p className="text-sm font-medium text-foreground">{kpi.label}</p>
          <p className="text-xs text-muted leading-relaxed line-clamp-2">{kpi.sub}</p>
        </div>
      </div>
    </div>
  );

  const hoverStyle = {
    transition: 'box-shadow 0.2s ease, transform 0.15s ease',
  };

  if (kpi.href) {
    return (
      <button
        type="button"
        onClick={() => navigate(kpi.href!)}
        className="h-full text-left"
        style={hoverStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
          (e.currentTarget as HTMLButtonElement).style.filter = `drop-shadow(0 4px 16px ${accent.glow})`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = '';
          (e.currentTarget as HTMLButtonElement).style.filter = '';
        }}
      >
        <Card style={{ height: '100%' }}>{inner}</Card>
      </button>
    );
  }
  return <Card style={{ height: '100%' }}>{inner}</Card>;
}

// ─── Butterfly (diverging) flow bar ──────────────────────────────────────────
function ButterflyRow({
  label,
  inCount,
  outCount,
  inColor,
  outColor,
  maxVal,
}: {
  label: string;
  inCount: number;
  outCount: number;
  inColor: string;
  outColor: string;
  maxVal: number;
}) {
  const inPct = maxVal > 0 ? (inCount / maxVal) * 100 : 0;
  const outPct = maxVal > 0 ? (outCount / maxVal) * 100 : 0;
  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
      {/* Inbound bar — grows LEFT from center */}
      <div className="flex items-center justify-end gap-1.5">
        {inCount > 0 && (
          <span className="tabular-nums text-xs font-semibold text-primary">{inCount}</span>
        )}
        <div className="flex h-5 w-full items-center justify-end overflow-hidden rounded-l-full bg-border/20">
          <div
            className="h-full rounded-l-full transition-all"
            style={{ width: `${inPct}%`, background: inColor }}
          />
        </div>
      </div>
      {/* Center label */}
      <div className="w-28 text-center">
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
      {/* Outbound bar — grows RIGHT from center */}
      <div className="flex items-center gap-1.5">
        <div className="flex h-5 w-full items-center overflow-hidden rounded-r-full bg-border/20">
          <div
            className="h-full rounded-r-full transition-all"
            style={{ width: `${outPct}%`, background: outColor }}
          />
        </div>
        {outCount > 0 && (
          <span className="tabular-nums text-xs font-semibold text-secondary">{outCount}</span>
        )}
      </div>
    </div>
  );
}

// ─── Segmented capacity blocks ────────────────────────────────────────────────
function CapacityBlocks({ rate, warehouseId }: { rate: number; warehouseId: string }) {
  const TOTAL_BLOCKS = 20;
  const filled = Math.round((rate / 100) * TOTAL_BLOCKS);
  const blockColor =
    rate >= 90 ? '#ef4444' : rate >= 70 ? '#f59e0b' : '#10b981';
  return (
    <div className="flex gap-0.5" aria-label={`${rate}% capacity for warehouse ${warehouseId}`}>
      {Array.from({ length: TOTAL_BLOCKS }).map((_, i) => (
        <div
          key={i}
          style={{
            width: '100%',
            height: 14,
            borderRadius: 3,
            background: i < filled ? blockColor : 'rgba(128,128,128,0.15)',
            transition: 'background 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

// FlowRow and FlowBar kept for DeltaBadge peer usage — butterfly layout replaces them in render
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

function FlowBar({ count, total, color }: { count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="mt-1 h-1 overflow-hidden rounded-full bg-border/30">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Suppress unused-variable warnings — kept for potential downstream use
void FlowRow;
void FlowBar;

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
  const authUser = useAtomValue(authUserAtom);

  const today = new Date();
  const hour = today.getHours();
  const greetingKey =
    hour < 12
      ? 'dashboard.greeting_morning'
      : hour < 17
        ? 'dashboard.greeting_afternoon'
        : 'dashboard.greeting_evening';
  const greetingDefault =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const formattedDate = today.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const { data: summary, isLoading, isError: summaryError, refetch: refetchSummary } = useQuery({
    queryKey: ['dashboard.summary'],
    queryFn: async () => {
      const result = await trpcClient.dashboard.summary.query();
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
      href: '/pallets',
    },
    {
      icon: <KpiAvailablePalletsIcon size={44} />,
      label: intl.formatMessage({ id: 'dashboard.kpi_available_pallets', defaultMessage: 'Available Pallets' }),
      value: pallets?.available ?? '—',
      sub: intl.formatMessage({ id: 'dashboard.kpi_available_pallets_sub', defaultMessage: 'Ready for putaway' }),
      href: '/pallets?status=available',
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
  const maxFlow = Math.max(
    mo?.receiving ?? 0,
    mo?.wipCompletion ?? 0,
    mo?.rmaReceipt ?? 0,
    mo?.found ?? 0,
    mo?.shipment ?? 0,
    mo?.wipIssue ?? 0,
    mo?.returnToSupplier ?? 0,
    mo?.disposal ?? 0,
    1,
  );

  return (
    <>
      <style>{gradientKeyframes}</style>
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
        {/* ── Hero header ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--color-primary)/15%, var(--color-secondary)/10%, var(--color-tertiary)/8%, var(--color-primary)/12%)',
            backgroundSize: '400% 400%',
            animation: 'dashboardGradientShift 12s ease infinite',
            borderRadius: 16,
            padding: '1.5rem 1.75rem',
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted">
                {intl.formatMessage({ id: greetingKey, defaultMessage: greetingDefault })}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {authUser?.name ?? authUser?.email ?? intl.formatMessage({ id: 'dashboard.title', defaultMessage: 'Dashboard' })}
              </h1>
              <p className="text-sm text-muted">{formattedDate}</p>
            </div>
            <div className="flex items-center gap-4">
              <Button size="sm" variant="ghost" onPress={handleRefreshAll} isPending={isLoading}>
                <Icon icon="solar:refresh-linear" className="size-4" />
                {intl.formatMessage({ id: 'dashboard.refresh', defaultMessage: 'Refresh' })}
              </Button>
            </div>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-1 gap-4 auto-rows-fr sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map((kpi, i) => (
            <KpiCard
              key={kpi.label}
              kpi={kpi}
              loading={isLoading}
              navigate={navigate}
              accentIndex={i}
              prev={
                i === 0 ? (prev ? prev.receiving : undefined)
                : i === 2 ? (prev ? (prev.receiving > 0 ? prev.receiving : undefined) : undefined)
                : undefined
              }
            />
          ))}
        </div>

        {/* ── AI Insights (proactive health monitoring) ── */}
        <AiInsightsCard />

        {/* ── AI Daily Digest (proactive morning briefing) ── */}
        <AiDigestCard />

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
              <div className="space-y-3">
                {/* Legend row */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2.5 rounded-full bg-primary" />
                    <span className="font-medium text-primary">
                      {intl.formatMessage({ id: 'dashboard.flow_inbound', defaultMessage: 'Inbound' })}
                    </span>
                    <span className="tabular-nums font-bold text-primary ml-1">{totalInbound}</span>
                    {prev && prev.receiving > 0 && <DeltaBadge current={totalInbound} prev={prev.receiving} />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {prev && prev.shipment > 0 && <DeltaBadge current={totalOutbound} prev={prev.shipment} />}
                    <span className="tabular-nums font-bold text-secondary mr-1">{totalOutbound}</span>
                    <span className="font-medium text-secondary">
                      {intl.formatMessage({ id: 'dashboard.flow_outbound', defaultMessage: 'Outbound' })}
                    </span>
                    <div className="size-2.5 rounded-full bg-secondary" />
                  </div>
                </div>
                {/* Butterfly rows */}
                <div className="space-y-2">
                  <ButterflyRow
                    label={intl.formatMessage({ id: 'dashboard.flow_breakdown_receiving', defaultMessage: 'Receiving' })}
                    inCount={mo?.receiving ?? 0} outCount={0}
                    inColor="#6366f1" outColor="#8b5cf6" maxVal={maxFlow}
                  />
                  <ButterflyRow
                    label={intl.formatMessage({ id: 'dashboard.flow_breakdown_wip_completion', defaultMessage: 'WIP Completion' })}
                    inCount={mo?.wipCompletion ?? 0} outCount={mo?.wipIssue ?? 0}
                    inColor="#818cf8" outColor="#a78bfa" maxVal={maxFlow}
                  />
                  <ButterflyRow
                    label={intl.formatMessage({ id: 'dashboard.flow_breakdown_rma', defaultMessage: 'RMA Receipt' })}
                    inCount={mo?.rmaReceipt ?? 0} outCount={mo?.returnToSupplier ?? 0}
                    inColor="#a5b4fc" outColor="#c4b5fd" maxVal={maxFlow}
                  />
                  <ButterflyRow
                    label={intl.formatMessage({ id: 'dashboard.flow_breakdown_found', defaultMessage: 'Found' })}
                    inCount={mo?.found ?? 0} outCount={mo?.disposal ?? 0}
                    inColor="#c7d2fe" outColor="#ddd6fe" maxVal={maxFlow}
                  />
                  <ButterflyRow
                    label={intl.formatMessage({ id: 'dashboard.flow_breakdown_shipment', defaultMessage: 'Shipment' })}
                    inCount={0} outCount={mo?.shipment ?? 0}
                    inColor="#6366f1" outColor="#7c3aed" maxVal={maxFlow}
                  />
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
                <div className="flex items-center gap-2">
                  <Card.Title>
                    {intl.formatMessage({ id: 'dashboard.section_approvals', defaultMessage: 'Approval Backlog' })}
                  </Card.Title>
                  {totalApprovals > 0 && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#f59e0b',
                        animation: 'dashboardPulse 1.5s ease-in-out infinite',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
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
                    a.rate >= 90 ? 'text-danger' : a.rate >= 70 ? 'text-warning' : 'text-success';
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
                          <span className={`font-semibold tabular-nums ${rateColor}`}>{a.rate}%</span>
                        </div>
                      </div>
                      <CapacityBlocks rate={a.rate} warehouseId={a.warehouseId} />
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
              <div className="relative space-y-1 pl-2">
                {/* Vertical connecting line */}
                <div
                  className="absolute left-4.75 top-2 bottom-2 w-px bg-border/50"
                  aria-hidden
                />
                {activityData.data.map((entry: { id: string; action: string; message: string; createdAt: string; resource?: string | null; resourceId?: string | null; user?: { name?: string | null; email: string } | null }) => {
                  const color = ACTION_COLOR_MAP[entry.action] ?? 'default';
                  const dotColor =
                    color === 'success' ? '#10b981'
                    : color === 'danger' ? '#ef4444'
                    : color === 'warning' ? '#f59e0b'
                    : color === 'accent' ? '#6366f1'
                    : '#9ca3af';
                  const href = entry.resource && entry.resourceId
                    ? RESOURCE_HREF_MAP[entry.resource] ?? null
                    : null;
                  const RowTag = href ? 'button' : 'div';
                  return (
                    <RowTag
                      key={entry.id}
                      {...(href ? { type: 'button' as const, onClick: () => navigate(href) } : {})}
                      className={`relative flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors ${href ? 'hover:bg-surface-hover' : ''}`}
                    >
                      {/* Timeline dot */}
                      <span
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          flexShrink: 0,
                          width: 9,
                          height: 9,
                          marginTop: 6,
                          borderRadius: '50%',
                          background: dotColor,
                          boxShadow: `0 0 0 3px var(--color-surface, #fff)`,
                        }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Chip color={color} size="sm" variant="soft">
                            {entry.action}
                          </Chip>
                          <span className="shrink-0 text-xs text-muted">{relativeTime(entry.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-foreground">{entry.message}</p>
                        <p className="text-xs text-muted">{entry.user?.name ?? entry.user?.email}</p>
                      </div>
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
    </>
  );
}

export { Dashboard };
