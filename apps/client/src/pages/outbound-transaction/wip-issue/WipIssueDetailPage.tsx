import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Chip, Fieldset, FieldsetLegend, FieldGroup, Separator } from '@heroui/react';
import type { ChipProps } from '@heroui/react';
import {
  BoxIcon,
  CheckCircleIcon,
  ClipboardIcon,
  CloseCircleIcon,
  DocumentIcon,
  LayersIcon,
  PenIcon,
  ScaleIcon,
  WipIssueTypeIcon,
} from '../../../assets/IconRegistry';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { PageHeader } from '../../../components/PageHeader';
import { PrintDocumentButton } from '../../../components/PrintDocumentButton';
import {
  ActionModal,
  AuditTrail,
  CalloutCard,
  DetailSkeleton,
  HeroSummaryCard,
  HERO_GRADIENTS,
  KpiCard,
  MetaItem,
  resolveStatusColor,
  TransactionItemsTable,
  useTransactionDetailActions,
  type ActionModalMessages,
  type AuditTrailMessages,
  type DetailItemRow,
  type ItemsTableMessages,
} from '../_detail-shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkuRef {
  id: string;
  code?: string | null;
  name: string;
}

interface UserRef {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface WarehouseRef {
  id: string;
  name: string;
}

interface WipIssueItem {
  id: string;
  skuId: string;
  sku: SkuRef;
  quantity: number | { toNumber(): number };
  details?: string | null;
}

interface WipIssueDetail {
  id: string;
  documentNumber?: string | null;
  date: string | Date;
  workOrderRef?: string | null;
  reference?: string | null;
  notes?: string | null;
  warehouseId: string;
  warehouse: WarehouseRef;
  approvalStatus: string;
  dispatchStatus: string;
  approvalHistory?: unknown;
  createdById: string;
  createdBy: UserRef;
  approvedById?: string | null;
  approvedBy?: UserRef | null;
  approvedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  items: WipIssueItem[];
  totalItems: number;
  totalQuantity: number;
}

const DISPATCH_COLOR: Record<string, ChipProps['color']> = {
  PENDING: 'default',
  PARTIAL: 'warning',
  COMPLETED: 'success',
};

// ─── Main component ───────────────────────────────────────────────────────────

function WipIssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const canApprove = hasPermission('wip-issue@approve');
  const canUpdate = hasPermission('wip-issue@update');
  const canDelete = hasPermission('wip-issue@delete');

  const t = (k: string, fallback: string) => intl.formatMessage({ id: k, defaultMessage: fallback });

  const { data: rawDetail, isLoading } = useQuery({
    queryKey: ['wipIssueDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.wipIssue.detail.query({ id: id! }),
  });

  const detail = rawDetail as WipIssueDetail | undefined;

  const { actionModal, setActionModal, isActing, actionError, setActionError, handleConfirm } = useTransactionDetailActions({
    resource: 'wipIssue',
    id,
    detailQueryKey: 'wipIssueDetail',
    listQueryKey: 'wipIssueList',
    backPath: '/outbound-transaction',
  });

  if (isLoading) return <DetailSkeleton />;

  if (!detail) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BoxIcon size={32} className="text-muted" />
          <p className="text-sm text-muted">{t('wip_issue.detail_not_found', 'WIP issue not found.')}</p>
          <Button variant="ghost" onPress={() => navigate('/outbound-transaction')}>
            {t('wip_issue.detail_back', 'Back')}
          </Button>
        </div>
      </section>
    );
  }

  const approvalColor = resolveStatusColor(
    { DRAFT: 'default', PROPOSED: 'warning', APPROVED: 'success', REJECTED: 'danger' },
    detail.approvalStatus,
  ) as ChipProps['color'];
  const dispatchColor = resolveStatusColor(DISPATCH_COLOR, detail.dispatchStatus);
  const isProposed = detail.approvalStatus === 'PROPOSED';
  const isDraft = detail.approvalStatus === 'DRAFT';
  const isRejected = detail.approvalStatus === 'REJECTED';
  const isApproved = detail.approvalStatus === 'APPROVED';
  const isEditable = isDraft || isRejected;
  const hasNotes = Boolean(detail.notes && detail.notes.trim());
  const formattedDate = intl.formatDate(new Date(detail.date), { dateStyle: 'medium' });
  const formattedCreated = intl.formatDate(new Date(detail.createdAt), { dateStyle: 'medium', timeStyle: 'short', hour12: false });
  const formattedApproved = detail.approvedAt
    ? intl.formatDate(new Date(detail.approvedAt), { dateStyle: 'medium', timeStyle: 'short', hour12: false })
    : null;
  const dispatchLabelKey = `wip_issue.detail_dispatch_${detail.dispatchStatus.toLowerCase()}`;
  const dispatchLabel = t(dispatchLabelKey, detail.dispatchStatus);

  const itemsTableMessages: ItemsTableMessages = {
    sectionTitle: t('wip_issue.detail_section_items', 'WIP Issue Items'),
    sectionDesc: t('wip_issue.detail_section_items_desc', 'SKUs and quantities issued to production in this transaction'),
    skuCode: t('wip_issue.detail_col_sku_code', 'SKU Code'),
    skuName: t('wip_issue.detail_col_sku_name', 'SKU Name'),
    qty: t('wip_issue.detail_col_qty', 'Qty'),
    details: t('wip_issue.detail_col_details', 'Details'),
    total: t('wip_issue.detail_total_row', 'Total'),
    empty: t('wip_issue.empty', 'No items.'),
  };

  const auditMessages: AuditTrailMessages = {
    sectionTitle: t('wip_issue.detail_section_audit', 'Audit Trail'),
    sectionDesc: t('wip_issue.detail_section_audit_desc', 'Who created, approved, and when'),
    createdBy: t('wip_issue.detail_label_created_by', 'Created By'),
    createdAt: t('wip_issue.detail_label_created_at', 'Created At'),
    approvedBy: t('wip_issue.detail_label_approved_by', 'Approved By'),
    approvedAt: t('wip_issue.detail_label_approved_at', 'Approved At'),
    putawayStatus: t('wip_issue.detail_label_dispatch_status', 'Dispatch Status'),
  };

  const actionMessages: ActionModalMessages = {
    processing: t('wip_issue.action_processing', 'Processing…'),
    pleaseWait: t('wip_issue.action_please_wait', 'Please wait…'),
    errorTitle: t('wip_issue.action_error_title', 'Something went wrong'),
    close: t('wip_issue.action_close', 'Close'),
    approveTitle: t('wip_issue.confirm_approve_title', 'Confirm Approve'),
    rejectTitle: t('wip_issue.confirm_reject_title', 'Confirm Reject'),
    deleteTitle: t('wip_issue.delete_modal_title', 'Delete WIP Issue'),
    approveDesc: t('wip_issue.confirm_approve_desc', 'Approve this WIP issue? This action cannot be undone.'),
    rejectDesc: t('wip_issue.confirm_reject_desc', 'Reject this WIP issue? This action cannot be undone.'),
    deleteBody: intl.formatMessage(
      { id: 'wip_issue.delete_modal_body', defaultMessage: 'Are you sure you want to delete WIP issue {id}?' },
      { id: detail.id },
    ),
    messageLabel: t('wip_issue.approval_message_label', 'Message'),
    messagePlaceholder: t('wip_issue.approval_message_placeholder', 'Add a message (optional)'),
    cancel: t('wip_issue.action_cancel', 'Cancel'),
    approve: t('wip_issue.action_approve', 'Approve'),
    reject: t('wip_issue.action_reject', 'Reject'),
    deleteConfirm: t('wip_issue.delete_confirm', 'Delete'),
  };

  const items: DetailItemRow[] = detail.items.map((item) => ({
    id: item.id,
    sku: item.sku,
    quantity: item.quantity,
    details: item.details,
  }));

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'wip-issue-detail',
        id: detail.id,
        documentNumber: detail.documentNumber,
        approvalStatus: detail.approvalStatus,
        dispatchStatus: detail.dispatchStatus,
      })}
    >
      <PageHeader
        title={detail.documentNumber ?? detail.id}
        onBack={() => navigate('/outbound-transaction')}
        onEdit={isEditable && canUpdate ? () => navigate(`/outbound-transaction/wip-issue/${detail.id}/edit`) : undefined}
        onDelete={isDraft && canDelete ? () => setActionModal({ kind: 'delete', message: '' }) : undefined}
      />

      {/* ── Hero summary card ─────────────────────────────────────────────── */}
      <HeroSummaryCard
        gradientClass={HERO_GRADIENTS.wipIssue}
        title={detail.documentNumber ?? detail.id}
        subtitle={t('wip_issue.detail_subtitle', 'Materials issued from warehouse to production')}
        statusChips={
          <>
            <Chip color={approvalColor} variant="soft" size="sm">
              {detail.approvalStatus}
            </Chip>
            {isApproved && <Chip color={dispatchColor} variant="soft" size="sm">{dispatchLabel}</Chip>}
          </>
        }
        actions={
          <>
            {isProposed && canApprove && (
              <Button
                variant="primary"
                className="bg-success hover:bg-success-hover"
                onPress={() => setActionModal({ kind: 'approve', message: '' })}
              >
                <CheckCircleIcon size={16} />
                {t('wip_issue.action_approve', 'Approve')}
              </Button>
            )}
            {isProposed && canApprove && (
              <Button variant="danger-soft" onPress={() => setActionModal({ kind: 'reject', message: '' })}>
                <CloseCircleIcon size={16} className="text-danger" />
                {t('wip_issue.action_reject', 'Reject')}
              </Button>
            )}
            {isEditable && canUpdate && (
              <Button variant="ghost" onPress={() => navigate(`/outbound-transaction/wip-issue/${detail.id}/edit`)}>
                <PenIcon size={16} />
                {t('wip_issue.action_edit', 'Edit')}
              </Button>
            )}
            {detail.id ? <PrintDocumentButton type="wip-issue" transactionId={detail.id} /> : null}
          </>
        }
        metaItems={
          <>
            <MetaItem
              icon={<DocumentIcon size={13} />}
              label={t('wip_issue.detail_hero_document', 'Document')}
              value={detail.documentNumber ?? '—'}
              mono
            />
            <MetaItem
              icon={<BoxIcon size={13} />}
              label={t('wip_issue.detail_hero_warehouse', 'Warehouse')}
              value={detail.warehouse?.name ?? '—'}
            />
            <MetaItem
              icon={<ClipboardIcon size={13} />}
              label={t('wip_issue.detail_hero_date', 'Date')}
              value={formattedDate}
            />
            <MetaItem
              icon={<WipIssueTypeIcon size={13} />}
              label={t('wip_issue.detail_hero_work_order', 'Work Order')}
              value={detail.workOrderRef}
              mono
            />
          </>
        }
      />

      {/* ── KPI metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<LayersIcon size={20} />}
          label={t('wip_issue.detail_kpi_items', 'Total Items')}
          value={detail.totalItems}
          color={approvalColor}
        />
        <KpiCard
          icon={<ScaleIcon size={20} />}
          label={t('wip_issue.detail_kpi_quantity', 'Total Quantity')}
          value={detail.totalQuantity.toLocaleString()}
          color={approvalColor}
        />
        <KpiCard
          icon={<CheckCircleIcon size={20} />}
          label={t('wip_issue.detail_kpi_approval', 'Approval')}
          value={<Chip color={approvalColor} variant="soft" size="sm">{detail.approvalStatus}</Chip>}
        />
        <KpiCard
          icon={<WipIssueTypeIcon size={20} />}
          label={t('wip_issue.detail_kpi_dispatch', 'Dispatch')}
          value={<Chip color={dispatchColor} variant="soft" size="sm">{dispatchLabel}</Chip>}
        />
      </div>

      {/* ── Production callout (domain-specific) ───────────────────────── */}
      <CalloutCard
        icon={<WipIssueTypeIcon size={18} />}
        tone="warning"
        title={t('wip_issue.detail_callout_title', 'Issued to production')}
        description={t('wip_issue.detail_callout_desc', 'These materials are consumed by a production order and reduce warehouse stock.')}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaItem label={t('wip_issue.label_work_order_ref', 'Work Order Ref')} value={detail.workOrderRef} icon={<WipIssueTypeIcon size={13} />} mono />
          <MetaItem label={t('wip_issue.label_reference', 'Reference')} value={detail.reference} mono />
        </div>
      </CalloutCard>

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Fieldset>
        <FieldsetLegend>
          <div className="flex items-center gap-2">
            <WipIssueTypeIcon size={18} className="text-accent" />
            {t('wip_issue.detail_section_details', 'WIP Issue Details')}
          </div>
        </FieldsetLegend>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaItem label={t('wip_issue.label_work_order_ref', 'Work Order Ref')} value={detail.workOrderRef} mono />
            <MetaItem label={t('wip_issue.label_reference', 'Reference')} value={detail.reference} mono />
          </div>
          <Separator />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t('wip_issue.form_notes', 'Notes')}
            </p>
            {hasNotes ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">{detail.notes}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">{t('wip_issue.detail_no_notes', 'No notes added')}</p>
            )}
          </div>
        </FieldGroup>
      </Fieldset>

      {/* ── Items table ──────────────────────────────────────────────────── */}
      <TransactionItemsTable items={items} totalQuantity={detail.totalQuantity} messages={itemsTableMessages} />

      {/* ── Audit trail ──────────────────────────────────────────────────── */}
      <AuditTrail
        messages={auditMessages}
        createdBy={detail.createdBy?.name ?? detail.createdBy?.email ?? '—'}
        createdAt={formattedCreated}
        approvedBy={detail.approvedBy?.name ?? detail.approvedBy?.email ?? '—'}
        approvedAt={formattedApproved}
        putawayStatus={detail.dispatchStatus}
        putawayLabel={dispatchLabel}
        putawayColor={dispatchColor}
        approvalHistory={detail.approvalHistory}
      />

      {/* ── Action modal ─────────────────────────────────────────────────── */}
      <ActionModal
        isOpen={actionModal !== null}
        isActing={isActing}
        actionError={actionError}
        kind={actionModal?.kind ?? null}
        message={actionModal?.message ?? ''}
        onMessageChange={(value) => setActionModal((prev) => (prev ? { ...prev, message: value } : prev))}
        onClose={() => {
          setActionModal(null);
          setActionError(null);
        }}
        onConfirm={() => void handleConfirm()}
        messages={actionMessages}
      />
    </section>
  );
}

export { WipIssueDetailPage };
