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
  PutawayIcon,
  RmaReceiptTypeIcon,
  ScaleIcon,
  ShipmentTypeIcon,
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
  PUTAWAY_COLOR,
  resolveStatusColor,
  TransactionItemsTable,
  useTransactionDetailActions,
  type ActionModalMessages,
  type AuditTrailMessages,
  type DetailItemRow,
  type ItemsTableMessages,
} from "../_detail-shared";
import { ItemQrPrintButton } from "../_ItemQrPrintButton";

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

interface RmaItem {
  id: string;
  skuId: string;
  sku: SkuRef;
  quantity: number | { toNumber(): number };
  details?: string | null;
}

interface RmaDetail {
  id: string;
  documentNumber?: string | null;
  date: string | Date;
  originalShipmentId?: string | null;
  salesOrderRef?: string | null;
  returnReason?: string | null;
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
  items: RmaItem[];
  totalItems: number;
  totalQuantity: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

function RmaReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const canApprove = hasPermission("rma-receipt@approve");
  const canUpdate = hasPermission("rma-receipt@update");
  const canDelete = hasPermission("rma-receipt@delete");
  const canPutaway = hasPermission("transaction@putaway");

  const t = (k: string, fallback: string) =>
    intl.formatMessage({ id: k, defaultMessage: fallback });

  const { data: rawDetail, isLoading } = useQuery({
    queryKey: ["rmaReceiptDetail", id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.rmaReceipt.detail.query({ id: id! }),
  });

  const detail = rawDetail as RmaDetail | undefined;

  const {
    actionModal,
    setActionModal,
    isActing,
    actionError,
    setActionError,
    handleConfirm,
  } = useTransactionDetailActions({
    resource: "rmaReceipt",
    id,
    detailQueryKey: "rmaReceiptDetail",
    listQueryKey: "rmaReceiptList",
    backPath: "/inbound-transaction",
  });

  if (isLoading) return <DetailSkeleton />;

  if (!detail) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BoxIcon size={32} className="text-muted" />
          <p className="text-sm text-muted">
            {t("rma_receipt.detail_not_found", "RMA receipt not found.")}
          </p>
          <Button
            variant="ghost"
            onPress={() => navigate("/inbound-transaction")}
          >
            {t("rma_receipt.detail_back", "Back")}
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
  const putawayColor = resolveStatusColor(PUTAWAY_COLOR, detail.putawayStatus);
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
  const putawayLabelKey = `rma_receipt.detail_putaway_${detail.putawayStatus.toLowerCase()}`;
  const putawayLabel = t(putawayLabelKey, detail.putawayStatus);

  const itemsTableMessages: ItemsTableMessages = {
    sectionTitle: t("rma_receipt.detail_section_items", "Received Items"),
    sectionDesc: t(
      "rma_receipt.detail_section_items_desc",
      "SKUs and quantities received in this transaction",
    ),
    skuCode: t("rma_receipt.detail_col_sku_code", "SKU Code"),
    skuName: t("rma_receipt.detail_col_sku_name", "SKU Name"),
    qty: t("rma_receipt.detail_col_qty", "Qty"),
    details: t("rma_receipt.detail_col_details", "Details"),
    total: t("rma_receipt.detail_total_row", "Total"),
    empty: t("rma_receipt.empty", "No items."),
  };

  const auditMessages: AuditTrailMessages = {
    sectionTitle: t("rma_receipt.detail_section_audit", "Audit Trail"),
    sectionDesc: t(
      "rma_receipt.detail_section_audit_desc",
      "Who created, approved, and when",
    ),
    createdBy: t("rma_receipt.detail_label_created_by", "Created By"),
    createdAt: t("rma_receipt.detail_label_created_at", "Created At"),
    approvedBy: t("rma_receipt.detail_label_approved_by", "Approved By"),
    approvedAt: t("rma_receipt.detail_label_approved_at", "Approved At"),
    putawayStatus: t(
      "rma_receipt.detail_label_putaway_status",
      "Putaway Status",
    ),
  };

  const actionMessages: ActionModalMessages = {
    processing: t("rma_receipt.action_processing", "Processing…"),
    pleaseWait: t("rma_receipt.action_please_wait", "Please wait…"),
    errorTitle: t("rma_receipt.action_error_title", "Something went wrong"),
    close: t("rma_receipt.action_close", "Close"),
    approveTitle: t("rma_receipt.confirm_approve_title", "Confirm Approve"),
    rejectTitle: t("rma_receipt.confirm_reject_title", "Confirm Reject"),
    deleteTitle: t("rma_receipt.delete_modal_title", "Delete RMA Receipt"),
    approveDesc: t(
      "rma_receipt.confirm_approve_desc",
      "Approve this transaction? This action cannot be undone.",
    ),
    rejectDesc: t(
      "rma_receipt.confirm_reject_desc",
      "Reject this transaction? This action cannot be undone.",
    ),
    deleteBody: intl.formatMessage(
      {
        id: "rma_receipt.delete_modal_body",
        defaultMessage: "Are you sure you want to delete RMA receipt {id}?",
      },
      { id: detail.id },
    ),
    messageLabel: t("rma_receipt.approval_message_label", "Message"),
    messagePlaceholder: t(
      "rma_receipt.approval_message_placeholder",
      "Add a message (optional)",
    ),
    cancel: t("rma_receipt.action_cancel", "Cancel"),
    approve: t("rma_receipt.approve", "Approve"),
    reject: t("rma_receipt.action_reject", "Reject"),
    deleteConfirm: t("rma_receipt.delete_confirm", "Delete"),
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
        section: "rma-receipt-detail",
        id: detail.id,
        documentNumber: detail.documentNumber,
        approvalStatus: detail.approvalStatus,
        putawayStatus: detail.putawayStatus,
      })}
    >
      <PageHeader
        title={detail.documentNumber ?? detail.id}
        onBack={() => navigate("/inbound-transaction")}
        onEdit={
          isEditable && canUpdate
            ? () =>
                navigate(`/inbound-transaction/rma-receipt/${detail.id}/edit`)
            : undefined
        }
        onDelete={
          isDraft && canDelete
            ? () => setActionModal({ kind: "delete", message: "" })
            : undefined
        }
      >
        {isApproved && canPutaway && (
          <Button
            variant="tertiary"
            onPress={() =>
              navigate(
                `/warehouse/${detail.warehouseId}/layout?inboundTransactionId=${detail.id}`,
              )
            }
          >
            <PutawayIcon size={16} />
            <span className="hidden md:block">
              {t("rma_receipt.action_putaway", "Putaway")}
            </span>
          </Button>
        )}
      </PageHeader>

      {/* ── Hero summary card ─────────────────────────────────────────────── */}
      <HeroSummaryCard
        gradientClass={HERO_GRADIENTS.rmaReceipt}
        title={detail.documentNumber ?? detail.id}
        subtitle={t("rma_receipt.detail_subtitle", "Customer return received")}
        statusChips={
          <>
            <Chip color={approvalColor} variant="soft" size="sm">
              {detail.approvalStatus}
            </Chip>
            {isApproved && (
              <Chip color={putawayColor} variant="soft" size="sm">
                {putawayLabel}
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
                {t("rma_receipt.action_approve", "Approve")}
              </Button>
            )}
            {isProposed && canApprove && (
              <Button
                variant="danger-soft"
                onPress={() => setActionModal({ kind: "reject", message: "" })}
              >
                <CloseCircleIcon size={16} className="text-danger" />
                {t("rma_receipt.action_reject", "Reject")}
              </Button>
            )}
            {isEditable && canUpdate && (
              <Button
                variant="ghost"
                onPress={() =>
                  navigate(`/inbound-transaction/rma-receipt/${detail.id}/edit`)
                }
              >
                <PenIcon size={16} />
                {t("rma_receipt.action_edit", "Edit")}
              </Button>
            )}
            {detail.id ? (
              <PrintDocumentButton
                type="rma-receipt"
                transactionId={detail.id}
              />
            ) : null}
          </>
        }
        metaItems={
          <>
            <MetaItem
              icon={<DocumentIcon size={13} />}
              label={t("rma_receipt.detail_hero_document", "Document")}
              value={detail.documentNumber ?? "—"}
              mono
            />
            <MetaItem
              icon={<BoxIcon size={13} />}
              label={t("rma_receipt.detail_hero_warehouse", "Warehouse")}
              value={detail.warehouse?.name ?? "—"}
            />
            <MetaItem
              icon={<ClipboardIcon size={13} />}
              label={t("rma_receipt.detail_hero_date", "Date")}
              value={formattedDate}
            />
            <MetaItem
              icon={<RmaReceiptTypeIcon size={13} />}
              label={t("rma_receipt.detail_hero_shipment", "Original Shipment")}
              value={detail.originalShipmentId ?? "—"}
              mono
            />
          </>
        }
      />

      {/* ── KPI metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<LayersIcon size={20} />}
          label={t("rma_receipt.detail_kpi_items", "Total Items")}
          value={detail.totalItems}
          color={approvalColor}
        />
        <KpiCard
          icon={<ScaleIcon size={20} />}
          label={t("rma_receipt.detail_kpi_quantity", "Total Quantity")}
          value={detail.totalQuantity.toLocaleString()}
          color={approvalColor}
        />
        <KpiCard
          icon={<CheckCircleIcon size={20} />}
          label={t("rma_receipt.detail_kpi_approval", "Approval")}
          value={
            <Chip color={approvalColor} variant="soft" size="sm">
              {detail.approvalStatus}
            </Chip>
          }
        />
        <KpiCard
          icon={<PutawayIcon size={20} />}
          label={t("rma_receipt.detail_kpi_putaway", "Putaway")}
          value={
            <Chip color={putawayColor} variant="soft" size="sm">
              {putawayLabel}
            </Chip>
          }
        />
      </div>

      {/* ── Linked shipment callout (domain-specific) ───────────────────── */}
      <CalloutCard
        icon={<ShipmentTypeIcon size={18} />}
        tone="accent"
        title={t(
          "rma_receipt.detail_callout_title",
          "Linked to original shipment",
        )}
        description={t(
          "rma_receipt.detail_callout_desc",
          "This return traces back to a prior outbound shipment. Review the original dispatch for context.",
        )}
      >
        {detail.originalShipmentId ? (
          <Button
            variant="tertiary"
            onPress={() =>
              navigate(
                `/outbound-transaction/shipment/${detail.originalShipmentId}`,
              )
            }
          >
            <ShipmentTypeIcon size={16} />
            {t(
              "rma_receipt.detail_callout_view_shipment",
              "View original shipment",
            )}
          </Button>
        ) : (
          <p className="text-sm text-muted">
            {t(
              "rma_receipt.detail_callout_no_shipment",
              "No original shipment linked",
            )}
          </p>
        )}
      </CalloutCard>

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Fieldset>
        <FieldsetLegend>
          <div className="flex items-center gap-2">
            <RmaReceiptTypeIcon size={18} className="text-accent" />
            {t("rma_receipt.detail_section_details", "Return Details")}
          </div>
        </FieldsetLegend>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaItem
              label={t(
                "rma_receipt.label_original_shipment",
                "Original Shipment ID",
              )}
              value={detail.originalShipmentId}
              mono
            />
            <MetaItem
              label={t("rma_receipt.label_sales_order_ref", "Sales Order Ref")}
              value={detail.salesOrderRef}
              mono
            />
            <MetaItem
              label={t("rma_receipt.label_return_reason", "Return Reason")}
              value={detail.returnReason}
            />
            <MetaItem
              label={t("rma_receipt.label_reference", "Reference")}
              value={detail.reference}
              mono
            />
          </div>
          <Separator />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t("rma_receipt.form_notes", "Notes")}
            </p>
            {hasNotes ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">
                {detail.notes}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {t("rma_receipt.detail_no_notes", "No notes added")}
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
        actions={
          <ItemQrPrintButton
            items={detail.items.map((item) => ({
              id: item.id,
              skuName: item.sku?.name ?? "—",
              skuCode: item.sku?.code ?? "—",
            }))}
            receivedDate={formattedDate}
            sourceValue={
              detail.salesOrderRef ?? detail.originalShipmentId ?? null
            }
            sourceLabel={t("print.qr.sales_order", "Sales Order")}
            fileName={`${detail.documentNumber ?? detail.id}-qr-labels`}
          />
        }
      />

      {/* ── Audit trail ──────────────────────────────────────────────────── */}
      <AuditTrail
        messages={auditMessages}
        createdBy={detail.createdBy?.name ?? detail.createdBy?.email ?? "—"}
        createdAt={formattedCreated}
        approvedBy={detail.approvedBy?.name ?? detail.approvedBy?.email ?? "—"}
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

export { RmaReceiptDetailPage };
