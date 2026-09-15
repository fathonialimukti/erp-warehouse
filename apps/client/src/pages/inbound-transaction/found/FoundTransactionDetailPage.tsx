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
  FoundTypeIcon,
  LayersIcon,
  PenIcon,
  PutawayIcon,
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

interface FoundItem {
  id: string;
  skuId: string;
  sku: SkuRef;
  quantity: number | { toNumber(): number };
  details?: string | null;
}

interface FoundDetail {
  id: string;
  documentNumber?: string | null;
  date: string | Date;
  foundReason?: string | null;
  foundLocation?: string | null;
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
  items: FoundItem[];
  totalItems: number;
  totalQuantity: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

function FoundTransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const canApprove = hasPermission('found@approve');
  const canUpdate = hasPermission('found@update');
  const canDelete = hasPermission('found@delete');
  const canPutaway = hasPermission('transaction@putaway');

  const t = (k: string, fallback: string) => intl.formatMessage({ id: k, defaultMessage: fallback });

  const { data: rawDetail, isLoading } = useQuery({
    queryKey: ['foundTransactionDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.foundTransaction.detail.query({ id: id! }),
  });

  const detail = rawDetail as FoundDetail | undefined;

  const { actionModal, setActionModal, isActing, actionError, setActionError, handleConfirm } = useTransactionDetailActions({
    resource: 'foundTransaction',
    id,
    detailQueryKey: 'foundTransactionDetail',
    listQueryKey: 'foundTransactionList',
    backPath: '/inbound-transaction',
  });

  if (isLoading) return <DetailSkeleton />;

  if (!detail) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BoxIcon size={32} className="text-muted" />
          <p className="text-sm text-muted">{t('found_transaction.detail_not_found', 'Found transaction not found.')}</p>
          <Button variant="ghost" onPress={() => navigate('/inbound-transaction')}>
            {t('found_transaction.detail_back', 'Back')}
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
  const putawayLabelKey = `found_transaction.detail_putaway_${detail.putawayStatus.toLowerCase()}`;
  const putawayLabel = t(putawayLabelKey, detail.putawayStatus);

  const itemsTableMessages: ItemsTableMessages = {
    sectionTitle: t('found_transaction.detail_section_items', 'Found Items'),
    sectionDesc: t('found_transaction.detail_section_items_desc', 'SKUs and quantities found in this transaction'),
    skuCode: t('found_transaction.detail_col_sku_code', 'SKU Code'),
    skuName: t('found_transaction.detail_col_sku_name', 'SKU Name'),
    qty: t('found_transaction.detail_col_qty', 'Qty'),
    details: t('found_transaction.detail_col_details', 'Details'),
    total: t('found_transaction.detail_total_row', 'Total'),
    empty: t('found_transaction.empty', 'No items.'),
  };

  const auditMessages: AuditTrailMessages = {
    sectionTitle: t('found_transaction.detail_section_audit', 'Audit Trail'),
    sectionDesc: t('found_transaction.detail_section_audit_desc', 'Who created, approved, and when'),
    createdBy: t('found_transaction.detail_label_created_by', 'Created By'),
    createdAt: t('found_transaction.detail_label_created_at', 'Created At'),
    approvedBy: t('found_transaction.detail_label_approved_by', 'Approved By'),
    approvedAt: t('found_transaction.detail_label_approved_at', 'Approved At'),
    putawayStatus: t('found_transaction.detail_label_putaway_status', 'Putaway Status'),
  };

  const actionMessages: ActionModalMessages = {
    processing: t('found_transaction.action_processing', 'Processing…'),
    pleaseWait: t('found_transaction.action_please_wait', 'Please wait…'),
    errorTitle: t('found_transaction.action_error_title', 'Something went wrong'),
    close: t('found_transaction.action_close', 'Close'),
    approveTitle: t('found_transaction.confirm_approve_title', 'Confirm Approve'),
    rejectTitle: t('found_transaction.confirm_reject_title', 'Confirm Reject'),
    deleteTitle: t('found_transaction.delete_modal_title', 'Delete Found Transaction'),
    approveDesc: t('found_transaction.confirm_approve_desc', 'Approve this transaction? This action cannot be undone.'),
    rejectDesc: t('found_transaction.confirm_reject_desc', 'Reject this transaction? This action cannot be undone.'),
    deleteBody: intl.formatMessage(
      { id: 'found_transaction.delete_modal_body', defaultMessage: 'Are you sure you want to delete found transaction {id}?' },
      { id: detail.id },
    ),
    messageLabel: t('found_transaction.approval_message_label', 'Message'),
    messagePlaceholder: t('found_transaction.approval_message_placeholder', 'Add a message (optional)'),
    cancel: t('found_transaction.action_cancel', 'Cancel'),
    approve: t('found_transaction.approve', 'Approve'),
    reject: t('found_transaction.action_reject', 'Reject'),
    deleteConfirm: t('found_transaction.delete_confirm', 'Delete'),
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
        section: 'found-transaction-detail',
        id: detail.id,
        documentNumber: detail.documentNumber,
        approvalStatus: detail.approvalStatus,
        putawayStatus: detail.putawayStatus,
      })}
    >
      <PageHeader
        title={detail.documentNumber ?? detail.id}
        onBack={() => navigate('/inbound-transaction')}
        onEdit={isEditable && canUpdate ? () => navigate(`/inbound-transaction/found/${detail.id}/edit`) : undefined}
        onDelete={isDraft && canDelete ? () => setActionModal({ kind: 'delete', message: '' }) : undefined}
      >
        {isApproved && canPutaway && (
          <Button
            variant="tertiary"
            onPress={() => navigate(`/warehouse/${detail.warehouseId}/layout?inboundTransactionId=${detail.id}`)}
          >
            <PutawayIcon size={16} />
            <span className="hidden md:block">{t('found_transaction.action_putaway', 'Putaway')}</span>
          </Button>
        )}
      </PageHeader>

      {/* ── Hero summary card ─────────────────────────────────────────────── */}
      <HeroSummaryCard
        gradientClass={HERO_GRADIENTS.found}
        title={detail.documentNumber ?? detail.id}
        subtitle={t('found_transaction.detail_subtitle', 'Inventory found on warehouse floor')}
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
                {t('found_transaction.action_approve', 'Approve')}
              </Button>
            )}
            {isProposed && canApprove && (
              <Button variant="danger-soft" onPress={() => setActionModal({ kind: 'reject', message: '' })}>
                <CloseCircleIcon size={16} className="text-danger" />
                {t('found_transaction.action_reject', 'Reject')}
              </Button>
            )}
            {isEditable && canUpdate && (
              <Button variant="ghost" onPress={() => navigate(`/inbound-transaction/found/${detail.id}/edit`)}>
                <PenIcon size={16} />
                {t('found_transaction.action_edit', 'Edit')}
              </Button>
            )}
            {detail.id ? <PrintDocumentButton type="found" transactionId={detail.id} /> : null}
          </>
        }
        metaItems={
          <>
            <MetaItem
              icon={<DocumentIcon size={13} />}
              label={t('found_transaction.detail_hero_document', 'Document')}
              value={detail.documentNumber ?? '—'}
              mono
            />
            <MetaItem
              icon={<BoxIcon size={13} />}
              label={t('found_transaction.detail_hero_warehouse', 'Warehouse')}
              value={detail.warehouse?.name ?? '—'}
            />
            <MetaItem
              icon={<ClipboardIcon size={13} />}
              label={t('found_transaction.detail_hero_date', 'Date')}
              value={formattedDate}
            />
            <MetaItem
              icon={<FoundTypeIcon size={13} />}
              label={t('found_transaction.detail_hero_location', 'Found Location')}
              value={detail.foundLocation ?? '—'}
            />
          </>
        }
      />

      {/* ── KPI metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<LayersIcon size={20} />}
          label={t('found_transaction.detail_kpi_items', 'Total Items')}
          value={detail.totalItems}
          color={approvalColor}
        />
        <KpiCard
          icon={<ScaleIcon size={20} />}
          label={t('found_transaction.detail_kpi_quantity', 'Total Quantity')}
          value={detail.totalQuantity.toLocaleString()}
          color={approvalColor}
        />
        <KpiCard
          icon={<CheckCircleIcon size={20} />}
          label={t('found_transaction.detail_kpi_approval', 'Approval')}
          value={<Chip color={approvalColor} variant="soft" size="sm">{detail.approvalStatus}</Chip>}
        />
        <KpiCard
          icon={<PutawayIcon size={20} />}
          label={t('found_transaction.detail_kpi_putaway', 'Putaway')}
          value={<Chip color={putawayColor} variant="soft" size="sm">{putawayLabel}</Chip>}
        />
      </div>

      {/* ── Discovery callout (domain-specific) ─────────────────────────── */}
      <CalloutCard
        icon={<FoundTypeIcon size={18} />}
        tone="warning"
        title={t('found_transaction.detail_callout_title', 'Unrecorded inventory discovered')}
        description={t('found_transaction.detail_callout_desc', 'This stock was found on the floor and was not part of a receiving or production document.')}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaItem
            label={t('found_transaction.detail_callout_location', 'Found at')}
            value={detail.foundLocation}
            icon={<FoundTypeIcon size={13} />}
          />
          <MetaItem
            label={t('found_transaction.detail_callout_reason', 'Reason')}
            value={detail.foundReason}
          />
        </div>
      </CalloutCard>

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Fieldset>
        <FieldsetLegend>
          <div className="flex items-center gap-2">
            <FoundTypeIcon size={18} className="text-accent" />
            {t('found_transaction.detail_section_details', 'Found Details')}
          </div>
        </FieldsetLegend>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaItem label={t('found_transaction.label_found_reason', 'Found Reason')} value={detail.foundReason} />
            <MetaItem label={t('found_transaction.label_found_location', 'Found Location')} value={detail.foundLocation} />
            <MetaItem label={t('found_transaction.label_reference', 'Reference')} value={detail.reference} mono />
            <MetaItem label={t('found_transaction.label_notes', 'Notes')} value={detail.notes} />
          </div>
          <Separator />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t('found_transaction.form_notes', 'Notes')}
            </p>
            {hasNotes ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">{detail.notes}</p>
            ) : (
              <p className="mt-2 text-sm text-muted">{t('found_transaction.detail_no_notes', 'No notes added')}</p>
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
            sourceValue={detail.foundReason ?? null}
            sourceLabel={t('print.qr.reason', 'Reason')}
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

export { FoundTransactionDetailPage };
