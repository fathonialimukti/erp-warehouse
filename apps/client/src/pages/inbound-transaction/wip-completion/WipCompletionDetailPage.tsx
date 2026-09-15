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
  PutawayIcon,
  ScaleIcon,
  WipCompletionTypeIcon,
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
  PUTAWAY_COLOR,
  resolveStatusColor,
  TransactionItemsTable,
  useTransactionDetailActions,
  type ActionModalMessages,
  type AuditTrailMessages,
  type DetailItemRow,
  type ItemsTableMessages,
} from '../_detail-shared';
import { ItemQrPrintButton } from '../_ItemQrPrintButton';

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

interface WipItem {
  id: string;
  skuId: string;
  sku: SkuRef;
  quantity: number | { toNumber(): number };
  details?: string | null;
}

interface WipDetail {
  id: string;
  documentNumber?: string | null;
  date: string | Date;
  workOrderRef?: string | null;
  productionBatchNo?: string | null;
  reference?: string | null;
  notes?: string | null;
  warehouseId: string;
  warehouse: WarehouseRef;
  approvalStatus: string;
  putawayStatus: string;
  approvalHistory?: unknown;
  createdById: string;
  createdBy: UserRef;
  approvedById?: string | null;
  approvedBy?: UserRef | null;
  approvedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  items: WipItem[];
  totalItems: number;
  totalQuantity: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

function WipCompletionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const canApprove = hasPermission('wip-completion@approve');
  const canUpdate = hasPermission('wip-completion@update');
  const canDelete = hasPermission('wip-completion@delete');
  const canPutaway = hasPermission('transaction@putaway');

  const t = (k: string, fallback: string) => intl.formatMessage({ id: k, defaultMessage: fallback });

  const { data: rawDetail, isLoading } = useQuery({
    queryKey: ['wipCompletionDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.wipCompletion.detail.query({ id: id! }),
  });

  const detail = rawDetail as WipDetail | undefined;

  const { actionModal, setActionModal, isActing, actionError, setActionError, handleConfirm } = useTransactionDetailActions({
    resource: 'wipCompletion',
    id,
    detailQueryKey: 'wipCompletionDetail',
    listQueryKey: 'wipCompletionList',
    backPath: '/inbound-transaction',
  });

  if (isLoading) return <DetailSkeleton />;

  if (!detail) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BoxIcon size={32} className="text-muted" />
          <p className="text-sm text-muted">{t('wip_completion.detail_not_found', 'WIP completion transaction not found.')}</p>
          <Button variant="ghost" onPress={() => navigate('/inbound-transaction')}>
            {t('wip_completion.detail_back', 'Back')}
          </Button>
        </div>
      </section>
    );
  }

  const approvalColor = resolveStatusColor(
    { DRAFT: 'default', PROPOSED: 'warning', APPROVED: 'success', REJECTED: 'danger' },
    detail.approvalStatus,
  ) as ChipProps['color'];
  const putawayColor = resolveStatusColor(PUTAWAY_COLOR, detail.putawayStatus);
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
  const putawayLabelKey = `wip_completion.detail_putaway_${detail.putawayStatus.toLowerCase()}`;
  const putawayLabel = t(putawayLabelKey, detail.putawayStatus);

  const itemsTableMessages: ItemsTableMessages = {
    sectionTitle: t('wip_completion.detail_section_items', 'Completed Items'),
    sectionDesc: t('wip_completion.detail_section_items_desc', 'SKUs and quantities completed in this transaction'),
    skuCode: t('wip_completion.detail_col_sku_code', 'SKU Code'),
    skuName: t('wip_completion.detail_col_sku_name', 'SKU Name'),
    qty: t('wip_completion.detail_col_qty', 'Qty'),
    details: t('wip_completion.detail_col_details', 'Details'),
    total: t('wip_completion.detail_total_row', 'Total'),
    empty: t('wip_completion.empty', 'No items.'),
  };

  const auditMessages: AuditTrailMessages = {
    sectionTitle: t('wip_completion.detail_section_audit', 'Audit Trail'),
    sectionDesc: t('wip_completion.detail_section_audit_desc', 'Who created, approved, and when'),
    createdBy: t('wip_completion.detail_label_created_by', 'Created By'),
    createdAt: t('wip_completion.detail_label_created_at', 'Created At'),
    approvedBy: t('wip_completion.detail_label_approved_by', 'Approved By'),
    approvedAt: t('wip_completion.detail_label_approved_at', 'Approved At'),
    putawayStatus: t('wip_completion.detail_label_putaway_status', 'Putaway Status'),
  };

  const actionMessages: ActionModalMessages = {
    processing: t('wip_completion.action_processing', 'Processing…'),
    pleaseWait: t('wip_completion.action_please_wait', 'Please wait…'),
    errorTitle: t('wip_completion.action_error_title', 'Something went wrong'),
    close: t('wip_completion.action_close', 'Close'),
    approveTitle: t('wip_completion.confirm_approve_title', 'Confirm Approve'),
    rejectTitle: t('wip_completion.confirm_reject_title', 'Confirm Reject'),
    deleteTitle: t('wip_completion.delete_modal_title', 'Delete WIP Completion'),
    approveDesc: t('wip_completion.confirm_approve_desc', 'Approve this transaction? This action cannot be undone.'),
    rejectDesc: t('wip_completion.confirm_reject_desc', 'Reject this transaction? This action cannot be undone.'),
    deleteBody: intl.formatMessage(
      { id: 'wip_completion.delete_modal_body', defaultMessage: 'Are you sure you want to delete WIP completion {id}?' },
      { id: detail.id },
    ),
    messageLabel: t('wip_completion.approval_message_label', 'Message'),
    messagePlaceholder: t('wip_completion.approval_message_placeholder', 'Add a message (optional)'),
    cancel: t('wip_completion.action_cancel', 'Cancel'),
    approve: t('wip_completion.approve', 'Approve'),
    reject: t('wip_completion.action_reject', 'Reject'),
    deleteConfirm: t('wip_completion.delete_confirm', 'Delete'),
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
        section: 'wip-completion-detail',
        id: detail.id,
        documentNumber: detail.documentNumber,
        approvalStatus: detail.approvalStatus,
        putawayStatus: detail.putawayStatus,
      })}
    >
      <PageHeader
        title={detail.documentNumber ?? detail.id}
        onBack={() => navigate('/inbound-transaction')}
        onEdit={isEditable && canUpdate ? () => navigate(`/inbound-transaction/wip-completion/${detail.id}/edit`) : undefined}
        onDelete={isDraft && canDelete ? () => setActionModal({ kind: 'delete', message: '' }) : undefined}
      >
        {isApproved && canPutaway && (
          <Button
            variant="tertiary"
            onPress={() => navigate(`/warehouse/${detail.warehouseId}/layout?inboundTransactionId=${detail.id}`)}
          >
            <PutawayIcon size={16} />
            <span className="hidden md:block">{t('wip_completion.action_putaway', 'Putaway')}</span>
          </Button>
        )}
      </PageHeader>

      {/* ── Hero summary card ─────────────────────────────────────────────── */}
      <HeroSummaryCard
        gradientClass={HERO_GRADIENTS.wipCompletion}
        title={detail.documentNumber ?? detail.id}
        subtitle={t('wip_completion.detail_subtitle', 'Finished goods from production')}
        statusChips={
          <>
            <Chip color={approvalColor} variant="soft" size="sm">
              {detail.approvalStatus}
            </Chip>
            {isApproved && <Chip color={putawayColor} variant="soft" size="sm">{putawayLabel}</Chip>}
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
                {t('wip_completion.action_approve', 'Approve')}
              </Button>
            )}
            {isProposed && canApprove && (
              <Button variant="danger-soft" onPress={() => setActionModal({ kind: 'reject', message: '' })}>
                <CloseCircleIcon size={16} className="text-danger" />
                {t('wip_completion.action_reject', 'Reject')}
              </Button>
            )}
            {isEditable && canUpdate && (
              <Button variant="ghost" onPress={() => navigate(`/inbound-transaction/wip-completion/${detail.id}/edit`)}>
                <PenIcon size={16} />
                {t('wip_completion.action_edit', 'Edit')}
              </Button>
            )}
            {detail.id ? <PrintDocumentButton type="wip-completion" transactionId={detail.id} /> : null}
          </>
        }
        metaItems={
          <>
            <MetaItem
              icon={<DocumentIcon size={13} />}
              label={t('wip_completion.detail_hero_document', 'Document')}
              value={detail.documentNumber ?? '—'}
              mono
            />
            <MetaItem
              icon={<BoxIcon size={13} />}
              label={t('wip_completion.detail_hero_warehouse', 'Warehouse')}
              value={detail.warehouse?.name ?? '—'}
            />
            <MetaItem
              icon={<ClipboardIcon size={13} />}
              label={t('wip_completion.detail_hero_date', 'Date')}
              value={formattedDate}
            />
            <MetaItem
              icon={<WipCompletionTypeIcon size={13} />}
              label={t('wip_completion.detail_hero_work_order', 'Work Order Ref')}
              value={detail.workOrderRef ?? '—'}
              mono
            />
          </>
        }
      />

      {/* ── KPI metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<LayersIcon size={20} />}
          label={t('wip_completion.detail_kpi_items', 'Total Items')}
          value={detail.totalItems}
          color={approvalColor}
        />
        <KpiCard
          icon={<ScaleIcon size={20} />}
          label={t('wip_completion.detail_kpi_quantity', 'Total Quantity')}
          value={detail.totalQuantity.toLocaleString()}
          color={approvalColor}
        />
        <KpiCard
          icon={<CheckCircleIcon size={20} />}
          label={t('wip_completion.detail_kpi_approval', 'Approval')}
          value={<Chip color={approvalColor} variant="soft" size="sm">{detail.approvalStatus}</Chip>}
        />
        <KpiCard
          icon={<PutawayIcon size={20} />}
          label={t('wip_completion.detail_kpi_putaway', 'Putaway')}
          value={<Chip color={putawayColor} variant="soft" size="sm">{putawayLabel}</Chip>}
        />
      </div>

      {/* ── Production run callout (domain-specific) ────────────────────── */}
      <CalloutCard
        icon={<WipCompletionTypeIcon size={18} />}
        tone="success"
        title={t('wip_completion.detail_callout_title', 'Production output')}
        description={t('wip_completion.detail_callout_desc', 'Finished goods completed from a work order, ready to be put away as available stock.')}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaItem
            label={t('wip_completion.detail_callout_work_order', 'Work Order')}
            value={detail.workOrderRef}
            mono
          />
          <MetaItem
            label={t('wip_completion.detail_callout_batch', 'Batch')}
            value={detail.productionBatchNo}
            mono
          />
        </div>
      </CalloutCard>

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Fieldset>
        <FieldsetLegend>
          <div className="flex items-center gap-2">
            <WipCompletionTypeIcon size={18} className="text-accent" />
            {t('wip_completion.detail_section_details', 'Production Details')}
          </div>
        </FieldsetLegend>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaItem label={t('wip_completion.label_work_order_ref', 'Work Order Ref')} value={detail.workOrderRef} mono />
            <MetaItem label={t('wip_completion.label_production_batch_no', 'Production Batch No')} value={detail.productionBatchNo} mono />
            <MetaItem label={t('wip_completion.label_reference', 'Reference')} value={detail.reference} mono />
            <MetaItem label={t('wip_completion.label_notes', 'Notes')} value={detail.notes} />
          </div>
          <Separator />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t('wip_completion.form_notes', 'Notes')}
            </p>
            {hasNotes ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">{detail.notes}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">{t('wip_completion.detail_no_notes', 'No notes added')}</p>
            )}
          </div>
        </FieldGroup>
      </Fieldset>

      {/* ── Items table ──────────────────────────────────────────────────── */}
      <TransactionItemsTable
        items={items}
        totalQuantity={detail.totalQuantity}
        messages={itemsTableMessages}
        actions={
          <ItemQrPrintButton
            items={detail.items.map((item) => ({
              id: item.id,
              skuName: item.sku?.name ?? '—',
              skuCode: item.sku?.code ?? '—',
            }))}
            receivedDate={formattedDate}
            sourceValue={detail.workOrderRef ?? null}
            sourceLabel={t('print.qr.work_order', 'Work Order')}
            fileName={`${detail.documentNumber ?? detail.id}-qr-labels`}
          />
        }
      />

      {/* ── Audit trail ──────────────────────────────────────────────────── */}
      <AuditTrail
        messages={auditMessages}
        createdBy={detail.createdBy?.name ?? detail.createdBy?.email ?? '—'}
        createdAt={formattedCreated}
        approvedBy={detail.approvedBy?.name ?? detail.approvedBy?.email ?? '—'}
        approvedAt={formattedApproved}
        putawayStatus={detail.putawayStatus}
        putawayLabel={putawayLabel}
        putawayColor={putawayColor}
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

export { WipCompletionDetailPage };
