import { useAtomValue } from "jotai";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Chip,
  Fieldset,
  FieldsetLegend,
  FieldGroup,
  Separator,
} from "@heroui/react";
import type { ChipProps } from "@heroui/react";
import {
  BoxIcon,
  CheckCircleIcon,
  ClipboardIcon,
  CloseCircleIcon,
  DocumentIcon,
  LayersIcon,
  PenIcon,
  ScaleIcon,
  ShipmentTypeIcon,
  TruckIcon,
} from "../../../assets/IconRegistry";
import { trpcClient } from "../../../lib/trpc";
import { hasPermissionAtom } from "../../../lib/atoms";
import { PageHeader } from "../../../components/PageHeader";
import { PrintDocumentButton } from "../../../components/PrintDocumentButton";
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
} from "../_detail-shared";

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

interface ShipmentItem {
  id: string;
  skuId: string;
  sku: SkuRef;
  quantity: number | { toNumber(): number };
  details?: string | null;
}

interface ShipmentDetail {
  id: string;
  documentNumber?: string | null;
  date: string | Date;
  shipmentNumber?: string | null;
  salesOrderRef?: string | null;
  recipient?: string | null;
  reference?: string | null;
  notes?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  warehouseId: string;
  warehouse: WarehouseRef;
  approvalStatus: string;
  dispatchStatus: string;
  dispatchOpenStatus: string;
  approvalHistory?: unknown;
  createdById: string;
  createdBy: UserRef;
  approvedById?: string | null;
  approvedBy?: UserRef | null;
  approvedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  items: ShipmentItem[];
  totalItems: number;
  totalQuantity: number;
}

const DISPATCH_COLOR: Record<string, ChipProps["color"]> = {
  PENDING: "default",
  PARTIAL: "warning",
  COMPLETED: "success",
};

// ─── Main component ───────────────────────────────────────────────────────────

function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const canApprove = hasPermission("shipment@approve");
  const canUpdate = hasPermission("shipment@update");
  const canDelete = hasPermission("shipment@delete");

  const t = (k: string, fallback: string) =>
    intl.formatMessage({ id: k, defaultMessage: fallback });

  const { data: rawDetail, isLoading } = useQuery({
    queryKey: ["shipmentDetail", id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.shipment.detail.query({ id: id! }),
  });

  const detail = rawDetail as ShipmentDetail | undefined;

  const {
    actionModal,
    setActionModal,
    isActing,
    actionError,
    setActionError,
    handleConfirm,
  } = useTransactionDetailActions({
    resource: "shipment",
    id,
    detailQueryKey: "shipmentDetail",
    listQueryKey: "shipmentList",
    backPath: "/outbound-transaction",
  });

  if (isLoading) return <DetailSkeleton />;

  if (!detail) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BoxIcon size={32} className="text-muted" />
          <p className="text-sm text-muted">
            {t("shipment.detail_not_found", "Shipment not found.")}
          </p>
          <Button
            variant="ghost"
            onPress={() => navigate("/outbound-transaction")}
          >
            {t("shipment.detail_back", "Back")}
          </Button>
        </div>
      </section>
    );
  }

  const approvalColor = resolveStatusColor(
    {
      DRAFT: "default",
      PROPOSED: "warning",
      APPROVED: "success",
      REJECTED: "danger",
    },
    detail.approvalStatus,
  ) as ChipProps["color"];
  const dispatchColor = resolveStatusColor(
    DISPATCH_COLOR,
    detail.dispatchStatus,
  );
  const isProposed = detail.approvalStatus === "PROPOSED";
  const isDraft = detail.approvalStatus === "DRAFT";
  const isRejected = detail.approvalStatus === "REJECTED";
  const isApproved = detail.approvalStatus === "APPROVED";
  const isEditable = isDraft || isRejected;
  const hasNotes = Boolean(detail.notes && detail.notes.trim());
  const formattedDate = intl.formatDate(new Date(detail.date), {
    dateStyle: "medium",
  });
  const formattedCreated = intl.formatDate(new Date(detail.createdAt), {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  });
  const formattedApproved = detail.approvedAt
    ? intl.formatDate(new Date(detail.approvedAt), {
        dateStyle: "medium",
        timeStyle: "short",
        hour12: false,
      })
    : null;
  const dispatchLabelKey = `shipment.detail_dispatch_${detail.dispatchStatus.toLowerCase()}`;
  const dispatchLabel = t(dispatchLabelKey, detail.dispatchStatus);

  const itemsTableMessages: ItemsTableMessages = {
    sectionTitle: t("shipment.detail_section_items", "Shipment Items"),
    sectionDesc: t(
      "shipment.detail_section_items_desc",
      "SKUs and quantities leaving the warehouse in this shipment",
    ),
    skuCode: t("shipment.detail_col_sku_code", "SKU Code"),
    skuName: t("shipment.detail_col_sku_name", "SKU Name"),
    qty: t("shipment.detail_col_qty", "Qty"),
    details: t("shipment.detail_col_details", "Details"),
    total: t("shipment.detail_total_row", "Total"),
    empty: t("shipment.empty", "No items."),
  };

  const auditMessages: AuditTrailMessages = {
    sectionTitle: t("shipment.detail_section_audit", "Audit Trail"),
    sectionDesc: t(
      "shipment.detail_section_audit_desc",
      "Who created, approved, and when",
    ),
    createdBy: t("shipment.detail_label_created_by", "Created By"),
    createdAt: t("shipment.detail_label_created_at", "Created At"),
    approvedBy: t("shipment.detail_label_approved_by", "Approved By"),
    approvedAt: t("shipment.detail_label_approved_at", "Approved At"),
    putawayStatus: t(
      "shipment.detail_label_dispatch_status",
      "Dispatch Status",
    ),
  };

  const actionMessages: ActionModalMessages = {
    processing: t("shipment.action_processing", "Processing…"),
    pleaseWait: t("shipment.action_please_wait", "Please wait…"),
    errorTitle: t("shipment.action_error_title", "Something went wrong"),
    close: t("shipment.action_close", "Close"),
    approveTitle: t("shipment.confirm_approve_title", "Confirm Approve"),
    rejectTitle: t("shipment.confirm_reject_title", "Confirm Reject"),
    deleteTitle: t("shipment.delete_modal_title", "Delete Shipment"),
    approveDesc: t(
      "shipment.confirm_approve_desc",
      "Approve this shipment? This action cannot be undone.",
    ),
    rejectDesc: t(
      "shipment.confirm_reject_desc",
      "Reject this shipment? This action cannot be undone.",
    ),
    deleteBody: intl.formatMessage(
      {
        id: "shipment.delete_modal_body",
        defaultMessage: "Are you sure you want to delete shipment {id}?",
      },
      { id: detail.id },
    ),
    messageLabel: t("shipment.approval_message_label", "Message"),
    messagePlaceholder: t(
      "shipment.approval_message_placeholder",
      "Add a message (optional)",
    ),
    cancel: t("shipment.action_cancel", "Cancel"),
    approve: t("shipment.action_approve", "Approve"),
    reject: t("shipment.action_reject", "Reject"),
    deleteConfirm: t("shipment.delete_confirm", "Delete"),
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
        section: "shipment-detail",
        id: detail.id,
        documentNumber: detail.documentNumber,
        approvalStatus: detail.approvalStatus,
        dispatchStatus: detail.dispatchStatus,
      })}
    >
      <PageHeader
        title={detail.documentNumber ?? detail.id}
        onBack={() => navigate("/outbound-transaction")}
        onEdit={
          isEditable && canUpdate
            ? () => navigate(`/outbound-transaction/shipment/${detail.id}/edit`)
            : undefined
        }
        onDelete={
          isDraft && canDelete
            ? () => setActionModal({ kind: "delete", message: "" })
            : undefined
        }
      >
        {isApproved && (
          <Button
            variant="tertiary"
            onPress={() =>
              navigate(
                `/warehouse/${detail.warehouseId}/layout?outboundTransactionId=${detail.id}`,
              )
            }
          >
            <TruckIcon size={16} />
            <span className="hidden md:block">
              {t("shipment.action_dispatch", "Dispatch")}
            </span>
          </Button>
        )}
      </PageHeader>

      {/* ── Hero summary card ─────────────────────────────────────────────── */}
      <HeroSummaryCard
        gradientClass={HERO_GRADIENTS.shipment}
        title={detail.documentNumber ?? detail.id}
        subtitle={t(
          "shipment.detail_subtitle",
          "Goods dispatched to customer or carrier",
        )}
        statusChips={
          <>
            <Chip color={approvalColor} variant="soft" size="sm">
              {detail.approvalStatus}
            </Chip>
            {isApproved && (
              <Chip color={dispatchColor} variant="soft" size="sm">
                {dispatchLabel}
              </Chip>
            )}
          </>
        }
        actions={
          <>
            {isProposed && canApprove && (
              <Button
                variant="primary"
                className="bg-success hover:bg-success-hover"
                onPress={() => setActionModal({ kind: "approve", message: "" })}
              >
                <CheckCircleIcon size={16} />
                {t("shipment.action_approve", "Approve")}
              </Button>
            )}
            {isProposed && canApprove && (
              <Button
                variant="danger-soft"
                onPress={() => setActionModal({ kind: "reject", message: "" })}
              >
                <CloseCircleIcon size={16} className="text-danger" />
                {t("shipment.action_reject", "Reject")}
              </Button>
            )}
            {isEditable && canUpdate && (
              <Button
                variant="ghost"
                onPress={() =>
                  navigate(`/outbound-transaction/shipment/${detail.id}/edit`)
                }
              >
                <PenIcon size={16} />
                {t("shipment.action_edit", "Edit")}
              </Button>
            )}
            {detail.id ? (
              <PrintDocumentButton type="shipment" transactionId={detail.id} />
            ) : null}
          </>
        }
        metaItems={
          <>
            <MetaItem
              icon={<DocumentIcon size={13} />}
              label={t("shipment.detail_hero_document", "Document")}
              value={detail.documentNumber ?? "—"}
              mono
            />
            <MetaItem
              icon={<BoxIcon size={13} />}
              label={t("shipment.detail_hero_warehouse", "Warehouse")}
              value={detail.warehouse?.name ?? "—"}
            />
            <MetaItem
              icon={<ClipboardIcon size={13} />}
              label={t("shipment.detail_hero_date", "Date")}
              value={formattedDate}
            />
            <MetaItem
              icon={<TruckIcon size={13} />}
              label={t("shipment.detail_hero_recipient", "Recipient")}
              value={detail.recipient}
            />
          </>
        }
      />

      {/* ── KPI metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<LayersIcon size={20} />}
          label={t("shipment.detail_kpi_items", "Total Items")}
          value={detail.totalItems}
          color={approvalColor}
        />
        <KpiCard
          icon={<ScaleIcon size={20} />}
          label={t("shipment.detail_kpi_quantity", "Total Quantity")}
          value={detail.totalQuantity.toLocaleString()}
          color={approvalColor}
        />
        <KpiCard
          icon={<CheckCircleIcon size={20} />}
          label={t("shipment.detail_kpi_approval", "Approval")}
          value={
            <Chip color={approvalColor} variant="soft" size="sm">
              {detail.approvalStatus}
            </Chip>
          }
        />
        <KpiCard
          icon={<TruckIcon size={20} />}
          label={t("shipment.detail_kpi_dispatch", "Dispatch")}
          value={
            <Chip color={dispatchColor} variant="soft" size="sm">
              {dispatchLabel}
            </Chip>
          }
        />
      </div>

      {/* ── Logistics callout (domain-specific) ─────────────────────────── */}
      <CalloutCard
        icon={<TruckIcon size={18} />}
        tone="accent"
        title={t("shipment.detail_callout_title", "Outbound dispatch")}
        description={t(
          "shipment.detail_callout_desc",
          "These goods leave the warehouse and reduce on-hand inventory once dispatched.",
        )}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaItem
            label={t("shipment.label_carrier", "Carrier")}
            value={detail.carrier}
            icon={<TruckIcon size={13} />}
          />
          <MetaItem
            label={t("shipment.label_tracking_number", "Tracking Number")}
            value={detail.trackingNumber}
            mono
          />
          <MetaItem
            label={t("shipment.label_shipment_number", "Shipment Number")}
            value={detail.shipmentNumber}
            mono
          />
          <MetaItem
            label={t("shipment.label_sales_order_ref", "Sales Order Ref")}
            value={detail.salesOrderRef}
            mono
          />
        </div>
      </CalloutCard>

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Fieldset>
        <FieldsetLegend>
          <div className="flex items-center gap-2">
            <ShipmentTypeIcon size={18} className="text-accent" />
            {t("shipment.detail_section_details", "Shipment Details")}
          </div>
        </FieldsetLegend>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaItem
              label={t("shipment.label_recipient", "Recipient")}
              value={detail.recipient}
            />
            <MetaItem
              label={t("shipment.label_reference", "Reference")}
              value={detail.reference}
              mono
            />
            <MetaItem
              label={t("shipment.label_carrier", "Carrier")}
              value={detail.carrier}
            />
            <MetaItem
              label={t("shipment.label_tracking_number", "Tracking Number")}
              value={detail.trackingNumber}
              mono
            />
            <MetaItem
              label={t("shipment.label_shipment_number", "Shipment Number")}
              value={detail.shipmentNumber}
              mono
            />
            <MetaItem
              label={t("shipment.label_sales_order_ref", "Sales Order Ref")}
              value={detail.salesOrderRef}
              mono
            />
          </div>
          <Separator />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t("shipment.form_notes", "Notes")}
            </p>
            {hasNotes ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">
                {detail.notes}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {t("shipment.detail_no_notes", "No notes added")}
              </p>
            )}
          </div>
        </FieldGroup>
      </Fieldset>

      {/* ── Items table ──────────────────────────────────────────────────── */}
      <TransactionItemsTable
        items={items}
        totalQuantity={detail.totalQuantity}
        messages={itemsTableMessages}
      />

      {/* ── Audit trail ──────────────────────────────────────────────────── */}
      <AuditTrail
        messages={auditMessages}
        createdBy={detail.createdBy?.name ?? detail.createdBy?.email ?? "—"}
        createdAt={formattedCreated}
        approvedBy={detail.approvedBy?.name ?? detail.approvedBy?.email ?? "—"}
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
        message={actionModal?.message ?? ""}
        onMessageChange={(value) =>
          setActionModal((prev) => (prev ? { ...prev, message: value } : prev))
        }
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

export { ShipmentDetailPage };
