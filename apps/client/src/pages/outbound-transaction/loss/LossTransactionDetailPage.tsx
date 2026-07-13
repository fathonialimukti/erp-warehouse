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
  LossTypeIcon,
  PenIcon,
  ScaleIcon,
} from '../../../assets/IconRegistry';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { PageHeader } from '../../../components/PageHeader';
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

interface LossItem {
  id: string;
  skuId: string;
  sku: SkuRef;
  quantity: number | { toNumber(): number };
  details?: string | null;
}

interface LossDetail {
  id: string;
  documentNumber?: string | null;
  date: string | Date;
  lossReason?: string | null;
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
  items: LossItem[];
  totalItems: number;
  totalQuantity: number;
}

const DISPATCH_COLOR: Record<string, ChipProps['color']> = {
  PENDING: 'default',
  PARTIAL: 'warning',
  COMPLETED: 'success',
};

// ─── Main component ───────────────────────────────────────────────────────────

function LossTransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const canApprove = hasPermission('loss@approve');
  const canUpdate = hasPermission('loss@update');
  const canDelete = hasPermission('loss@delete');

  const t = (k: string, fallback: string) => intl.formatMessage({ id: k, defaultMessage: fallback });

  const { data: rawDetail, isLoading } = useQuery({
    queryKey: ['lossTransactionDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.lossTransaction.detail.query({ id: id! }),
  });

  const detail = rawDetail as LossDetail | undefined;

  const { actionModal, setActionModal, isActing, actionError, setActionError, handleConfirm } = useTransactionDetailActions({
    resource: 'lossTransaction',
    id,
    detailQueryKey: 'lossTransactionDetail',
    listQueryKey: 'lossTransactionList',
    backPath: '/outbound-transaction',
  });

  if (isLoading) return <DetailSkeleton />;

  if (!detail) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BoxIcon size={32} className="text-muted" />
          <p className="text-sm text-muted">{t('loss.detail_not_found', 'Loss transaction not found.')}</p>
          <Button variant="ghost" onPress={() => navigate('/outbound-transaction')}>
            {t('loss.detail_back', 'Back')}
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
  const dispatchLabelKey = `loss.detail_dispatch_${detail.dispatchStatus.toLowerCase()}`;
  const dispatchLabel = t(dispatchLabelKey, detail.dispatchStatus);

  const itemsTableMessages: ItemsTableMessages = {
    sectionTitle: t('loss.detail_section_items', 'Loss Items'),
    sectionDesc: t('loss.detail_section_items_desc', 'SKUs and quantities recorded as lost in this transaction'),
    skuCode: t('loss.detail_col_sku_code', 'SKU Code'),
    skuName: t('loss.detail_col_sku_name', 'SKU Name'),
    qty: t('loss.detail_col_qty', 'Qty'),
    details: t('loss.detail_col_details', 'Details'),
    total: t('loss.detail_total_row', 'Total'),
    empty: t('loss.empty', 'No items.'),
  };

  const auditMessages: AuditTrailMessages = {
    sectionTitle: t('loss.detail_section_audit', 'Audit Trail'),
    sectionDesc: t('loss.detail_section_audit_desc', 'Who created, approved, and when'),
    createdBy: t('loss.detail_label_created_by', 'Created By'),
    createdAt: t('loss.detail_label_created_at', 'Created At'),
    approvedBy: t('loss.detail_label_approved_by', 'Approved By'),
    approvedAt: t('loss.detail_label_approved_at', 'Approved At'),
    putawayStatus: t('loss.detail_label_dispatch_status', 'Dispatch Status'),
  };

  const actionMessages: ActionModalMessages = {
    processing: t('loss.action_processing', 'Processing…'),
    pleaseWait: t('loss.action_please_wait', 'Please wait…'),
    errorTitle: t('loss.action_error_title', 'Something went wrong'),
    close: t('loss.action_close', 'Close'),
    approveTitle: t('loss.confirm_approve_title', 'Confirm Approve'),
    rejectTitle: t('loss.confirm_reject_title', 'Confirm Reject'),
    deleteTitle: t('loss.delete_modal_title', 'Delete Loss Transaction'),
    approveDesc: t('loss.confirm_approve_desc', 'Approve this loss transaction? This action cannot be undone.'),
    rejectDesc: t('loss.confirm_reject_desc', 'Reject this loss transaction? This action cannot be undone.'),
    deleteBody: intl.formatMessage(
      { id: 'loss.delete_modal_body', defaultMessage: 'Are you sure you want to delete loss transaction {id}?' },
      { id: detail.id },
    ),
    messageLabel: t('loss.approval_message_label', 'Message'),
    messagePlaceholder: t('loss.approval_message_placeholder', 'Add a message (optional)'),
    cancel: t('loss.action_cancel', 'Cancel'),
    approve: t('loss.action_approve', 'Approve'),
    reject: t('loss.action_reject', 'Reject'),
    deleteConfirm: t('loss.delete_confirm', 'Delete'),
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
        section: 'loss-transaction-detail',
        id: detail.id,
        documentNumber: detail.documentNumber,
        approvalStatus: detail.approvalStatus,
        dispatchStatus: detail.dispatchStatus,
      })}
    >
      <PageHeader
        title={detail.documentNumber ?? detail.id}
        onBack={() => navigate('/outbound-transaction')}
        onEdit={isEditable && canUpdate ? () => navigate(`/outbound-transaction/loss/${detail.id}/edit`) : undefined}
        onDelete={isDraft && canDelete ? () => setActionModal({ kind: 'delete', message: '' }) : undefined}
      />

      {/* ── Hero summary card ─────────────────────────────────────────────── */}
      <HeroSummaryCard
        gradientClass={HERO_GRADIENTS.loss}
        title={detail.documentNumber ?? detail.id}
        subtitle={t('loss.detail_subtitle', 'Inventory recorded as lost or unaccounted')}
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
                {t('loss.action_approve', 'Approve')}
              </Button>
            )}
            {isProposed && canApprove && (
              <Button variant="danger-soft" onPress={() => setActionModal({ kind: 'reject', message: '' })}>
                <CloseCircleIcon size={16} className="text-danger" />
                {t('loss.action_reject', 'Reject')}
              </Button>
            )}
            {isEditable && canUpdate && (
              <Button variant="ghost" onPress={() => navigate(`/outbound-transaction/loss/${detail.id}/edit`)}>
                <PenIcon size={16} />
                {t('loss.action_edit', 'Edit')}
              </Button>
            )}
          </>
        }
        metaItems={
          <>
            <MetaItem
              icon={<DocumentIcon size={13} />}
              label={t('loss.detail_hero_document', 'Document')}
              value={detail.documentNumber ?? '—'}
              mono
            />
            <MetaItem
              icon={<BoxIcon size={13} />}
              label={t('loss.detail_hero_warehouse', 'Warehouse')}
              value={detail.warehouse?.name ?? '—'}
            />
            <MetaItem
              icon={<ClipboardIcon size={13} />}
              label={t('loss.detail_hero_date', 'Date')}
              value={formattedDate}
            />
            <MetaItem
              icon={<LossTypeIcon size={13} />}
              label={t('loss.detail_hero_reason', 'Reason')}
              value={detail.lossReason}
            />
          </>
        }
      />

      {/* ── KPI metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<LayersIcon size={20} />}
          label={t('loss.detail_kpi_items', 'Total Items')}
          value={detail.totalItems}
          color={approvalColor}
        />
        <KpiCard
          icon={<ScaleIcon size={20} />}
          label={t('loss.detail_kpi_quantity', 'Total Quantity')}
          value={detail.totalQuantity.toLocaleString()}
          color={approvalColor}
        />
        <KpiCard
          icon={<CheckCircleIcon size={20} />}
          label={t('loss.detail_kpi_approval', 'Approval')}
          value={<Chip color={approvalColor} variant="soft" size="sm">{detail.approvalStatus}</Chip>}
        />
        <KpiCard
          icon={<LossTypeIcon size={20} />}
          label={t('loss.detail_kpi_dispatch', 'Dispatch')}
          value={<Chip color={dispatchColor} variant="soft" size="sm">{dispatchLabel}</Chip>}
        />
      </div>

      {/* ── Loss callout (domain-specific) ─────────────────────────────── */}
      <CalloutCard
        icon={<LossTypeIcon size={18} />}
        tone="default"
        title={t('loss.detail_callout_title', 'Recorded as lost')}
        description={t('loss.detail_callout_desc', 'These goods are missing or unaccounted for and reduce warehouse stock once approved.')}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaItem label={t('loss.label_loss_reason', 'Loss Reason')} value={detail.lossReason} icon={<LossTypeIcon size={13} />} />
          <MetaItem label={t('loss.label_reference', 'Reference')} value={detail.reference} mono />
        </div>
      </CalloutCard>

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Fieldset>
        <FieldsetLegend>
          <div className="flex items-center gap-2">
            <LossTypeIcon size={18} className="text-accent" />
            {t('loss.detail_section_details', 'Loss Details')}
          </div>
        </FieldsetLegend>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaItem label={t('loss.label_loss_reason', 'Loss Reason')} value={detail.lossReason} />
            <MetaItem label={t('loss.label_reference', 'Reference')} value={detail.reference} mono />
          </div>
          <Separator />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t('loss.form_notes', 'Notes')}
            </p>
            {hasNotes ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">{detail.notes}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">{t('loss.detail_no_notes', 'No notes added')}</p>
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

export { LossTransactionDetailPage };
