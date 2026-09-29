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
  DisposalTypeIcon,
  DocumentIcon,
  LayersIcon,
  PenIcon,
  ScaleIcon,
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

interface DisposalItem {
  id: string;
  skuId: string;
  sku: SkuRef;
  quantity: number | { toNumber(): number };
  details?: string | null;
}

interface DisposalDetail {
  id: string;
  documentNumber?: string | null;
  date: string | Date;
  disposalReason?: string | null;
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
  items: DisposalItem[];
  totalItems: number;
  totalQuantity: number;
}

const DISPATCH_COLOR: Record<string, ChipProps["color"]> = {
  PENDING: "default",
  PARTIAL: "warning",
  COMPLETED: "success",
};

// ─── Main component ───────────────────────────────────────────────────────────

function DisposalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const intl = useIntl();
  const navigate = useNavigate();
  const hasPermission = useAtomValue(hasPermissionAtom);

  const canApprove = hasPermission("disposal@approve");
  const canUpdate = hasPermission("disposal@update");
  const canDelete = hasPermission("disposal@delete");

  const t = (k: string, fallback: string) =>
    intl.formatMessage({ id: k, defaultMessage: fallback });

  const { data: rawDetail, isLoading } = useQuery({
    queryKey: ["disposalDetail", id],
    enabled: Boolean(id),
    queryFn: () => trpcClient.disposal.detail.query({ id: id! }),
  });

  const detail = rawDetail as DisposalDetail | undefined;

  const {
    actionModal,
    setActionModal,
    isActing,
    actionError,
    setActionError,
    handleConfirm,
  } = useTransactionDetailActions({
    resource: "disposal",
    id,
    detailQueryKey: "disposalDetail",
    listQueryKey: "disposalList",
    backPath: "/outbound-transaction",
  });

  if (isLoading) return <DetailSkeleton />;

  if (!detail) {
    return (
      <section className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BoxIcon size={32} className="text-muted" />
          <p className="text-sm text-muted">
            {t("disposal.detail_not_found", "Disposal not found.")}
          </p>
          <Button
            variant="ghost"
            onPress={() => navigate("/outbound-transaction")}
          >
            {t("disposal.detail_back", "Back")}
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
  const dispatchLabelKey = `disposal.detail_dispatch_${detail.dispatchStatus.toLowerCase()}`;
  const dispatchLabel = t(dispatchLabelKey, detail.dispatchStatus);

  const itemsTableMessages: ItemsTableMessages = {
    sectionTitle: t("disposal.detail_section_items", "Disposal Items"),
    sectionDesc: t(
      "disposal.detail_section_items_desc",
      "SKUs and quantities written off in this disposal",
    ),
    skuCode: t("disposal.detail_col_sku_code", "SKU Code"),
    skuName: t("disposal.detail_col_sku_name", "SKU Name"),
    qty: t("disposal.detail_col_qty", "Qty"),
    details: t("disposal.detail_col_details", "Details"),
    total: t("disposal.detail_total_row", "Total"),
    empty: t("disposal.empty", "No items."),
  };

  const auditMessages: AuditTrailMessages = {
    sectionTitle: t("disposal.detail_section_audit", "Audit Trail"),
    sectionDesc: t(
      "disposal.detail_section_audit_desc",
      "Who created, approved, and when",
    ),
    createdBy: t("disposal.detail_label_created_by", "Created By"),
    createdAt: t("disposal.detail_label_created_at", "Created At"),
    approvedBy: t("disposal.detail_label_approved_by", "Approved By"),
    approvedAt: t("disposal.detail_label_approved_at", "Approved At"),
    putawayStatus: t(
      "disposal.detail_label_dispatch_status",
      "Dispatch Status",
    ),
  };

  const actionMessages: ActionModalMessages = {
    processing: t("disposal.action_processing", "Processing…"),
    pleaseWait: t("disposal.action_please_wait", "Please wait…"),
    errorTitle: t("disposal.action_error_title", "Something went wrong"),
    close: t("disposal.action_close", "Close"),
    approveTitle: t("disposal.confirm_approve_title", "Confirm Approve"),
    rejectTitle: t("disposal.confirm_reject_title", "Confirm Reject"),
    deleteTitle: t("disposal.delete_modal_title", "Delete Disposal"),
    approveDesc: t(
      "disposal.confirm_approve_desc",
      "Approve this disposal? This action cannot be undone.",
    ),
    rejectDesc: t(
      "disposal.confirm_reject_desc",
      "Reject this disposal? This action cannot be undone.",
    ),
    deleteBody: intl.formatMessage(
      {
        id: "disposal.delete_modal_body",
        defaultMessage: "Are you sure you want to delete disposal {id}?",
      },
      { id: detail.id },
    ),
    messageLabel: t("disposal.approval_message_label", "Message"),
    messagePlaceholder: t(
      "disposal.approval_message_placeholder",
      "Add a message (optional)",
    ),
    cancel: t("disposal.action_cancel", "Cancel"),
    approve: t("disposal.action_approve", "Approve"),
    reject: t("disposal.action_reject", "Reject"),
    deleteConfirm: t("disposal.delete_confirm", "Delete"),
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
        section: "disposal-detail",
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
            ? () => navigate(`/outbound-transaction/disposal/${detail.id}/edit`)
            : undefined
        }
        onDelete={
          isDraft && canDelete
            ? () => setActionModal({ kind: "delete", message: "" })
            : undefined
        }
      />

      {/* ── Hero summary card ─────────────────────────────────────────────── */}
      <HeroSummaryCard
        gradientClass={HERO_GRADIENTS.disposal}
        title={detail.documentNumber ?? detail.id}
        subtitle={t(
          "disposal.detail_subtitle",
          "Stock written off and removed from inventory",
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
                {t("disposal.action_approve", "Approve")}
              </Button>
            )}
            {isProposed && canApprove && (
              <Button
                variant="danger-soft"
                onPress={() => setActionModal({ kind: "reject", message: "" })}
              >
                <CloseCircleIcon size={16} className="text-danger" />
                {t("disposal.action_reject", "Reject")}
              </Button>
            )}
            {isEditable && canUpdate && (
              <Button
                variant="ghost"
                onPress={() =>
                  navigate(`/outbound-transaction/disposal/${detail.id}/edit`)
                }
              >
                <PenIcon size={16} />
                {t("disposal.action_edit", "Edit")}
              </Button>
            )}
            {detail.id ? (
              <PrintDocumentButton type="disposal" transactionId={detail.id} />
            ) : null}
          </>
        }
        metaItems={
          <>
            <MetaItem
              icon={<DocumentIcon size={13} />}
              label={t("disposal.detail_hero_document", "Document")}
              value={detail.documentNumber ?? "—"}
              mono
            />
            <MetaItem
              icon={<BoxIcon size={13} />}
              label={t("disposal.detail_hero_warehouse", "Warehouse")}
              value={detail.warehouse?.name ?? "—"}
            />
            <MetaItem
              icon={<ClipboardIcon size={13} />}
              label={t("disposal.detail_hero_date", "Date")}
              value={formattedDate}
            />
            <MetaItem
              icon={<DisposalTypeIcon size={13} />}
              label={t("disposal.detail_hero_reason", "Reason")}
              value={detail.disposalReason}
            />
          </>
        }
      />

      {/* ── KPI metric cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<LayersIcon size={20} />}
          label={t("disposal.detail_kpi_items", "Total Items")}
          value={detail.totalItems}
          color={approvalColor}
        />
        <KpiCard
          icon={<ScaleIcon size={20} />}
          label={t("disposal.detail_kpi_quantity", "Total Quantity")}
          value={detail.totalQuantity.toLocaleString()}
          color={approvalColor}
        />
        <KpiCard
          icon={<CheckCircleIcon size={20} />}
          label={t("disposal.detail_kpi_approval", "Approval")}
          value={
            <Chip color={approvalColor} variant="soft" size="sm">
              {detail.approvalStatus}
            </Chip>
          }
        />
        <KpiCard
          icon={<DisposalTypeIcon size={20} />}
          label={t("disposal.detail_kpi_dispatch", "Dispatch")}
          value={
            <Chip color={dispatchColor} variant="soft" size="sm">
              {dispatchLabel}
            </Chip>
          }
        />
      </div>

      {/* ── Write-off callout (domain-specific) ────────────────────────── */}
      <CalloutCard
        icon={<DisposalTypeIcon size={18} />}
        tone="danger"
        title={t("disposal.detail_callout_title", "Written off inventory")}
        description={t(
          "disposal.detail_callout_desc",
          "These goods are scrapped or otherwise removed and permanently reduce warehouse stock.",
        )}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetaItem
            label={t("disposal.label_disposal_reason", "Disposal Reason")}
            value={detail.disposalReason}
            icon={<DisposalTypeIcon size={13} />}
          />
          <MetaItem
            label={t("disposal.label_reference", "Reference")}
            value={detail.reference}
            mono
          />
        </div>
      </CalloutCard>

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Fieldset>
        <FieldsetLegend>
          <div className="flex items-center gap-2">
            <DisposalTypeIcon size={18} className="text-accent" />
            {t("disposal.detail_section_details", "Disposal Details")}
          </div>
        </FieldsetLegend>
        <FieldGroup>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MetaItem
              label={t("disposal.label_disposal_reason", "Disposal Reason")}
              value={detail.disposalReason}
            />
            <MetaItem
              label={t("disposal.label_reference", "Reference")}
              value={detail.reference}
              mono
            />
          </div>
          <Separator />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              {t("disposal.form_notes", "Notes")}
            </p>
            {hasNotes ? (
              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface p-3 text-sm text-foreground">
                {detail.notes}
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {t("disposal.detail_no_notes", "No notes added")}
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

export { DisposalDetailPage };
