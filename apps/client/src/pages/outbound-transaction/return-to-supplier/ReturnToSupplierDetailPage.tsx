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
  ReturnToSupplierTypeIcon,
  ScaleIcon,
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

interface SupplierRef {
  id: string;
  name: string;
  code?: string | null;
}

interface ReturnToSupplierItem {
  id: string;
  skuId: string;
  sku: SkuRef;
  quantity: number | { toNumber(): number };
  details?: string | null;
}

interface ReturnToSupplierDetail {
  id: string;
  documentNumber?: string | null;
  date: string | Date;
  supplierId: string;
  supplier: SupplierRef;
  originalReceivingId?: string | null;
  returnReason?: string | null;
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
  items: ReturnToSupplierItem[];
  totalItems: number;
  totalQuantity: number;
}

const DISPATCH_COLOR: Record<string, ChipProps['color']> = {
  PENDING: 'default',
  PARTIAL: 'warning',
  COMPLETED: 'success',
};

// ─── Main component ───────────────────────────────────────────────────────────

function ReturnToSupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const canApprove = hasPermission('return-to-supplier@approve');
  const canUpdate = hasPermission('return-to-supplier@update');
  const canDelete = hasPermission('return-to-supplier@delete');

  const t = (k: string, fallback: string) => intl.formatMessage({ id: k, defaultMessage: fallback });

  const { data: rawDetail, isLoading } = useQuery({
    queryKey: ['returnToSupplierDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.returnToSupplier.detail.query({ id: id! }),
  });

  const detail = rawDetail as ReturnToSupplierDetail | undefined;

  const { actionModal, setActionModal, isActing, actionError, setActionError, handleConfirm } = useTransactionDetailActions({
    resource: 'returnToSupplier',
    id,
    detailQueryKey: 'returnToSupplierDetail',
    listQueryKey: 'returnToSupplierList',
    backPath: '/outbound-transaction',
  });

  if (isLoading) return <DetailSkeleton />;

  if (!detail) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BoxIcon size={32} className="text-muted" />
          <p className="text-sm text-muted">{t('return_to_supplier.detail_not_found', 'Return to supplier not found.')}</p>
          <Button variant="ghost" onPress={() => navigate('/outbound-transaction')}>
            {t('return_to_supplier.detail_back', 'Back')}
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
  const dispatchLabelKey = `return_to_supplier.detail_dispatch_${detail.dispatchStatus.toLowerCase()}`;
  const dispatchLabel = t(dispatchLabelKey, detail.dispatchStatus);

  const itemsTableMessages: ItemsTableMessages = {
    sectionTitle: t('return_to_supplier.detail_section_items', 'Return Items'),
    sectionDesc: t('return_to_supplier.detail_section_items_desc', 'SKUs and quantities returned to the supplier'),
    skuCode: t('return_to_supplier.detail_col_sku_code', 'SKU Code'),
    skuName: t('return_to_supplier.detail_col_sku_name', 'SKU Name'),
    qty: t('return_to_supplier.detail_col_qty', 'Qty'),
    details: t('return_to_supplier.detail_col_details', 'Details'),
    total: t('return_to_supplier.detail_total_row', 'Total'),
    empty: t('return_to_supplier.empty', 'No items.'),
  };

  const auditMessages: AuditTrailMessages = {
    sectionTitle: t('return_to_supplier.detail_section_audit', 'Audit Trail'),
    sectionDesc: t('return_to_supplier.detail_section_audit_desc', 'Who created, approved, and when'),
    createdBy: t('return_to_supplier.detail_label_created_by', 'Created By'),
    createdAt: t('return_to_supplier.detail_label_created_at', 'Created At'),
    approvedBy: t('return_to_supplier.detail_label_approved_by', 'Approved By'),
    approvedAt: t('return_to_supplier.detail_label_approved_at', 'Approved At'),
    putawayStatus: t('return_to_supplier.detail_label_dispatch_status', 'Dispatch Status'),
  };

  const actionMessages: ActionModalMessages = {
    processing: t('return_to_supplier.action_processing', 'Processing…'),
    pleaseWait: t('return_to_supplier.action_please_wait', 'Please wait…'),
    errorTitle: t('return_to_supplier.action_error_title', 'Something went wrong'),
    close: t('return_to_supplier.action_close', 'Close'),
    approveTitle: t('return_to_supplier.confirm_approve_title', 'Confirm Approve'),
    rejectTitle: t('return_to_supplier.confirm_reject_title', 'Confirm Reject'),
    deleteTitle: t('return_to_supplier.delete_modal_title', 'Delete Return to Supplier'),
    approveDesc: t('return_to_supplier.confirm_approve_desc', 'Approve this return? This action cannot be undone.'),
    rejectDesc: t('return_to_supplier.confirm_reject_desc', 'Reject this return? This action cannot be undone.'),
    deleteBody: intl.formatMessage(
      { id: 'return_to_supplier.delete_modal_body', defaultMessage: 'Are you sure you want to delete return to supplier {id}?' },
      { id: detail.id },
    ),
    messageLabel: t('return_to_supplier.approval_message_label', 'Message'),
    messagePlaceholder: t('return_to_supplier.approval_message_placeholder', 'Add a message (optional)'),
    cancel: t('return_to_supplier.action_cancel', 'Cancel'),
    approve: t('return_to_supplier.action_approve', 'Approve'),
    reject: t('return_to_supplier.action_reject', 'Reject'),
    deleteConfirm: t('return_to_supplier.delete_confirm', 'Delete'),
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
        section: 'return-to-supplier-detail',
        id: detail.id,
        documentNumber: detail.documentNumber,
        supplier: detail.supplier?.name,
        approvalStatus: detail.approvalStatus,
        dispatchStatus: detail.dispatchStatus,
      })}
    >
      <PageHeader
        title={detail.documentNumber ?? detail.id}
        onBack={() => navigate('/outbound-transaction')}
        onEdit={isEditable && canUpdate ? () => navigate(`/outbound-transaction/return-to-supplier/${detail.id}/edit`) : undefined}
        onDelete={isDraft && canDelete ? () => setActionModal({ kind: 'delete', message: '' }) : undefined}
      />

      {/* ── Hero summary card ─────────────────────────────────────────────── */}
      <HeroSummaryCard
        gradientClass={HERO_GRADIENTS.returnToSupplier}
        title={detail.documentNumber ?? detail.id}
        subtitle={t('return_to_supplier.detail_subtitle', 'Goods returned to a supplier')}
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
                {t('return_to_supplier.action_approve', 'Approve')}
              </Button>
            )}
            {isProposed && canApprove && (
              <Button variant="danger-soft" onPress={() => setActionModal({ kind: 'reject', message: '' })}>
                <CloseCircleIcon size={16} className="text-danger" />
                {t('return_to_supplier.action_reject', 'Reject')}
              </Button>
            )}
            {isEditable && canUpdate && (
              <Button variant="ghost" onPress={() => navigate(`/outbound-transaction/return-to-supplier/${detail.id}/edit`)}>
                <PenIcon size={16} />
                {t('return_to_supplier.action_edit', 'Edit')}
              </Button>
            )}
            {detail.id ? <PrintDocumentButton type="return-to-supplier" transactionId={detail.id} /> : null}
          </>
        }
        metaItems={
          <>
            <MetaItem
              icon={<DocumentIcon size={13} />}
              label={t('return_to_supplier.detail_hero_document', 'Document')}
              value={detail.documentNumber ?? '—'}
              mono
            />
            <MetaItem
              icon={<BoxIcon size={13} />}
              label={t('return_to_supplier.detail_hero_warehouse', 'Warehouse')}
              value={detail.warehouse?.name ?? '—'}
            />
            <MetaItem
              icon={<ClipboardIcon size={13} />}
              label={t('return_to_supplier.detail_hero_date', 'Date')}
              value={formattedDate}
            />
            <MetaItem
              icon={<ReturnToSupplierTypeIcon size={13} />}
              label={t('return_to_supplier.detail_hero_supplier', 'Supplier')}
              value={detail.supplier?.name}
            />
          </>
        }
      />

      {/* ── KPI metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<LayersIcon size={20} />}
          label={t('return_to_supplier.detail_kpi_items', 'Total Items')}
          value={detail.totalItems}
          color={approvalColor}
        />
        <KpiCard
          icon={<ScaleIcon size={20} />}
          label={t('return_to_supplier.detail_kpi_quantity', 'Total Quantity')}
          value={detail.totalQuantity.toLocaleString()}
          color={approvalColor}
        />
        <KpiCard
          icon={<CheckCircleIcon size={20} />}
          label={t('return_to_supplier.detail_kpi_approval', 'Approval')}
          value={<Chip color={approvalColor} variant="soft" size="sm">{detail.approvalStatus}</Chip>}
        />
        <KpiCard
          icon={<ReturnToSupplierTypeIcon size={20} />}
          label={t('return_to_supplier.detail_kpi_dispatch', 'Dispatch')}
          value={<Chip color={dispatchColor} variant="soft" size="sm">{dispatchLabel}</Chip>}
        />
      </div>

      {/* ── Return callout (domain-specific) ───────────────────────────── */}
      <CalloutCard
        icon={<ReturnToSupplierTypeIcon size={18} />}
        tone="accent"
        title={t('return_to_supplier.detail_callout_title', 'Returned to supplier')}
        description={t('return_to_supplier.detail_callout_desc', 'These goods leave the warehouse and are sent back to the originating supplier.')}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaItem label={t('return_to_supplier.label_supplier', 'Supplier')} value={detail.supplier?.name} icon={<ReturnToSupplierTypeIcon size={13} />} />
          <MetaItem label={t('return_to_supplier.label_return_reason', 'Return Reason')} value={detail.returnReason} />
          <MetaItem label={t('return_to_supplier.label_original_receiving_id', 'Original Receiving ID')} value={detail.originalReceivingId} mono />
          <MetaItem label={t('return_to_supplier.label_reference', 'Reference')} value={detail.reference} mono />
        </div>
      </CalloutCard>

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Fieldset>
        <FieldsetLegend>
          <div className="flex items-center gap-2">
            <ReturnToSupplierTypeIcon size={18} className="text-accent" />
            {t('return_to_supplier.detail_section_details', 'Return Details')}
          </div>
        </FieldsetLegend>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaItem label={t('return_to_supplier.label_supplier', 'Supplier')} value={detail.supplier?.name} />
            <MetaItem label={t('return_to_supplier.label_return_reason', 'Return Reason')} value={detail.returnReason} />
            <MetaItem label={t('return_to_supplier.label_original_receiving_id', 'Original Receiving ID')} value={detail.originalReceivingId} mono />
            <MetaItem label={t('return_to_supplier.label_reference', 'Reference')} value={detail.reference} mono />
          </div>
          <Separator />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t('return_to_supplier.form_notes', 'Notes')}
            </p>
            {hasNotes ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">{detail.notes}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">{t('return_to_supplier.detail_no_notes', 'No notes added')}</p>
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

export { ReturnToSupplierDetailPage };
