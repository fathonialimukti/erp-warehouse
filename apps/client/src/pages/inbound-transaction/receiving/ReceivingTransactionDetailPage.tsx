import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { useIntl } from 'react-intl';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Chip } from '@heroui/react';
import type { ChipProps } from '@heroui/react';
import {
  Button,
  Card,
  FieldGroup,
  Fieldset,
  FieldsetLegend,
  Label,
  Modal,
  Separator,
  Skeleton,
  Table,
  TextArea,
  TextField,
} from '@heroui/react';
import {
  BoxIcon,
  CheckCircleIcon,
  ClipboardIcon,
  CloseCircleIcon,
  DocumentIcon,
  EyeIcon,
  LayersIcon,
  NotesIcon,
  PaperclipIcon,
  PenIcon,
  PutawayIcon,
  ScaleIcon,
  SpinnerIcon,
  TrashIcon,
  TruckIcon,
} from '../../../assets/IconRegistry';
import { trpcClient } from '../../../lib/trpc';
import { hasPermissionAtom } from '../../../lib/atoms';
import { PageHeader } from '../../../components/PageHeader';
import { PrintDocumentButton } from '../../../components/PrintDocumentButton';
import { ApprovalHistory } from '../../../components/ApprovalHistory';
import { ItemQrPrintButton } from '../_ItemQrPrintButton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SkuRef {
  id: string;
  code?: string | null;
  name: string;
  baseUnit?: string | null;
}

interface ReceivingItem {
  id: string;
  skuId: string;
  sku: SkuRef;
  quantity: number | { toNumber(): number };
  details?: string | null;
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

interface Attachment {
  name: string;
  type?: string | null;
  size?: number | null;
  url?: string | null;
  storedName?: string | null;
}

interface ReceivingDetail {
  id: string;
  documentNumber?: string | null;
  date: string | Date;
  supplierId: string;
  supplier: SupplierRef;
  warehouseId: string;
  warehouse: WarehouseRef;
  purchaseOrderRef?: string | null;
  deliveryNoteRef?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  driverName?: string | null;
  driverContact?: string | null;
  vehiclePlate?: string | null;
  files?: Attachment[] | null;
  notes?: string | null;
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
  items: ReceivingItem[];
  totalItems: number;
  totalQuantity: number;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const APPROVAL_COLOR: Record<string, ChipProps['color']> = {
  DRAFT: 'default',
  PROPOSED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const PUTAWAY_COLOR: Record<string, ChipProps['color']> = {
  PENDING: 'default',
  PARTIAL: 'warning',
  COMPLETED: 'success',
};

const resolveColor = (map: Record<string, ChipProps['color']>, status: string): ChipProps['color'] =>
  map[status] ?? 'default';

const numQty = (q: ReceivingItem['quantity']): number =>
  typeof q === 'number' ? q : typeof q === 'object' && q && typeof q.toNumber === 'function' ? q.toNumber() : Number(q) || 0;

// ─── Small presentational helpers ─────────────────────────────────────────────

const MetaItem = ({ icon, label, value, mono }: { icon?: React.ReactNode; label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex flex-col gap-1">
    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
      {icon}
      {label}
    </span>
    <span className={mono ? 'font-mono text-sm text-foreground' : 'text-sm text-foreground'}>{value ?? '—'}</span>
  </div>
);

const KpiCard = ({
  icon,
  label,
  value,
  hint,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  color?: ChipProps['color'];
}) => (
  <Card variant="secondary" className="overflow-hidden">
    <Card.Content className="flex items-center gap-4 p-4">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${color ? `text-${color} bg-${color}/10` : 'bg-accent/10 text-accent'}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="mt-0.5 text-xl font-semibold text-foreground">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
    </Card.Content>
  </Card>
);

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const DetailSkeleton = () => (
  <section className="space-y-6">
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-9 w-40 rounded-lg" />
    </div>
    <Card className="overflow-hidden">
      <Card.Content className="space-y-4 p-6">
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="h-4 w-72 rounded" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </Card.Content>
    </Card>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
    </div>
    <Skeleton className="h-80 rounded-2xl" />
  </section>
);

// ─── Main component ───────────────────────────────────────────────────────────

function ReceivingTransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const canApprove = hasPermission('receiving@approve');
  const canUpdate = hasPermission('receiving@update');
  const canDelete = hasPermission('receiving@delete');
  const canPutaway = hasPermission('receiving@putaway');

  const [actionModal, setActionModal] = useState<{ kind: 'approve' | 'reject' | 'delete'; message: string } | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const t = (k: string, fallback: string) => intl.formatMessage({ id: k, defaultMessage: fallback });

  const { data: rawDetail, isLoading } = useQuery({
    queryKey: ['receivingTransactionDetail', id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.receivingTransaction.detail.query({ id: id! }),
  });

  const detail = rawDetail as ReceivingDetail | undefined;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['receivingTransactionDetail', id] });
    queryClient.invalidateQueries({ queryKey: ['receivingTransactionList'] });
  };

  const approveMutation = useMutation({
    mutationFn: (input: { id: string; message?: string }) => trpcClient.receivingTransaction.approve.mutate(input),
    onSuccess: () => { invalidateAll(); setActionModal(null); },
    onError: (e: Error) => setActionError(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: (input: { id: string; message?: string }) => trpcClient.receivingTransaction.reject.mutate(input),
    onSuccess: () => { invalidateAll(); setActionModal(null); },
    onError: (e: Error) => setActionError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (input: { id: string }) => trpcClient.receivingTransaction.delete.mutate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receivingTransactionList'] });
      queryClient.removeQueries({ queryKey: ['receivingTransactionDetail', id] });
      navigate('/inbound-transaction');
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const handleConfirm = async () => {
    if (!actionModal || !id) return;
    setIsActing(true);
    setActionError(null);
    try {
      if (actionModal.kind === 'approve') await approveMutation.mutateAsync({ id, message: actionModal.message || undefined });
      if (actionModal.kind === 'reject') await rejectMutation.mutateAsync({ id, message: actionModal.message || undefined });
      if (actionModal.kind === 'delete') await deleteMutation.mutateAsync({ id });
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) return <DetailSkeleton />;

  if (!detail) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BoxIcon size={32} className="text-muted" />
          <p className="text-sm text-muted">{t('receiving_transaction.detail_not_found', 'Receiving transaction not found.')}</p>
          <Button variant="ghost" onPress={() => navigate('/inbound-transaction')}>
            {t('receiving_transaction.detail_back', 'Back')}
          </Button>
        </div>
      </section>
    );
  }

  const approvalColor = resolveColor(APPROVAL_COLOR, detail.approvalStatus);
  const putawayColor = resolveColor(PUTAWAY_COLOR, detail.putawayStatus);
  const isProposed = detail.approvalStatus === 'PROPOSED';
  const isDraft = detail.approvalStatus === 'DRAFT';
  const isRejected = detail.approvalStatus === 'REJECTED';
  const isApproved = detail.approvalStatus === 'APPROVED';
  const isEditable = isDraft || isRejected;
  const hasShipment = Boolean(detail.carrier || detail.trackingNumber || detail.driverName || detail.driverContact || detail.vehiclePlate);
  const hasNotes = Boolean(detail.notes && detail.notes.trim());
  const attachments = Array.isArray(detail.files) ? detail.files : [];
  const formattedDate = intl.formatDate(new Date(detail.date), { dateStyle: 'medium' });
  const formattedCreated = intl.formatDate(new Date(detail.createdAt), { dateStyle: 'medium', timeStyle: 'short', hour12: false });
  const formattedApproved = detail.approvedAt ? intl.formatDate(new Date(detail.approvedAt), { dateStyle: 'medium', timeStyle: 'short', hour12: false }) : null;
  const putawayLabelKey = `receiving_transaction.detail_putaway_${detail.putawayStatus.toLowerCase()}`;
  const putawayLabel = t(putawayLabelKey, detail.putawayStatus);

  return (
    <section
      className="space-y-6"
      data-ai-context={JSON.stringify({
        section: 'receiving-transaction-detail',
        id: detail.id,
        documentNumber: detail.documentNumber,
        approvalStatus: detail.approvalStatus,
        putawayStatus: detail.putawayStatus,
      })}
    >
      <PageHeader
        title={detail.documentNumber ?? detail.id}
        onBack={() => navigate('/inbound-transaction')}
        onEdit={isEditable && canUpdate ? () => navigate(`/inbound-transaction/receiving/${detail.id}/edit`) : undefined}
        onDelete={isDraft && canDelete ? () => setActionModal({ kind: 'delete', message: '' }) : undefined}
      >
        {isApproved && canPutaway && (
          <Button variant="tertiary" onPress={() => navigate(`/warehouse/${detail.warehouseId}/layout?inboundTransactionId=${detail.id}`)}>
            <PutawayIcon size={16} />
            <span className="hidden md:block">{t('receiving_transaction.action_putaway', 'Putaway')}</span>
          </Button>
        )}
      </PageHeader>

      {/* ── Hero summary card ─────────────────────────────────────────────── */}
      <Card className="overflow-hidden rounded-3xl border border-border/70 bg-[linear-gradient(160deg,rgba(8,145,178,0.10)_0%,rgba(56,189,248,0.05)_30%,rgba(255,255,255,0.98)_65%)] p-5 shadow-[0_20px_50px_rgba(3,105,161,0.12)] dark:bg-[linear-gradient(160deg,rgba(8,145,178,0.22)_0%,rgba(56,189,248,0.09)_30%,rgba(39,39,42,0.96)_65%)] lg:p-7">
        <Card.Content className="space-y-6">
          {/* Title row */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Chip color={approvalColor} variant="soft" size="sm">{detail.approvalStatus}</Chip>
                {isApproved && <Chip color={putawayColor} variant="soft" size="sm">{putawayLabel}</Chip>}
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {detail.documentNumber ?? detail.id}
              </h2>
              <p className="text-sm text-muted">
                {t('receiving_transaction.detail_subtitle', 'Inbound goods receipt from supplier')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isProposed && canApprove && (
                <Button variant='primary' className="bg-success hover:bg-success-hover" onPress={() => setActionModal({ kind: 'approve', message: '' })}>
                  <CheckCircleIcon size={16} />
                  {t('receiving_transaction.action_approve', 'Approve')}
                </Button>
              )}
              {isProposed && canApprove && (
                <Button variant="danger-soft" onPress={() => setActionModal({ kind: 'reject', message: '' })}>
                  <CloseCircleIcon size={16} className="text-danger" />
                  {t('receiving_transaction.action_reject', 'Reject')}
                </Button>
              )}
              {isEditable && canUpdate && (
                <Button variant="ghost" onPress={() => navigate(`/inbound-transaction/receiving/${detail.id}/edit`)}>
                  <PenIcon size={16} />
                  {t('receiving_transaction.action_edit', 'Edit')}
                </Button>
              )}
              {detail.id ? <PrintDocumentButton type="receiving" transactionId={detail.id} /> : null}
            </div>
          </div>

          <Separator />

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetaItem icon={<DocumentIcon size={13} />} label={t('receiving_transaction.detail_hero_document', 'Document')} value={detail.documentNumber ?? '—'} mono />
            <MetaItem icon={<TruckIcon size={13} />} label={t('receiving_transaction.detail_hero_supplier', 'Supplier')} value={detail.supplier?.name ?? '—'} />
            <MetaItem icon={<BoxIcon size={13} />} label={t('receiving_transaction.detail_hero_warehouse', 'Warehouse')} value={detail.warehouse?.name ?? '—'} />
            <MetaItem icon={<ClipboardIcon size={13} />} label={t('receiving_transaction.detail_hero_date', 'Date')} value={formattedDate} />
          </div>
        </Card.Content>
      </Card>

      {/* ── KPI metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={<LayersIcon size={20} />} label={t('receiving_transaction.detail_kpi_items', 'Total Items')} value={detail.totalItems} color={approvalColor} />
        <KpiCard icon={<ScaleIcon size={20} />} label={t('receiving_transaction.detail_kpi_quantity', 'Total Quantity')} value={detail.totalQuantity.toLocaleString()} color={approvalColor} />
        <KpiCard icon={<CheckCircleIcon size={20} />} label={t('receiving_transaction.detail_kpi_approval', 'Approval')} value={<Chip color={approvalColor} variant="soft" size="sm">{detail.approvalStatus}</Chip>} />
        <KpiCard icon={<PutawayIcon size={20} />} label={t('receiving_transaction.detail_kpi_putaway', 'Putaway')} value={<Chip color={putawayColor} variant="soft" size="sm">{putawayLabel}</Chip>} />
      </div>

      {/* ── Two-column: Shipment + Notes/Attachments ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Shipment & Driver */}
        <Fieldset>
          <FieldsetLegend>
            <div className="flex items-center gap-2">
              <TruckIcon size={18} className="text-accent" />
              {t('receiving_transaction.detail_section_shipment', 'Shipment & Driver')}
            </div>
          </FieldsetLegend>
          <FieldGroup>
            {hasShipment ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MetaItem label={t('receiving_transaction.form_carrier', 'Carrier')} value={detail.carrier} />
                <MetaItem label={t('receiving_transaction.form_tracking', 'Tracking Number')} value={detail.trackingNumber} mono />
                <MetaItem label={t('receiving_transaction.form_driver_name', 'Driver Name')} value={detail.driverName} />
                <MetaItem label={t('receiving_transaction.form_driver_contact', 'Driver Contact')} value={detail.driverContact} />
                <MetaItem label={t('receiving_transaction.form_vehicle_plate', 'Vehicle Plate')} value={detail.vehiclePlate} />
                <MetaItem label={t('receiving_transaction.form_po_ref', 'Purchase Order Ref')} value={detail.purchaseOrderRef} mono />
                <MetaItem label={t('receiving_transaction.form_dn_ref', 'Delivery Note Ref')} value={detail.deliveryNoteRef} mono />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <TruckIcon size={24} className="text-muted" />
                <p className="text-sm text-muted">{t('receiving_transaction.detail_no_driver', 'No driver information recorded')}</p>
              </div>
            )}
          </FieldGroup>
        </Fieldset>

        {/* Notes & Attachments */}
        <Fieldset>
          <FieldsetLegend>
            <div className="flex items-center gap-2">
              <NotesIcon size={18} className="text-accent" />
              {t('receiving_transaction.detail_section_notes', 'Notes & Attachments')}
            </div>
          </FieldsetLegend>
          <FieldGroup className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{t('receiving_transaction.form_notes', 'Notes')}</p>
              {hasNotes ? (
                <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">{detail.notes}</p>
              ) : (
                <p className="mt-2 text-sm text-muted">{t('receiving_transaction.detail_no_notes', 'No notes added')}</p>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{t('receiving_transaction.form_attachments', 'Attachments')}</p>
              {attachments.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {attachments.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface px-3 py-2 text-sm">
                      <PaperclipIcon size={14} className="shrink-0 text-muted" />
                      <span className="flex-1 truncate text-foreground">{f.name}</span>
                      {f.size ? <span className="shrink-0 text-xs text-muted">{Math.round(f.size / 1024)} KB</span> : null}
                      {f.url ? (
                        <a href={f.url} target="_blank" rel="noreferrer" className="shrink-0 text-accent hover:underline">
                          <EyeIcon size={14} />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted">—</p>
              )}
            </div>
          </FieldGroup>
        </Fieldset>
      </div>

      {/* ── Received items table ──────────────────────────────────────────── */}
      <Card>
        <Card.Header>
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BoxIcon size={18} className="text-accent" />
              <div>
                <Card.Title>{t('receiving_transaction.detail_section_items', 'Received Items')}</Card.Title>
                <Card.Description>{t('receiving_transaction.detail_section_items_desc', 'SKUs and quantities received in this transaction')}</Card.Description>
              </div>
            </div>
            <ItemQrPrintButton
              items={detail.items.map((item) => ({
                id: item.id,
                skuName: item.sku?.name ?? '—',
                skuCode: item.sku?.code ?? '—',
              }))}
              receivedDate={formattedDate}
              sourceValue={detail.supplier?.name ?? null}
              sourceLabel={t('receiving_transaction.detail_hero_supplier', 'Supplier')}
              fileName={`${detail.documentNumber ?? detail.id}-qr-labels`}
            />
          </div>
        </Card.Header>
        <Card.Content>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={t('receiving_transaction.detail_section_items', 'Received Items')}>
                <Table.Header>
                  <Table.Column isRowHeader><span className="text-xs font-semibold">#</span></Table.Column>
                  <Table.Column><span className="text-xs font-semibold">{t('receiving_transaction.detail_col_sku_code', 'SKU Code')}</span></Table.Column>
                  <Table.Column><span className="text-xs font-semibold">{t('receiving_transaction.detail_col_sku_name', 'SKU Name')}</span></Table.Column>
                  <Table.Column><span className="text-xs font-semibold">{t('receiving_transaction.detail_col_qty', 'Qty')}</span></Table.Column>
                  <Table.Column><span className="text-xs font-semibold">{t('receiving_transaction.detail_col_details', 'Details')}</span></Table.Column>
                </Table.Header>
                <Table.Body
                  renderEmptyState={() => (
                    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                      <BoxIcon size={24} className="text-muted" />
                      <span className="text-sm text-muted">{t('receiving_transaction.empty', 'No items.')}</span>
                    </div>
                  )}
                >
                  {detail.items.map((item, index) => (
                    <Table.Row key={item.id} id={item.id}>
                      <Table.Cell><span className="font-mono text-sm text-muted">{index + 1}</span></Table.Cell>
                      <Table.Cell><span className="font-mono text-sm text-foreground">{item.sku?.code ?? '—'}</span></Table.Cell>
                      <Table.Cell><span className="text-sm text-foreground">{item.sku?.name ?? '—'}</span></Table.Cell>
                      <Table.Cell><span className="font-semibold text-foreground">{numQty(item.quantity).toLocaleString()}</span></Table.Cell>
                      <Table.Cell><span className="text-sm text-muted">{item.details || '—'}</span></Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
                <Table.Footer>
                  <Table.Row>
                    <Table.Cell /><Table.Cell /><Table.Cell>
                      <span className="text-xs font-semibold text-muted">{t('receiving_transaction.detail_total_row', 'Total')}</span>
                    </Table.Cell>
                    <Table.Cell><span className="font-semibold text-foreground">{detail.totalQuantity.toLocaleString()}</span></Table.Cell>
                    <Table.Cell />
                  </Table.Row>
                </Table.Footer>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>

      {/* ── Audit trail ─────────────────────────────────────────────────── */}
      <Fieldset>
        <FieldsetLegend>
          <div className="flex items-center gap-2">
            <ClipboardIcon size={18} className="text-accent" />
            {t('receiving_transaction.detail_section_audit', 'Audit Trail')}
          </div>
        </FieldsetLegend>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetaItem label={t('receiving_transaction.detail_label_created_by', 'Created By')} value={detail.createdBy?.name ?? detail.createdBy?.email ?? '—'} />
            <MetaItem label={t('receiving_transaction.detail_label_created_at', 'Created At')} value={formattedCreated} />
            <MetaItem label={t('receiving_transaction.detail_label_approved_by', 'Approved By')} value={detail.approvedBy?.name ?? detail.approvedBy?.email ?? '—'} />
            <MetaItem label={t('receiving_transaction.detail_label_approved_at', 'Approved At')} value={formattedApproved ?? '—'} />
            <MetaItem label={t('receiving_transaction.detail_label_putaway_status', 'Putaway Status')} value={<Chip color={putawayColor} variant="soft" size="sm">{putawayLabel}</Chip>} />
            <MetaItem label={t('receiving_transaction.detail_label_supplier_code', 'Supplier Code')} value={detail.supplier?.code ?? '—'} mono />
          </div>
          <div className="flex justify-end">
            <ApprovalHistory approvalHistory={detail.approvalHistory} />
          </div>
        </FieldGroup>
      </Fieldset>

      {/* ── Action modal (approve / reject / delete) ─────────────────────── */}
      <Modal>
        <Modal.Backdrop
          isOpen={actionModal !== null}
          onOpenChange={(open) => { if (!open && !isActing) { setActionModal(null); setActionError(null); } }}
          isDismissable={!isActing}
          isKeyboardDismissDisabled={isActing}
        >
          <Modal.Container size="sm">
            <Modal.Dialog>
              {isActing ? (
                <>
                  <Modal.Header><Modal.Heading>{t('receiving_transaction.action_processing', 'Processing…')}</Modal.Heading></Modal.Header>
                  <Modal.Body className="flex flex-col items-center gap-4 py-8">
                    <SpinnerIcon size={32} className="animate-spin text-accent" />
                    <p className="text-sm text-muted">{t('receiving_transaction.action_please_wait', 'Please wait…')}</p>
                  </Modal.Body>
                </>
              ) : actionError ? (
                <>
                  <Modal.Header>
                    <Modal.Icon><CloseCircleIcon size={48} className="text-danger" /></Modal.Icon>
                    <Modal.Heading>{t('receiving_transaction.action_error_title', 'Something went wrong')}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body><p className="text-center text-sm text-muted">{actionError}</p></Modal.Body>
                  <Modal.Footer><Button onPress={() => { setActionError(null); setActionModal(null); }}>{t('receiving_transaction.action_close', 'Close')}</Button></Modal.Footer>
                </>
              ) : (
                <>
                  <Modal.Header>
                    <Modal.Icon>
                      {actionModal?.kind === 'approve' ? <CheckCircleIcon size={40} className="text-success" />
                        : actionModal?.kind === 'reject' ? <CloseCircleIcon size={40} className="text-danger" />
                        : <TrashIcon size={40} className="text-danger" />}
                    </Modal.Icon>
                    <Modal.Heading>
                      {actionModal?.kind === 'approve' ? t('receiving_transaction.confirm_approve_title', 'Confirm Approve')
                        : actionModal?.kind === 'reject' ? t('receiving_transaction.confirm_reject_title', 'Confirm Reject')
                        : t('receiving_transaction.delete_modal_title', 'Delete Receiving Transaction')}
                    </Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="space-y-4">
                    <p className="text-sm text-muted">
                      {actionModal?.kind === 'approve' ? t('receiving_transaction.confirm_approve_desc', 'Approve this transaction? This action cannot be undone.')
                        : actionModal?.kind === 'reject' ? t('receiving_transaction.confirm_reject_desc', 'Reject this transaction? This action cannot be undone.')
                        : intl.formatMessage({ id: 'receiving_transaction.delete_modal_body', defaultMessage: 'Are you sure you want to delete receiving transaction {id}?' }, { id: detail.id })}
                    </p>
                    {(actionModal?.kind === 'approve' || actionModal?.kind === 'reject') && (
                      <TextField fullWidth>
                        <Label>{t('receiving_transaction.approval_message_label', 'Message')}</Label>
                        <TextArea
                          rows={3}
                          variant="secondary"
                          value={actionModal.message}
                          onChange={(e) => setActionModal({ ...actionModal!, message: e.target.value })}
                          placeholder={t('receiving_transaction.approval_message_placeholder', 'Add a message (optional)')}
                        />
                      </TextField>
                    )}
                  </Modal.Body>
                  <Modal.Footer>
                    <Button variant="ghost" onPress={() => { setActionModal(null); }}>{t('receiving_transaction.action_cancel', 'Cancel')}</Button>
                    <Button
                      variant={actionModal?.kind === 'approve' ? 'primary' : 'danger'}
                      onPress={() => void handleConfirm()}
                    >
                      {actionModal?.kind === 'approve' ? t('receiving_transaction.approve', 'Approve')
                        : actionModal?.kind === 'reject' ? t('receiving_transaction.action_reject', 'Reject')
                        : t('receiving_transaction.delete_confirm', 'Delete')}
                    </Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}

export { ReceivingTransactionDetailPage };
